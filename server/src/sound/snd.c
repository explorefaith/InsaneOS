/* snd.c — Insane OS sound client.
 *
 * Speaks the PulseAudio native protocol with pipewire-pulse (the part of PipeWire that
 * serves it at $XDG_RUNTIME_DIR/pulse/native): no libpulse or libpipewire. Keeps a copy of
 * the outputs (sinks), inputs (sources), apps playing (sink inputs) and apps recording
 * (source outputs); subscribes to changes and notifies JS with "state" when something changed
 * and all replies have arrived. If PipeWire restarts, it reconnects every 2 s.
 *
 * Extras: level meter for an input (a normal 48 kHz recording stream; the level is the largest
 * sample of each block, see snd_meter) and system sounds synthesized here (uploaded once to the
 * server's sample cache and then played with PLAY_SAMPLE). */
#include "snd.h"
#include "pulse.h"

#include <errno.h>
#include <fcntl.h>
#include <math.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/timerfd.h>
#include <sys/un.h>
#include <unistd.h>

#define PROTOCOL_VERSION 32             /* ports with "available", no availability groups (v34) */
#define MAX_DEV 32
#define MAX_STREAMS 64
#define MAX_PORTS 16
#define MAX_PENDING 256

typedef struct { char name[128], desc[128]; uint32_t priority, available; } Port;

typedef struct {
    uint32_t index, monitor, card, state, base;      /* monitor: for a sink, its source; for a source, its sink */
    char name[256], desc[256], icon[96], form[32], bus[32];
    uint8_t ch, map[PA_CHANNELS_MAX];
    uint32_t vol[PA_CHANNELS_MAX];
    int mute, nports;
    Port ports[MAX_PORTS];
    char active[128];
} Dev;

typedef struct {
    uint32_t index, client, dev, pid;
    char name[256], app[128], icon[96], binary[64], role[32], appid[128];
    uint8_t ch;
    uint32_t vol[PA_CHANNELS_MAX];
    int mute, corked, has_volume, writable;
} Stream;

typedef struct { Dev d[MAX_DEV]; int n; } DevList;
typedef struct { Stream s[MAX_STREAMS]; int n; } StreamList;

enum {
    R_NONE, R_AUTH, R_NAME, R_SERVER, R_LIST, R_ONE, R_ACK, R_RECORD, R_UPLOAD, R_PLAY,
};

typedef struct { uint32_t tag; int kind, what; uint32_t arg; } Pending;

static struct {
    int fd, timer;                      /* socket; reconnection timer */
    int connected;                      /* handshake finished */
    uint32_t version, tag;
    Pending pend[MAX_PENDING];
    int info_pending, dirty;
    uint8_t *in;                        /* incoming packet */
    size_t in_len, in_cap;
    uint8_t *out;                       /* what's left to write */
    size_t out_len, out_cap;
    char server_name[64], server_version[32], default_sink[256], default_source[256];
    DevList sinks, sources;
    StreamList inputs, outputs;
    uint32_t meter_source, meter_channel, meter_stream_ok;
    int meter_pending;
    double peak;
    int peak_ready;
    /* the spectrum (snd_spectrum): a record stream on the default sink's monitor while the desktop's
     * visualizer wants it, its samples in a mono ring the bands are computed from on demand */
    int spec_on, spec_pending, spec_pos, spec_fill;
    uint32_t spec_source, spec_channel;
    float spec_buf[2048];
    int debug;                          /* INSANE_SND_DEBUG=1: every packet to stderr */
    int samples_uploaded, uploading, play_after;   /* bits: pop, notify, error, chime, shutter… */
    double fx_vol;                                  /* the level the pending sample plays at */
    char last_error[128];
} S = { .fd = -1, .timer = -1, .meter_source = PA_INVALID_INDEX, .meter_channel = PA_INVALID_INDEX };

static void disconnect(const char *why);
static void upload_data(int which, uint32_t channel);
static int play_sample_vol(int which, double vol);
int snd_spectrum(int on);

/* ---- E/S ---- */

static int flush_out(void) {
    while (S.out_len) {
        ssize_t w = send(S.fd, S.out, S.out_len, MSG_NOSIGNAL);
        if (w < 0 && errno == EINTR) continue;
        if (w < 0 && errno == EAGAIN) return 0;
        if (w <= 0) return -1;
        memmove(S.out, S.out + w, S.out_len - (size_t)w);
        S.out_len -= (size_t)w;
    }
    return 0;
}

static int queue_bytes(const uint8_t *p, size_t n) {
    if (S.fd < 0) return -1;
    if (S.out_len + n > S.out_cap) {
        size_t cap = S.out_cap ? S.out_cap * 2 : 4096;
        while (cap < S.out_len + n) cap *= 2;
        if (cap > PA_FRAME_MAX) return -1;
        uint8_t *o = realloc(S.out, cap);
        if (!o) return -1;
        S.out = o;
        S.out_cap = cap;
    }
    memcpy(S.out + S.out_len, p, n);
    S.out_len += n;
    if (flush_out()) { disconnect("write error"); return -1; }
    return 0;
}

static Pending *pend_add(uint32_t tag, int kind, int what, uint32_t arg) {
    for (int i = 0; i < MAX_PENDING; i++)
        if (S.pend[i].kind == R_NONE) {
            S.pend[i] = (Pending){ tag, kind, what, arg };
            if (kind == R_LIST || kind == R_ONE || kind == R_SERVER) S.info_pending++;
            return &S.pend[i];
        }
    return NULL;
}

/* Starts a command: tagstruct with command and tag. */
static uint32_t cmd_begin(TsOut *t, uint32_t cmd) {
    ts_init(t);
    uint32_t tag = S.tag++;
    ts_u32(t, cmd);
    ts_u32(t, tag);
    return tag;
}

static int cmd_send(TsOut *t, uint32_t tag, int kind, int what, uint32_t arg) {
    size_t n = ts_finish(t);
    int r = -1;
    if (n && pend_add(tag, kind, what, arg)) r = queue_bytes(t->d, n);
    ts_free(t);
    return r;
}

/* ---- model ---- */

static void copy(char *dst, size_t cap, const char *src) { snprintf(dst, cap, "%s", src ? src : ""); }

static int is_list_cmd(int what) {
    return what == PA_CMD_GET_SINK_INFO_LIST || what == PA_CMD_GET_SOURCE_INFO_LIST ||
           what == PA_CMD_GET_SINK_INPUT_INFO_LIST || what == PA_CMD_GET_SOURCE_OUTPUT_INFO_LIST;
}

static void dev_prop(void *ud, const char *key, const char *val, uint32_t len) {
    (void)len;
    Dev *d = ud;
    if (!strcmp(key, "device.icon_name")) copy(d->icon, sizeof d->icon, val);
    else if (!strcmp(key, "device.form_factor")) copy(d->form, sizeof d->form, val);
    else if (!strcmp(key, "device.bus")) copy(d->bus, sizeof d->bus, val);
}

static int parse_dev(TsIn *t, Dev *d, int source) {
    memset(d, 0, sizeof *d);
    d->index = ts_get_u32(t);
    copy(d->name, sizeof d->name, ts_get_str(t));
    copy(d->desc, sizeof d->desc, ts_get_str(t));
    uint8_t f, c; uint32_t rate;
    ts_get_ss(t, &f, &c, &rate);
    ts_get_cmap(t, d->map);
    ts_get_u32(t);                                  /* module */
    d->ch = ts_get_cvol(t, d->vol);
    d->mute = ts_get_bool(t);
    d->monitor = ts_get_u32(t);
    ts_get_str(t);                                  /* monitor name */
    ts_get_u64(t);                                  /* latency */
    ts_get_str(t);                                  /* driver */
    ts_get_u32(t);                                  /* flags */
    ts_get_proplist(t, dev_prop, d);
    ts_get_u64(t);                                  /* requested latency */
    d->base = ts_get_vol(t);
    d->state = ts_get_u32(t);
    ts_get_u32(t);                                  /* volume steps */
    d->card = ts_get_u32(t);
    uint32_t np = ts_get_u32(t);
    for (uint32_t i = 0; i < np && !t->err; i++) {
        Port tmp, *p = d->nports < MAX_PORTS ? &d->ports[d->nports++] : &tmp;
        copy(p->name, sizeof p->name, ts_get_str(t));
        copy(p->desc, sizeof p->desc, ts_get_str(t));
        p->priority = ts_get_u32(t);
        p->available = ts_get_u32(t);               /* v24: 0 unknown, 1 no, 2 yes */
    }
    copy(d->active, sizeof d->active, ts_get_str(t));
    uint8_t nf = ts_get_u8(t);                      /* formats (v21 sinks, v22 sources) */
    for (uint8_t i = 0; i < nf && !t->err; i++) ts_skip_format(t);
    (void)source;
    return t->err ? -1 : 0;
}

static void stream_prop(void *ud, const char *key, const char *val, uint32_t len) {
    (void)len;
    Stream *s = ud;
    if (!strcmp(key, "application.name")) copy(s->app, sizeof s->app, val);
    else if (!strcmp(key, "application.icon_name")) copy(s->icon, sizeof s->icon, val);
    else if (!strcmp(key, "application.process.binary")) copy(s->binary, sizeof s->binary, val);
    else if (!strcmp(key, "application.process.id")) s->pid = (uint32_t)strtoul(val, NULL, 10);
    else if (!strcmp(key, "application.id")) copy(s->appid, sizeof s->appid, val);
    else if (!strcmp(key, "media.role")) copy(s->role, sizeof s->role, val);
    else if (!s->icon[0] && !strcmp(key, "media.icon_name")) copy(s->icon, sizeof s->icon, val);
}

static int parse_stream(TsIn *t, Stream *s, int output) {
    memset(s, 0, sizeof *s);
    s->index = ts_get_u32(t);
    copy(s->name, sizeof s->name, ts_get_str(t));
    ts_get_u32(t);                                  /* module */
    s->client = ts_get_u32(t);
    s->dev = ts_get_u32(t);
    uint8_t f, c, map[PA_CHANNELS_MAX]; uint32_t rate;
    ts_get_ss(t, &f, &c, &rate);
    ts_get_cmap(t, map);
    if (!output) s->ch = ts_get_cvol(t, s->vol);
    ts_get_u64(t);
    ts_get_u64(t);
    ts_get_str(t);                                  /* resample method */
    ts_get_str(t);                                  /* driver */
    if (!output) s->mute = ts_get_bool(t);
    ts_get_proplist(t, stream_prop, s);
    s->corked = ts_get_bool(t);
    if (output) { s->ch = ts_get_cvol(t, s->vol); s->mute = ts_get_bool(t); }
    s->has_volume = ts_get_bool(t);
    s->writable = ts_get_bool(t);
    ts_skip_format(t);
    return t->err ? -1 : 0;
}

static DevList *dev_list(int what) {
    return what == PA_CMD_GET_SINK_INFO || what == PA_CMD_GET_SINK_INFO_LIST ? &S.sinks : &S.sources;
}

static StreamList *stream_list(int what) {
    return what == PA_CMD_GET_SINK_INPUT_INFO || what == PA_CMD_GET_SINK_INPUT_INFO_LIST ? &S.inputs : &S.outputs;
}

static int is_dev_cmd(int what) {
    return what == PA_CMD_GET_SINK_INFO || what == PA_CMD_GET_SINK_INFO_LIST ||
           what == PA_CMD_GET_SOURCE_INFO || what == PA_CMD_GET_SOURCE_INFO_LIST;
}

static void upsert_dev(DevList *l, const Dev *d) {
    for (int i = 0; i < l->n; i++) if (l->d[i].index == d->index) { l->d[i] = *d; return; }
    if (l->n < MAX_DEV) l->d[l->n++] = *d;
}

static void upsert_stream(StreamList *l, const Stream *s) {
    for (int i = 0; i < l->n; i++) if (l->s[i].index == s->index) { l->s[i] = *s; return; }
    if (l->n < MAX_STREAMS) l->s[l->n++] = *s;
}

static void remove_index(int facility, uint32_t index) {
    if (facility == PA_SUB_SINK || facility == PA_SUB_SOURCE) {
        DevList *l = facility == PA_SUB_SINK ? &S.sinks : &S.sources;
        for (int i = 0; i < l->n; i++) if (l->d[i].index == index) { l->d[i] = l->d[--l->n]; break; }
    } else {
        StreamList *l = facility == PA_SUB_SINK_INPUT ? &S.inputs : &S.outputs;
        for (int i = 0; i < l->n; i++) if (l->s[i].index == index) { l->s[i] = l->s[--l->n]; break; }
    }
}

static void on_info(int what, TsIn *t) {
    int list = is_list_cmd(what);
    if (is_dev_cmd(what)) {
        DevList *l = dev_list(what);
        if (list) l->n = 0;
        Dev d;
        while (!ts_eof(t) && !t->err && parse_dev(t, &d, l == &S.sources) == 0) upsert_dev(l, &d);
    } else {
        StreamList *l = stream_list(what);
        int output = l == &S.outputs;
        if (list) l->n = 0;
        Stream s;
        while (!ts_eof(t) && !t->err && parse_stream(t, &s, output) == 0) upsert_stream(l, &s);
    }
    if (t->err) fprintf(stderr, "sound: reply %d with unexpected format\n", what);
    S.dirty = 1;
}

static void request_info(uint32_t cmd, uint32_t index) {
    TsOut t;
    uint32_t tag = cmd_begin(&t, cmd);
    int list = is_list_cmd((int)cmd);
    if (!list) {
        ts_u32(&t, index);
        if (cmd == PA_CMD_GET_SINK_INFO || cmd == PA_CMD_GET_SOURCE_INFO) ts_str(&t, NULL);
    }
    cmd_send(&t, tag, list ? R_LIST : R_ONE, (int)cmd, index);
}

static void request_server(void) {
    TsOut t;
    uint32_t tag = cmd_begin(&t, PA_CMD_GET_SERVER_INFO);
    cmd_send(&t, tag, R_SERVER, 0, 0);
}

static void request_all(void) {
    request_server();
    request_info(PA_CMD_GET_SINK_INFO_LIST, 0);
    request_info(PA_CMD_GET_SOURCE_INFO_LIST, 0);
    request_info(PA_CMD_GET_SINK_INPUT_INFO_LIST, 0);
    request_info(PA_CMD_GET_SOURCE_OUTPUT_INFO_LIST, 0);
}

static void on_subscribe_event(uint32_t ev, uint32_t index) {
    int facility = (int)(ev & PA_SUB_FACILITY_MASK), type = (int)(ev & PA_SUB_TYPE_MASK);
    static const uint32_t get[] = { PA_CMD_GET_SINK_INFO, PA_CMD_GET_SOURCE_INFO, PA_CMD_GET_SINK_INPUT_INFO, PA_CMD_GET_SOURCE_OUTPUT_INFO };
    if (facility == PA_SUB_SERVER) { request_server(); return; }
    if (facility == PA_SUB_CARD) {                  /* the profile changed: the ports of its sinks/sources */
        request_info(PA_CMD_GET_SINK_INFO_LIST, 0);
        request_info(PA_CMD_GET_SOURCE_INFO_LIST, 0);
        return;
    }
    if (facility > PA_SUB_SOURCE_OUTPUT) return;
    if (type == PA_SUB_REMOVE) { remove_index(facility, index); S.dirty = 1; return; }
    request_info(get[facility], index);
}

/* ---- handshake ---- */

static void send_client_name(void) {
    TsOut t;
    uint32_t tag = cmd_begin(&t, PA_CMD_SET_CLIENT_NAME);
    char pid[16];
    snprintf(pid, sizeof pid, "%d", (int)getpid());
    const char *kv[] = {
        "application.name", "Insane OS", "application.id", "org.insaneos.Server",
        "application.icon_name", "audio-card", "application.process.id", pid,
        "application.process.binary", "insane-server",
    };
    ts_proplist(&t, kv, 5);
    cmd_send(&t, tag, R_NAME, 0, 0);
}

static void after_connected(void) {
    TsOut t;
    uint32_t tag = cmd_begin(&t, PA_CMD_SUBSCRIBE);
    ts_u32(&t, PA_SUB_MASK_SINK | PA_SUB_MASK_SOURCE | PA_SUB_MASK_SINK_INPUT | PA_SUB_MASK_SOURCE_OUTPUT |
               PA_SUB_MASK_SERVER | PA_SUB_MASK_CARD);
    cmd_send(&t, tag, R_ACK, PA_CMD_SUBSCRIBE, 0);
    request_all();
    if (S.meter_source != PA_INVALID_INDEX) { uint32_t m = S.meter_source; S.meter_source = PA_INVALID_INDEX; snd_meter(m); }
    if (S.spec_on) snd_spectrum(1);
}

static const char *socket_path(char *buf, size_t cap) {
    const char *ps = getenv("PULSE_SERVER");
    if (ps && !strncmp(ps, "unix:", 5)) { snprintf(buf, cap, "%s", ps + 5); return buf; }
    const char *rt = getenv("XDG_RUNTIME_DIR");
    char def[64];
    if (!rt || !*rt) { snprintf(def, sizeof def, "/run/user/%u", (unsigned)getuid()); rt = def; }
    snprintf(buf, cap, "%s/pulse/native", rt);
    return buf;
}

static void arm_timer(int on) {
    if (S.timer < 0) S.timer = timerfd_create(CLOCK_MONOTONIC, TFD_NONBLOCK | TFD_CLOEXEC);
    if (S.timer < 0) return;
    struct itimerspec its = { 0 };
    if (on) { its.it_value.tv_sec = 2; its.it_interval.tv_sec = 2; }
    timerfd_settime(S.timer, 0, &its, NULL);
}

static int try_connect(void) {
    char path[sizeof ((struct sockaddr_un *)0)->sun_path];
    socket_path(path, sizeof path);
    struct stat st;
    /* only the user's own server (the socket lives in their runtime folder) */
    if (stat(path, &st) || !S_ISSOCK(st.st_mode) || st.st_uid != getuid()) return -1;
    int fd = socket(AF_UNIX, SOCK_STREAM | SOCK_CLOEXEC, 0);
    if (fd < 0) return -1;
    struct sockaddr_un a = { .sun_family = AF_UNIX };
    snprintf(a.sun_path, sizeof a.sun_path, "%s", path);
    if (connect(fd, (struct sockaddr *)&a, sizeof a)) { close(fd); return -1; }
    fcntl(fd, F_SETFL, fcntl(fd, F_GETFL) | O_NONBLOCK);
    S.fd = fd;
    S.tag = 0;
    S.in_len = S.out_len = 0;
    S.info_pending = 0;
    memset(S.pend, 0, sizeof S.pend);
    S.samples_uploaded = S.uploading = S.play_after = 0;
    S.meter_channel = PA_INVALID_INDEX;
    S.meter_pending = 0;
    S.spec_channel = PA_INVALID_INDEX;
    S.spec_pending = 0;
    S.spec_pos = S.spec_fill = 0;

    /* cookie: PulseAudio's if it exists (pipewire-pulse doesn't require it) */
    uint8_t cookie[256] = { 0 };
    const char *home = getenv("HOME");
    if (home) {
        char cp[512];
        snprintf(cp, sizeof cp, "%s/.config/pulse/cookie", home);
        int cf = open(cp, O_RDONLY | O_CLOEXEC);
        if (cf >= 0) { if (read(cf, cookie, sizeof cookie) < 0) memset(cookie, 0, sizeof cookie); close(cf); }
    }
    TsOut t;
    uint32_t tag = cmd_begin(&t, PA_CMD_AUTH);
    ts_u32(&t, PROTOCOL_VERSION);                   /* no shared memory: data goes over the socket */
    ts_arb(&t, cookie, sizeof cookie);
    if (cmd_send(&t, tag, R_AUTH, 0, 0)) return -1;
    arm_timer(0);
    return 0;
}

static void disconnect(const char *why) {
    if (S.fd >= 0) {
        close(S.fd);
        S.fd = -1;
        if (S.connected) fprintf(stderr, "sound: disconnected from PipeWire (%s); retrying\n", why);
    }
    S.connected = 0;
    S.sinks.n = S.sources.n = S.inputs.n = S.outputs.n = 0;
    S.server_name[0] = S.default_sink[0] = S.default_source[0] = 0;
    S.dirty = 1;
    arm_timer(1);
}

int snd_start(void) {
    S.debug = getenv("INSANE_SND_DEBUG") != NULL;
    if (try_connect()) { disconnect("no server"); return -1; }
    return 0;
}

void snd_stop(void) {
    if (S.fd >= 0) close(S.fd);
    if (S.timer >= 0) close(S.timer);
    S.fd = S.timer = -1;
    free(S.in); free(S.out);
    S.in = S.out = NULL;
    S.in_cap = S.out_cap = S.in_len = S.out_len = 0;
}

int snd_fd(void) { return S.fd >= 0 ? S.fd : S.timer; }

/* ---- incoming packets ---- */

static void on_reply(Pending p, TsIn *t) {
    switch (p.kind) {
    case R_AUTH: {
        S.version = ts_get_u32(t) & 0xffff;
        if (S.version > PROTOCOL_VERSION) S.version = PROTOCOL_VERSION;
        if (S.version < PROTOCOL_VERSION) { disconnect("old protocol version"); return; }
        send_client_name();
        break;
    }
    case R_NAME:
        S.connected = 1;
        S.dirty = 1;
        fprintf(stderr, "sound: connected to PipeWire (protocol %u)\n", S.version);
        after_connected();
        break;
    case R_SERVER: {
        copy(S.server_name, sizeof S.server_name, ts_get_str(t));
        copy(S.server_version, sizeof S.server_version, ts_get_str(t));
        ts_get_str(t); ts_get_str(t);                 /* user, host */
        uint8_t f, c; uint32_t r;
        ts_get_ss(t, &f, &c, &r);
        copy(S.default_sink, sizeof S.default_sink, ts_get_str(t));
        copy(S.default_source, sizeof S.default_source, ts_get_str(t));
        S.dirty = 1;
        break;
    }
    case R_LIST: case R_ONE: on_info(p.what, t); break;
    case R_RECORD: {
        uint32_t ch = ts_get_u32(t);
        S.meter_pending = 0;
        S.spec_pending = 0;
        if (t->err) break;
        if (p.arg == S.spec_source && S.spec_on) { S.spec_channel = ch; break; }
        if (S.meter_source == PA_INVALID_INDEX || S.meter_source != p.arg) {   /* it was turned off in the meantime */
            TsOut o;
            uint32_t tag = cmd_begin(&o, PA_CMD_DELETE_RECORD_STREAM);
            ts_u32(&o, ch);
            cmd_send(&o, tag, R_ACK, PA_CMD_DELETE_RECORD_STREAM, 0);
            break;
        }
        S.meter_channel = ch;
        break;
    }
    case R_UPLOAD: {
        uint32_t ch = ts_get_u32(t), len = ts_get_u32(t);
        (void)len;
        if (t->err || p.arg > 2) break;
        upload_data((int)p.arg, ch);
        break;
    }
    default: break;
    }
}

static void on_error(Pending p, uint32_t code) {
    if (p.kind == R_ONE) return;                    /* it disappeared between the notice and the request */
    if (p.kind == R_RECORD) S.meter_pending = 0;
    snprintf(S.last_error, sizeof S.last_error, "comando %d: error %u", p.what, code);
    fprintf(stderr, "sonido: %s\n", S.last_error);
    if (p.kind == R_AUTH || p.kind == R_NAME) disconnect("connection refused");
}

static void on_packet(uint32_t channel, const uint8_t *d, size_t n) {
    if (channel != 0xffffffffu) {                   /* data: the meter (float32 samples; the level is the largest) */
        if (channel == S.meter_channel && n >= 4) {
            float v = 0, m = 0;
            for (size_t i = 0; i + 4 <= n; i += 4) { memcpy(&v, d + i, 4); v = fabsf(v); if (v > m) m = v; }
            S.peak = m > 1 ? 1 : m;
            S.peak_ready = 1;
        }
        if (channel == S.spec_channel && n >= 4) {  /* the spectrum's monitor: a mono ring of the latest samples */
            for (size_t i = 0; i + 4 <= n; i += 4) {
                float v;
                memcpy(&v, d + i, 4);
                S.spec_buf[S.spec_pos] = v;
                S.spec_pos = (S.spec_pos + 1) % (int)(sizeof S.spec_buf / sizeof S.spec_buf[0]);
                if (S.spec_fill < (int)(sizeof S.spec_buf / sizeof S.spec_buf[0])) S.spec_fill++;
            }
        }
        return;
    }
    TsIn t;
    ts_in(&t, d, n);
    uint32_t cmd = ts_get_u32(&t), tag = ts_get_u32(&t);
    if (t.err) return;
    if (S.debug) fprintf(stderr, "sonido: <- comando %u tag %d (%zu bytes)\n", cmd, (int)tag, n);
    if (cmd == PA_CMD_REPLY || cmd == PA_CMD_ERROR) {
        for (int i = 0; i < MAX_PENDING; i++) {
            if (S.pend[i].kind == R_NONE || S.pend[i].tag != tag) continue;
            Pending p = S.pend[i];
            S.pend[i].kind = R_NONE;
            if (p.kind == R_LIST || p.kind == R_ONE || p.kind == R_SERVER) S.info_pending--;
            if (cmd == PA_CMD_REPLY) on_reply(p, &t); else on_error(p, ts_get_u32(&t));
            return;
        }
        return;
    }
    if (cmd == PA_CMD_SUBSCRIBE_EVENT) {
        uint32_t ev = ts_get_u32(&t), idx = ts_get_u32(&t);
        if (!t.err) on_subscribe_event(ev, idx);
        return;
    }
    if (cmd == PA_CMD_RECORD_STREAM_KILLED) {       /* the meter's source disappeared */
        uint32_t ch = ts_get_u32(&t);
        if (ch == S.meter_channel) { S.meter_channel = PA_INVALID_INDEX; S.meter_source = PA_INVALID_INDEX; }
        if (ch == S.spec_channel) S.spec_channel = PA_INVALID_INDEX;
    }
    /* REQUEST, STARTED, OVERFLOW...: we don't play our own streams (samples go to the cache) */
}

void snd_dispatch(void) {
    if (S.fd < 0) {
        uint64_t x;
        if (S.timer >= 0 && read(S.timer, &x, sizeof x) > 0) try_connect();
        return;
    }
    for (;;) {
        if (S.in_cap - S.in_len < 65536) {
            size_t cap = S.in_cap ? S.in_cap * 2 : 65536;
            while (cap - S.in_len < 65536) cap *= 2;
            if (cap > PA_FRAME_MAX + 65536) { disconnect("packet too large"); return; }
            uint8_t *b = realloc(S.in, cap);
            if (!b) { disconnect("out of memory"); return; }
            S.in = b;
            S.in_cap = cap;
        }
        ssize_t r = recv(S.fd, S.in + S.in_len, S.in_cap - S.in_len, 0);
        if (r < 0 && errno == EINTR) continue;
        if (r < 0 && errno == EAGAIN) break;
        if (r <= 0) { disconnect(r == 0 ? "connection closed" : "read error"); return; }
        S.in_len += (size_t)r;
        size_t off = 0;
        while (S.in_len - off >= PA_DESCRIPTOR_SIZE) {
            uint32_t len, ch, flags;
            uint64_t offset;
            pa_descriptor_read(S.in + off, &len, &ch, &offset, &flags);
            if (len > PA_FRAME_MAX) { disconnect("invalid packet"); return; }
            if (S.in_len - off < PA_DESCRIPTOR_SIZE + (size_t)len) break;
            on_packet(ch, S.in + off + PA_DESCRIPTOR_SIZE, len);
            if (S.fd < 0) return;
            off += PA_DESCRIPTOR_SIZE + (size_t)len;
        }
        memmove(S.in, S.in + off, S.in_len - off);
        S.in_len -= off;
    }
    if (flush_out()) disconnect("write error");
}

void snd_events(SndEventFn fn) {
    if (S.fd >= 0 && S.out_len && flush_out()) disconnect("write error");
    if (S.dirty && S.info_pending <= 0) {
        S.dirty = 0;
        char *j = snd_state_json();
        if (j) fn("state", j);
        free(j);
    }
    if (S.peak_ready) {
        S.peak_ready = 0;
        char j[96];
        snprintf(j, sizeof j, "{\"source\":%u,\"level\":%.4f}", S.meter_source, S.peak);
        fn("peak", j);
    }
}

/* ---- state as JSON ---- */

typedef struct { char *d; size_t len, cap; } Buf;

static void bput(Buf *b, const char *fmt, ...) {
    va_list ap;
    for (;;) {
        va_start(ap, fmt);
        int n = vsnprintf(b->d ? b->d + b->len : NULL, b->d ? b->cap - b->len : 0, fmt, ap);
        va_end(ap);
        if (n < 0) return;
        if (b->d && b->len + (size_t)n < b->cap) { b->len += (size_t)n; return; }
        size_t cap = b->cap ? b->cap * 2 : 4096;
        while (cap < b->len + (size_t)n + 1) cap *= 2;
        char *d = realloc(b->d, cap);
        if (!d) return;
        b->d = d;
        b->cap = cap;
    }
}

static void bstr(Buf *b, const char *s) {
    bput(b, "\"");
    for (const unsigned char *p = (const unsigned char *)s; *p; p++) {
        if (*p == '"' || *p == '\\') bput(b, "\\%c", *p);
        else if (*p < 0x20) bput(b, "\\u%04x", *p);
        else bput(b, "%c", *p);
    }
    bput(b, "\"");
}

static void bvol(Buf *b, uint8_t ch, const uint32_t *v) {
    bput(b, "\"volume\":[");
    double top = 0;
    for (uint8_t i = 0; i < ch; i++) {
        double x = (double)v[i] / PA_VOLUME_NORM;
        if (x > top) top = x;
        bput(b, "%s%.4f", i ? "," : "", x);
    }
    bput(b, "],\"level\":%.4f", top);
}

static void bidx(Buf *b, const char *key, uint32_t v) {
    if (v == PA_INVALID_INDEX) bput(b, ",\"%s\":-1", key); else bput(b, ",\"%s\":%u", key, v);
}

static void bdevs(Buf *b, const DevList *l, int source) {
    for (int i = 0; i < l->n; i++) {
        const Dev *d = &l->d[i];
        bput(b, "%s{\"index\":%u,\"name\":", i ? "," : "", d->index);
        bstr(b, d->name);
        bput(b, ",\"description\":");
        bstr(b, d->desc[0] ? d->desc : d->name);
        bput(b, ",\"icon\":");
        bstr(b, d->icon);
        bput(b, ",\"formFactor\":");
        bstr(b, d->form);
        bput(b, ",\"bus\":");
        bstr(b, d->bus);
        bput(b, ",");
        bvol(b, d->ch, d->vol);
        bput(b, ",\"mute\":%s,\"state\":%u", d->mute ? "true" : "false", d->state);
        bidx(b, source ? "monitorOf" : "monitor", d->monitor);
        bidx(b, "card", d->card);
        bput(b, ",\"default\":%s", !strcmp(d->name, source ? S.default_source : S.default_sink) ? "true" : "false");
        bput(b, ",\"ports\":[");
        for (int k = 0; k < d->nports; k++) {
            const Port *p = &d->ports[k];
            bput(b, "%s{\"name\":", k ? "," : "");
            bstr(b, p->name);
            bput(b, ",\"description\":");
            bstr(b, p->desc);
            bput(b, ",\"priority\":%u,\"available\":%s}", p->priority,
                 p->available == 1 ? "false" : p->available == 2 ? "true" : "null");
        }
        bput(b, "],\"activePort\":");
        bstr(b, d->active);
        bput(b, "}");
    }
}

static void bstreams(Buf *b, const StreamList *l, int output) {
    int first = 1;
    for (int i = 0; i < l->n; i++) {
        const Stream *s = &l->s[i];
        /* our own streams (meter, system sounds) aren't shown: otherwise the microphone
         * meter would make it look like someone is recording */
        if (!strcmp(s->appid, "org.insaneos.Server")) continue;
        bput(b, "%s{\"index\":%u,\"name\":", first ? "" : ",", s->index);
        first = 0;
        bstr(b, s->name);
        bput(b, ",\"app\":");
        bstr(b, s->app[0] ? s->app : s->binary);
        bput(b, ",\"appId\":");
        bstr(b, s->appid);
        bput(b, ",\"icon\":");
        bstr(b, s->icon);
        bput(b, ",\"binary\":");
        bstr(b, s->binary);
        bput(b, ",\"role\":");
        bstr(b, s->role);
        bput(b, ",\"pid\":%u", s->pid);
        bidx(b, output ? "source" : "sink", s->dev);
        bput(b, ",");
        bvol(b, s->ch, s->vol);
        bput(b, ",\"mute\":%s,\"corked\":%s,\"hasVolume\":%s,\"volumeWritable\":%s}",
             s->mute ? "true" : "false", s->corked ? "true" : "false",
             s->has_volume ? "true" : "false", s->writable ? "true" : "false");
    }
}

char *snd_state_json(void) {
    Buf b = { 0 };
    bput(&b, "{\"connected\":%s,\"server\":", S.connected ? "true" : "false");
    bstr(&b, S.server_name);
    bput(&b, ",\"version\":");
    bstr(&b, S.server_version);
    bput(&b, ",\"defaultSink\":");
    bstr(&b, S.default_sink);
    bput(&b, ",\"defaultSource\":");
    bstr(&b, S.default_source);
    bidx(&b, "meter", S.meter_source);
    bput(&b, ",\"sinks\":[");
    bdevs(&b, &S.sinks, 0);
    bput(&b, "],\"sources\":[");
    bdevs(&b, &S.sources, 1);
    bput(&b, "],\"inputs\":[");
    bstreams(&b, &S.inputs, 0);
    bput(&b, "],\"outputs\":[");
    bstreams(&b, &S.outputs, 1);
    bput(&b, "]}");
    return b.d;
}

/* ---- commands ---- */

static const uint8_t *find_vol(int kind, uint32_t index, uint8_t *ch) {
    if (kind == SND_SINK || kind == SND_SOURCE) {
        const DevList *l = kind == SND_SINK ? &S.sinks : &S.sources;
        for (int i = 0; i < l->n; i++) if (l->d[i].index == index) { *ch = l->d[i].ch; return (const uint8_t *)l->d[i].vol; }
    } else {
        const StreamList *l = kind == SND_INPUT ? &S.inputs : &S.outputs;
        for (int i = 0; i < l->n; i++) if (l->s[i].index == index) { *ch = l->s[i].ch; return (const uint8_t *)l->s[i].vol; }
    }
    return NULL;
}

static uint32_t to_vol(double x) {
    if (!(x >= 0)) x = 0;                           /* NaN too */
    double v = x * PA_VOLUME_NORM + 0.5;
    if (v > PA_VOLUME_MAX) v = PA_VOLUME_MAX;
    return (uint32_t)v;
}

int snd_set_volume(int kind, uint32_t index, const double *v, int n) {
    if (!S.connected || n < 1 || n > PA_CHANNELS_MAX) return -1;
    uint8_t ch = 0;
    if (!find_vol(kind, index, &ch) || !ch) return -1;
    uint32_t vol[PA_CHANNELS_MAX];
    for (int i = 0; i < ch; i++) vol[i] = to_vol(v[i < n ? i : n - 1]);   /* fewer values: the last one is repeated */
    static const uint32_t cmd[] = { PA_CMD_SET_SINK_VOLUME, PA_CMD_SET_SOURCE_VOLUME, PA_CMD_SET_SINK_INPUT_VOLUME, PA_CMD_SET_SOURCE_OUTPUT_VOLUME };
    TsOut t;
    uint32_t tag = cmd_begin(&t, cmd[kind]);
    ts_u32(&t, index);
    if (kind == SND_SINK || kind == SND_SOURCE) ts_str(&t, NULL);
    ts_cvol(&t, ch, vol);
    return cmd_send(&t, tag, R_ACK, (int)cmd[kind], index);
}

int snd_set_level(int kind, uint32_t index, double level) {
    uint8_t ch = 0;
    const uint32_t *cur = (const uint32_t *)find_vol(kind, index, &ch);
    if (!cur || !ch) return -1;
    uint32_t top = 0;
    for (int i = 0; i < ch; i++) if (cur[i] > top) top = cur[i];
    double v[PA_CHANNELS_MAX];
    for (int i = 0; i < ch; i++) v[i] = top ? level * cur[i] / top : level;
    return snd_set_volume(kind, index, v, ch);
}

int snd_set_mute(int kind, uint32_t index, int mute) {
    if (!S.connected || kind < SND_SINK || kind > SND_OUTPUT) return -1;
    static const uint32_t cmd[] = { PA_CMD_SET_SINK_MUTE, PA_CMD_SET_SOURCE_MUTE, PA_CMD_SET_SINK_INPUT_MUTE, PA_CMD_SET_SOURCE_OUTPUT_MUTE };
    TsOut t;
    uint32_t tag = cmd_begin(&t, cmd[kind]);
    ts_u32(&t, index);
    if (kind == SND_SINK || kind == SND_SOURCE) ts_str(&t, NULL);
    ts_bool(&t, mute);
    return cmd_send(&t, tag, R_ACK, (int)cmd[kind], index);
}

static int dev_exists(int kind, const char *name, uint32_t index) {
    const DevList *l = kind == SND_SINK ? &S.sinks : &S.sources;
    for (int i = 0; i < l->n; i++)
        if (name ? !strcmp(l->d[i].name, name) : l->d[i].index == index) return 1;
    return 0;
}

int snd_set_default(int kind, const char *name) {
    if (!S.connected || (kind != SND_SINK && kind != SND_SOURCE) || !dev_exists(kind, name, 0)) return -1;
    uint32_t c = kind == SND_SINK ? PA_CMD_SET_DEFAULT_SINK : PA_CMD_SET_DEFAULT_SOURCE;
    TsOut t;
    uint32_t tag = cmd_begin(&t, c);
    ts_str(&t, name);
    return cmd_send(&t, tag, R_ACK, (int)c, 0);
}

int snd_set_port(int kind, uint32_t index, const char *port) {
    if (!S.connected || (kind != SND_SINK && kind != SND_SOURCE)) return -1;
    const DevList *l = kind == SND_SINK ? &S.sinks : &S.sources;
    int ok = 0;
    for (int i = 0; i < l->n; i++)
        if (l->d[i].index == index)
            for (int k = 0; k < l->d[i].nports; k++) if (!strcmp(l->d[i].ports[k].name, port)) ok = 1;
    if (!ok) return -1;
    uint32_t c = kind == SND_SINK ? PA_CMD_SET_SINK_PORT : PA_CMD_SET_SOURCE_PORT;
    TsOut t;
    uint32_t tag = cmd_begin(&t, c);
    ts_u32(&t, index);
    ts_str(&t, NULL);
    ts_str(&t, port);
    return cmd_send(&t, tag, R_ACK, (int)c, index);
}

int snd_move(int kind, uint32_t index, uint32_t device) {
    if (!S.connected || (kind != SND_INPUT && kind != SND_OUTPUT)) return -1;
    if (!dev_exists(kind == SND_INPUT ? SND_SINK : SND_SOURCE, NULL, device)) return -1;
    uint32_t c = kind == SND_INPUT ? PA_CMD_MOVE_SINK_INPUT : PA_CMD_MOVE_SOURCE_OUTPUT;
    TsOut t;
    uint32_t tag = cmd_begin(&t, c);
    ts_u32(&t, index);
    ts_u32(&t, device);
    ts_str(&t, NULL);
    return cmd_send(&t, tag, R_ACK, (int)c, index);
}

/* Meter: a plain 1-channel float recording stream at 48 kHz, read in blocks of 2048 samples (~23
 * levels a second); the level is the largest sample of each block (on_packet). Until 0.8.1 it was
 * pavucontrol's trick, a 25 Hz stream with PEAK_DETECT and resample.peaks: in PipeWire that is a
 * node at rate 25 with a quantum of 1, and on a VM it was seen next to PipeWire using ~36 % CPU
 * while Settings → Sound was open. A normal-rate stream is what every recorder asks for. */
/* ---- the spectrum: what the desktop's audio visualizer reads ----
 *
 * While it is wanted (snd_spectrum(1)), a 48 kHz mono record stream runs on the default sink's monitor —
 * what is being played, not what a microphone hears. The samples land in a ring; snd_spectrum_bands()
 * windows the newest 1024, runs one radix-2 FFT and folds the magnitudes into log-spaced bands. The
 * stream exists only while a consumer is interested, and both calls are cheap enough to sit in a render
 * tick: the FFT is ~10k butterflies, the capture is the meter's own path. */

#define SPEC_FFT 1024

/* The default sink's monitor source index (0xffffffff = none or unknown yet). */
static uint32_t sink_monitor(void) {
    for (int i = 0; i < S.sinks.n; i++)
        if (!strcmp(S.sinks.d[i].name, S.default_sink)) return S.sinks.d[i].monitor;
    return PA_INVALID_INDEX;
}

static int spec_start(void) {
    uint32_t src = sink_monitor();
    if (src == PA_INVALID_INDEX || !dev_exists(SND_SOURCE, NULL, src)) return -1;
    S.spec_source = src;
    TsOut t;
    uint32_t tag = cmd_begin(&t, PA_CMD_CREATE_RECORD_STREAM);
    uint8_t mono = 0;                               /* PA_CHANNEL_POSITION_MONO */
    ts_ss(&t, PA_SAMPLE_FLOAT32LE, 1, 48000);
    ts_cmap(&t, 1, &mono);
    ts_u32(&t, src);
    ts_str(&t, NULL);
    ts_u32(&t, 0xffffffffu);                        /* maxlength: the server's */
    ts_bool(&t, 0);                                 /* corked */
    ts_u32(&t, 1024 * 4);                           /* fragsize: 1024 samples, ~21 ms */
    ts_bool(&t, 0); ts_bool(&t, 0); ts_bool(&t, 0); ts_bool(&t, 0); ts_bool(&t, 0);   /* no_remap … fix_channels */
    ts_bool(&t, 1);                                 /* no_move */
    ts_bool(&t, 0);                                 /* variable_rate */
    ts_bool(&t, 0);                                 /* peak_detect: no, computed here */
    ts_bool(&t, 1);                                 /* adjust_latency */
    const char *kv[] = { "media.name", "Insane OS: spectrum", "application.id", "org.insaneos.Server" };
    ts_proplist(&t, kv, 2);
    ts_u32(&t, PA_INVALID_INDEX);                   /* direct_on_input */
    ts_bool(&t, 0);                                 /* early_requests */
    ts_bool(&t, 1);                                 /* dont_inhibit_auto_suspend */
    ts_bool(&t, 0);                                 /* fail_on_suspend */
    ts_u8(&t, 1);                                   /* one format: PCM */
    ts_format_pcm(&t);
    uint32_t vol = PA_VOLUME_NORM;
    ts_cvol(&t, 1, &vol);
    ts_bool(&t, 0);                                 /* muted */
    ts_bool(&t, 0); ts_bool(&t, 0); ts_bool(&t, 0); ts_bool(&t, 0);   /* volume_set, muted_set, relative, passthrough */
    S.spec_pending = 1;
    return cmd_send(&t, tag, R_RECORD, PA_CMD_CREATE_RECORD_STREAM, src);
}

/* snd_spectrum(1) starts the monitor capture, snd_spectrum(0) stops it. Called again with 1 after a
 * reconnect (after_connected) and when the default sink changes are seen in the next state's monitors. */
int snd_spectrum(int on) {
    on = !!on;
    if (on == S.spec_on && S.fd >= 0) return 0;
    S.spec_on = on;
    if (!on) {
        if (S.spec_channel != PA_INVALID_INDEX && S.fd >= 0) {
            TsOut t;
            uint32_t tag = cmd_begin(&t, PA_CMD_DELETE_RECORD_STREAM);
            ts_u32(&t, S.spec_channel);
            cmd_send(&t, tag, R_ACK, PA_CMD_DELETE_RECORD_STREAM, 0);
        }
        S.spec_channel = PA_INVALID_INDEX;
        S.spec_source = PA_INVALID_INDEX;
        S.spec_pos = S.spec_fill = 0;
        return 0;
    }
    if (!S.connected) return 0;                     /* created on connect */
    return spec_start();
}

/* n log-spaced band levels (0..1) of the newest ~21 ms of output, or 0 when nothing is captured yet. */
int snd_spectrum_bands(float *out, int n) {
    if (!out || n < 1 || n > 64) return -1;
    if (!S.spec_on || S.spec_fill < SPEC_FFT) return 0;
    static float hann[SPEC_FFT];
    static int hann_ok;
    if (!hann_ok) {
        for (int i = 0; i < SPEC_FFT; i++) hann[i] = 0.5f - 0.5f * cosf((float)i / (SPEC_FFT - 1) * 2.0f * (float)M_PI);
        hann_ok = 1;
    }
    double re[SPEC_FFT], im[SPEC_FFT];
    for (int i = 0; i < SPEC_FFT; i++) {            /* the newest sample last; FFT magnitudes don't care about phase origin */
        float v = S.spec_buf[(S.spec_pos + (int)(sizeof S.spec_buf / sizeof S.spec_buf[0]) - 1 - i) % (int)(sizeof S.spec_buf / sizeof S.spec_buf[0])];
        re[i] = v * hann[i];
        im[i] = 0;
    }
    for (int i = 1, j = 0; i < SPEC_FFT; i++) {     /* the bit-reversed order the butterflies below expect */
        int bit = SPEC_FFT >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) { double tr = re[i]; re[i] = re[j]; re[j] = tr; double ti = im[i]; im[i] = im[j]; im[j] = ti; }
    }
    for (int len = 2; len <= SPEC_FFT; len <<= 1) {
        double ang = -2.0 * M_PI / len;
        double wr_len = cos(ang), wi_len = sin(ang);
        for (int i = 0; i < SPEC_FFT; i += len) {
            double wr = 1, wi = 0;
            for (int j = 0; j < len / 2; j++) {
                int a = i + j, b = i + j + len / 2;
                double vr = re[b] * wr - im[b] * wi;
                double vi = re[b] * wi + im[b] * wr;
                re[b] = re[a] - vr; im[b] = im[a] - vi;
                re[a] += vr; im[a] += vi;
                double nwr = wr * wr_len - wi * wi_len;
                wi = wr * wi_len + wi * wr_len;
                wr = nwr;
            }
        }
    }
    /* bins 1..SPEC_FFT/2 folded onto n bands, geometric in the bin index (≈ logarithmic in frequency) */
    double top = SPEC_FFT / 2 - 1;
    for (int k = 0; k < n; k++) {
        int lo = 1 + (int)(top * pow((double)k / n, 1.4));
        int hi = 1 + (int)(top * pow((double)(k + 1) / n, 1.4));
        if (hi <= lo) hi = lo + 1;
        if (hi > SPEC_FFT / 2) hi = SPEC_FFT / 2;
        double m = 0;
        for (int b = lo; b < hi; b++) {
            double mag = sqrt(re[b] * re[b] + im[b] * im[b]) / (SPEC_FFT / 4.0);
            if (mag > m) m = mag;
        }
        out[k] = m > 1 ? 1 : (float)m;
    }
    return n;
}

int snd_meter(uint32_t source) {
    if (S.meter_channel != PA_INVALID_INDEX && S.fd >= 0) {
        TsOut t;
        uint32_t tag = cmd_begin(&t, PA_CMD_DELETE_RECORD_STREAM);
        ts_u32(&t, S.meter_channel);
        cmd_send(&t, tag, R_ACK, PA_CMD_DELETE_RECORD_STREAM, 0);
        S.meter_channel = PA_INVALID_INDEX;
    }
    S.meter_source = source;
    S.peak = 0;
    if (source == PA_INVALID_INDEX) return 0;
    if (!S.connected) return 0;                     /* created on connect */
    if (!dev_exists(SND_SOURCE, NULL, source)) { S.meter_source = PA_INVALID_INDEX; return -1; }
    TsOut t;
    uint32_t tag = cmd_begin(&t, PA_CMD_CREATE_RECORD_STREAM);
    uint8_t mono = 0;                               /* PA_CHANNEL_POSITION_MONO */
    ts_ss(&t, PA_SAMPLE_FLOAT32LE, 1, 48000);
    ts_cmap(&t, 1, &mono);
    ts_u32(&t, source);
    ts_str(&t, NULL);
    ts_u32(&t, 0xffffffffu);                        /* maxlength: the server's */
    ts_bool(&t, 0);                                 /* corked */
    ts_u32(&t, 2048 * 4);                           /* fragsize: 2048 samples, ~43 ms */
    ts_bool(&t, 0); ts_bool(&t, 0); ts_bool(&t, 0); ts_bool(&t, 0); ts_bool(&t, 0);   /* no_remap … fix_channels */
    ts_bool(&t, 1);                                 /* no_move */
    ts_bool(&t, 0);                                 /* variable_rate */
    ts_bool(&t, 0);                                 /* peak_detect: no, computed here */
    ts_bool(&t, 1);                                 /* adjust_latency */
    const char *kv2[] = { "media.name", "Insane OS: level meter", "application.id", "org.insaneos.Server" };
    ts_proplist(&t, kv2, 2);
    ts_u32(&t, PA_INVALID_INDEX);                   /* direct_on_input */
    ts_bool(&t, 0);                                 /* early_requests */
    ts_bool(&t, 1);                                 /* dont_inhibit_auto_suspend */
    ts_bool(&t, 0);                                 /* fail_on_suspend */
    ts_u8(&t, 1);                                   /* one format: PCM */
    ts_format_pcm(&t);
    uint32_t vol = PA_VOLUME_NORM;
    ts_cvol(&t, 1, &vol);
    ts_bool(&t, 0);                                 /* muted */
    ts_bool(&t, 0); ts_bool(&t, 0); ts_bool(&t, 0); ts_bool(&t, 0);   /* volume_set, muted_set, relative, passthrough */
    S.meter_pending = 1;
    return cmd_send(&t, tag, R_RECORD, PA_CMD_CREATE_RECORD_STREAM, source);
}

/* ---- system sounds ---- */

static const char *const sample_names[8] = { "insaneos-pop", "insaneos-notify", "insaneos-error", "insaneos-chime",
                                             "insaneos-shutter", "insaneos-trash", "insaneos-plug", "insaneos-unplug" };

#define SR 44100

/* Synthesizes the sound: sines with an envelope (short attack, exponential decay). s16le mono. */
static int16_t *synth(int which, uint32_t *bytes) {
    static const struct { double f1, f2, dur, split; } tone[3] = {
        { 880, 0, 0.07, 0 },                        /* pop: a short tap */
        { 1046.5, 1568, 0.32, 0.12 },               /* notify: C6 → G6 */
        { 311, 233, 0.30, 0.13 },                   /* error: two low notes */
    };
    if (which == 4) {
        /* shutter: the mirror slap — two very short band-ish clicks (damped sines), 45 ms apart */
        static const double f[2] = { 4200, 2600 };
        static const double at[2] = { 0, 0.045 };
        int n = (int)(0.11 * SR);
        int16_t *s = calloc((size_t)n, 2);
        if (!s) return NULL;
        for (int k = 0; k < 2; k++)
            for (int i = (int)(at[k] * SR); i < (int)((at[k] + 0.018) * SR) && i < n; i++) {
                double local = (double)i / SR - at[k];
                double env = exp(-local * 900) * (1 - exp(-local * 4000));
                double v = sin(2 * M_PI * f[k] * local) * 0.7 + sin(2 * M_PI * f[k] * 2.7 * local) * 0.2;
                double x = s[i] + v * env * 0.55 * 32767;
                s[i] = x > 32767 ? 32767 : x < -32768 ? -32768 : (int16_t)x;
            }
        *bytes = (uint32_t)n * 2;
        return s;
    }
    if (which == 5) {
        /* trash: a paper crumple — three noise bursts, each softer and lower than the last */
        static const double at[3] = { 0, 0.07, 0.15 };
        static const double dur[3] = { 0.05, 0.045, 0.06 };
        static const double lp[3] = { 0.55, 0.35, 0.22 };
        int n = (int)(0.24 * SR);
        int16_t *s = calloc((size_t)n, 2);
        if (!s) return NULL;
        unsigned st = 123456789u;
        for (int k = 0; k < 3; k++)
            for (int i = (int)(at[k] * SR); i < (int)((at[k] + dur[k]) * SR) && i < n; i++) {
                double local = (double)i / SR - at[k];
                double env = exp(-local * 60) * (1 - exp(-local * 1500));
                st = st * 1664525u + 1013904223u;                  /* LCG noise, Park–Miller's cousin */
                double nz = ((int32_t)st / 2147483648.0);
                double v = nz * env * lp[k] * 0.8;
                double x = s[i] + v * 32767;
                s[i] = x > 32767 ? 32767 : x < -32768 ? -32768 : (int16_t)x;
            }
        *bytes = (uint32_t)n * 2;
        return s;
    }
    if (which == 6 || which == 7) {
        /* plug / unplug: a two-note rise or fall, soft and short */
        static const double up[2] = { 659.3, 987.8 };              /* E5 → B5 */
        static const double dn[2] = { 987.8, 659.3 };              /* B5 → E5 */
        const double *nt = which == 6 ? up : dn;
        static const double start[2] = { 0, 0.09 };
        int n = (int)(0.3 * SR);
        int16_t *s = calloc((size_t)n, 2);
        if (!s) return NULL;
        for (int k = 0; k < 2; k++)
            for (int i = (int)(start[k] * SR); i < n; i++) {
                double local = (double)i / SR - start[k];
                double env = (1 - exp(-local * 500)) * exp(-local * 11);
                double v = sin(2 * M_PI * nt[k] * local) * 0.6 + sin(4 * M_PI * nt[k] * local) * 0.1;
                double x = s[i] + v * env * 0.3 * 32767;
                s[i] = x > 32767 ? 32767 : x < -32768 ? -32768 : (int16_t)x;
            }
        *bytes = (uint32_t)n * 2;
        return s;
    }
    if (which == 3) {
        /* chime: C6, E6, G6 arpeggio, warm and soft — the login sound */
        static const double notes[3] = { 1046.5, 1318.5, 1568.0 };
        static const double start[3] = { 0, 0.16, 0.32 };
        int n = (int)(0.9 * SR);
        int16_t *s = calloc((size_t)n, 2);
        if (!s) return NULL;
        for (int k = 0; k < 3; k++)
            for (int i = (int)(start[k] * SR); i < n; i++) {
                double local = (double)i / SR - start[k];
                double env = (1 - exp(-local * 700)) * exp(-local * 7);
                double v = sin(2 * M_PI * notes[k] * local) * 0.5 + sin(4 * M_PI * notes[k] * local) * 0.08;
                double x = s[i] + v * env * 0.4 * 32767;
                s[i] = x > 32767 ? 32767 : x < -32768 ? -32768 : (int16_t)x;
            }
        *bytes = (uint32_t)n * 2;
        return s;
    }
    int n = (int)(tone[which].dur * SR);
    int16_t *s = malloc((size_t)n * 2);
    if (!s) return NULL;
    for (int i = 0; i < n; i++) {
        double tt = (double)i / SR, f = tone[which].f1, t0 = 0;
        if (tone[which].f2 && tt >= tone[which].split) { f = tone[which].f2; t0 = tone[which].split; }
        double local = tt - t0, env = (1 - exp(-local * 900)) * exp(-local * (which ? 14 : 45));
        double v = sin(2 * M_PI * f * local) * 0.8 + sin(4 * M_PI * f * local) * 0.12;
        s[i] = (int16_t)(v * env * 0.5 * 32767);
    }
    *bytes = (uint32_t)n * 2;
    return s;
}

static void upload_data(int which, uint32_t channel) {
    uint32_t bytes = 0;
    int16_t *s = synth(which, &bytes);
    if (!s) return;
    for (uint32_t off = 0; off < bytes; off += 65536) {
        uint32_t n = bytes - off < 65536 ? bytes - off : 65536;
        size_t total;
        uint8_t *pkt = ts_data_packet(channel, (const uint8_t *)s + off, n, &total);
        if (pkt) { queue_bytes(pkt, total); free(pkt); }
    }
    free(s);
    TsOut t;
    uint32_t tag = cmd_begin(&t, PA_CMD_FINISH_UPLOAD_STREAM);
    ts_u32(&t, channel);
    cmd_send(&t, tag, R_ACK, PA_CMD_FINISH_UPLOAD_STREAM, 0);
    S.samples_uploaded |= 1 << which;
    S.uploading &= ~(1 << which);
    if (S.play_after & 1 << which) { S.play_after &= ~(1 << which); play_sample_vol(which, S.fx_vol); }
}

/* goes after the upload on the same socket: the server already has it when this arrives */
static int play_sample_vol(int which, double vol) {
    TsOut t;
    uint32_t tag = cmd_begin(&t, PA_CMD_PLAY_SAMPLE);
    ts_u32(&t, PA_INVALID_INDEX);
    ts_str(&t, NULL);                               /* the default output */
    ts_u32(&t, (uint32_t)(PA_VOLUME_NORM * vol));   /* the effects' own volume (sdk/soundfx.js) */
    ts_str(&t, sample_names[which]);
    const char *kv[] = { "media.role", "event", "application.name", "Insane OS", "application.id", "org.insaneos.Server", "event.id", sample_names[which] };
    ts_proplist(&t, kv, 4);
    return cmd_send(&t, tag, R_ACK, PA_CMD_PLAY_SAMPLE, 0);
}

static int sample_of(const char *name) {
    if (!strcmp(name, "pop")) return 0;
    if (!strcmp(name, "notify")) return 1;
    if (!strcmp(name, "error")) return 2;
    if (!strcmp(name, "chime")) return 3;
    if (!strcmp(name, "shutter")) return 4;
    if (!strcmp(name, "trash")) return 5;
    if (!strcmp(name, "plug")) return 6;
    if (!strcmp(name, "unplug")) return 7;
    return -1;
}

int snd_play_vol(const char *name, double vol) {
    int which = sample_of(name);
    if (which < 0 || !S.connected) return -1;
    if (vol < 0) vol = 0;
    if (vol > 1) vol = 1;
    S.fx_vol = vol;
    if (S.samples_uploaded & 1 << which) return play_sample_vol(which, vol);
    S.play_after |= 1 << which;
    if (S.uploading & 1 << which) return 0;
    uint32_t bytes = 0;
    free(synth(which, &bytes));
    uint8_t mono = 0;
    TsOut t;
    uint32_t tag = cmd_begin(&t, PA_CMD_CREATE_UPLOAD_STREAM);
    ts_str(&t, sample_names[which]);
    ts_ss(&t, PA_SAMPLE_S16LE, 1, SR);
    ts_cmap(&t, 1, &mono);
    ts_u32(&t, bytes);
    const char *kv[] = { "media.role", "event", "event.id", sample_names[which] };
    ts_proplist(&t, kv, 2);
    if (cmd_send(&t, tag, R_UPLOAD, PA_CMD_CREATE_UPLOAD_STREAM, (uint32_t)which)) return -1;
    S.uploading |= 1 << which;
    return 0;
}

/* the old entry point: system volume, as before */
int snd_play(const char *name) { return snd_play_vol(name, 1.0); }
