/* wallpaper_admin_test.c — the login screen's privileged wallpaper choices (server/src/hw/wallpaper_admin.c),
 * with the store redirected to a temp dir: the closed charset of the still sources (ids, "solid:…",
 * "gradient:…"), the fit/rate tails, the root-owned files they write, and that "default" cleans everything.
 * The video action can't run as a normal user (its child must drop privileges); the test proves it fails
 * cleanly, with nothing left behind, and unit-checks the container's magic.
 *
 * Runs as the build's own user; nothing here needs root. Compiles wallpaper_admin.c with
 * -DWALLPAPER_STORE pointing at the temp store, and stubs the helper's replies (admin_say) —
 * the actions under test reply OK/ERR exactly as the real helper would.
 */
#include <dirent.h>
#include <errno.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

#include "../src/pkg/http.h"        /* FetchItem, for the fetch_batch stub below */

/* ---- the store of this run, before the sources see it ---- */
#define WALLPAPER_STORE "/tmp/insaneos-wpadmin/wallpapers"

/* ---- stubs of admin.c and pkg/http.c (never reached by the paths under test) ---- */
static char said[64][256];
static int said_n;
void admin_say(const char *kind, const char *fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    snprintf(said[said_n % 64], sizeof said[0], "%s ", kind);
    size_t l = strlen(said[said_n % 64]);
    vsnprintf(said[said_n % 64] + l, sizeof said[0] - l, fmt, ap);
    va_end(ap);
    said_n++;
}
void admin_event(const char *fmt, ...) { (void)fmt; }
int fetch_batch(FetchItem *items, int n, FetchProgress cb, void *ud) {
    (void)items; (void)n; (void)cb; (void)ud;
    return -1;
}

#include "../src/hw/wallpaper_admin.c"

/* ---- the checks ---- */
static int ok = 0, bad = 0;
static void eq(const char *name, long long a, long long b) {
    if (a == b) ok++;
    else { bad++; fprintf(stderr, "FAIL %s: %lld != %lld\n", name, a, b); }
}
static void seq(const char *name, const char *a, const char *b) {
    if (!strcmp(a, b)) ok++;
    else { bad++; fprintf(stderr, "FAIL %s: \"%s\" != \"%s\"\n", name, a, b); }
}
static char *last_said(void) { return said[(said_n - 1) % 64]; }

static int file_exists(const char *p) {
    struct stat st;
    return !stat(p, &st) && S_ISREG(st.st_mode);
}
static void read_file(const char *p, char *out, size_t n) {
    out[0] = 0;
    FILE *f = fopen(p, "r");
    if (!f) return;
    size_t g = fread(out, 1, n - 1, f);
    fclose(f);
    out[g] = 0;
}
static void clear_store(void) {
    DIR *d = opendir(STORE);
    if (d) {
        for (struct dirent *e; (e = readdir(d)); ) {
            char p[512];
            snprintf(p, sizeof p, "%s/%s", STORE, e->d_name);
            unlink(p);
        }
        closedir(d);
    }
    mkdir(STORE, 0755);
}
static const AdminReq req = { .id = 1, .user = "test", .home = "/tmp/insaneos-wpadmin/home", .uid = 0, .gid = 0, .admin = 1 };
static void act(const char *arg) {
    said_n = 0;
    hw_act_wallpaper_login(&req, arg, strlen(arg));
}

int main(void) {
    mkdir("/tmp/insaneos-wpadmin", 0755);
    mkdir("/tmp/insaneos-wpadmin/home", 0755);
    clear_store();

    /* ---- still_kind: the closed charset ---- */
    eq("id ok", still_kind("lumo-celestial", 14), 0);
    eq("solid ok", still_kind("solid:0b3d5c", 12), 1);
    eq("gradient ok", still_kind("gradient:0b3d5c-123c2b-160", strlen("gradient:0b3d5c-123c2b-160")), 2);
    eq("gradient deg 360", still_kind("gradient:0b3d5c-123c2b-360", strlen("gradient:0b3d5c-123c2b-360")), 2);
    eq("gradient deg 361", still_kind("gradient:0b3d5c-123c2b-361", strlen("gradient:0b3d5c-123c2b-361")), -1);
    eq("solid with #", still_kind("solid:#0b3d5c", 13), -1);
    eq("solid short", still_kind("solid:0b3d", 10), -1);
    eq("solid uppercase", still_kind("solid:0B3D5C", 12), -1);
    eq("path traversal", still_kind("../../etc", 9), -1);
    eq("slash", still_kind("a/b", 3), -1);
    eq("space", still_kind("a b", 3), -1);
    eq("empty", still_kind("", 0), -1);

    /* ---- login_still_parse: the optional tails ---- */
    char spec[64], fit[16];
    int rate = 0;
    eq("parse id", login_still_parse("lumo-celestial", 14, spec, sizeof spec, fit, sizeof fit, &rate), 0);
    seq("parse id spec", spec, "lumo-celestial");
    seq("parse id fit", fit, "");
    eq("parse id rate", rate, 0);
    eq("parse tails", login_still_parse("solid:aabbcc rate 50 fit stretch", 32, spec, sizeof spec, fit, sizeof fit, &rate), 0);
    seq("parse tails spec", spec, "solid:aabbcc");
    seq("parse tails fit", fit, "stretch");
    eq("parse tails rate", rate, 50);
    eq("parse bad rate", login_still_parse("lumo-celestial rate 30", 22, spec, sizeof spec, fit, sizeof fit, &rate), -1);
    eq("parse bad fit", login_still_parse("lumo-celestial fit sideways", 27, spec, sizeof spec, fit, sizeof fit, &rate), -1);
    eq("parse unknown kw", login_still_parse("lumo-celestial colour red", 25, spec, sizeof spec, fit, sizeof fit, &rate), -1);
    eq("parse bare kw", login_still_parse("lumo-celestial fit", 18, spec, sizeof spec, fit, sizeof fit, &rate), -1);
    eq("parse empty", login_still_parse("", 0, spec, sizeof spec, fit, sizeof fit, &rate), -1);

    /* ---- the actions, against the temp store ---- */
    act("still gradient:0b3d5c-123c2b-160 fit center");
    seq("gradient applied", last_said(), "OK gradient");
    char p[512];
    snprintf(p, sizeof p, STORE "/login-still");
    char content[64];
    read_file(p, content, sizeof content);
    seq("login-still mark", content, "gradient:0b3d5c-123c2b-160");
    snprintf(p, sizeof p, STORE "/login-fit");
    read_file(p, content, sizeof content);
    seq("login-fit mark", content, "center");

    act("rate 25");
    seq("rate applied", last_said(), "OK rate");
    snprintf(p, sizeof p, STORE "/login-rate");
    read_file(p, content, sizeof content);
    seq("login-rate mark", content, "25");

    act("rate 30");
    seq("bad rate refused", last_said(), "ERR admin.invalidArgument");
    read_file(STORE "/login-rate", content, sizeof content);
    seq("bad rate left the good one", content, "25");

    act("still ../../etc/passwd");
    seq("traversal refused", last_said(), "ERR admin.invalidArgument");
    read_file(STORE "/login-still", content, sizeof content);
    seq("traversal left no mark", content, "gradient:0b3d5c-123c2b-160");

    /* the stored login pictures: a still choice clears every one of them */
    snprintf(p, sizeof p, STORE "/login-0123456789abcdef.jpg");
    FILE *f = fopen(p, "wb");
    if (f) fputs("jpeg", f);
    fclose(f);
    snprintf(p, sizeof p, STORE "/unrelated.txt");
    f = fopen(p, "wb");
    if (f) fputs("keep me", f);
    fclose(f);
    act("still lumo-celestial");
    seq("still applied", last_said(), "OK still");
    snprintf(p, sizeof p, STORE "/login-0123456789abcdef.jpg");
    eq("login image cleared", file_exists(p), 0);
    snprintf(p, sizeof p, STORE "/unrelated.txt");
    eq("unrelated kept", file_exists(p), 1);
    eq("fit gone with a bare still", file_exists(STORE "/login-fit"), 0);
    eq("rate kept by a still", file_exists(STORE "/login-rate"), 1);

    act("default");
    seq("default ok", last_said(), "OK default");
    eq("default clears still", file_exists(STORE "/login-still"), 0);
    eq("default clears fit", file_exists(STORE "/login-fit"), 0);
    eq("default clears rate", file_exists(STORE "/login-rate"), 0);

    /* ---- the container magic ---- */
    eq("mp4 magic", is_mp4((const unsigned char *)"\0\0\0\x18" "ftypisom\0\0", 12), 1);
    eq("matroska magic", is_matroska((const unsigned char *)"\x1a\x45\xdf\xa3rest", 8), 1);
    eq("not a video", is_mp4((const unsigned char *)"JPEG0001xxxx", 12) || is_matroska((const unsigned char *)"JPEG0001xxxx", 12), 0);

    /* ---- the video action as a normal user: fails cleanly, leaves nothing ---- */
    char clip[512];
    if (!realpath("../Wallpaper/insane-galaxy.mp4", clip)) snprintf(clip, sizeof clip, "/nonexistent.mp4");
    said_n = 0;
    hw_act_wallpaper_login_video(&req, clip, strlen(clip));
    seq("video refuses without privilege", last_said(), "ERR wallpaper.badVideo");
    eq("video left no file", file_exists(STORE "/login.mp4"), 0);
    eq("video left no temp", file_exists(STORE "/.login-video.part"), 0);

    if (bad) {
        fprintf(stderr, "wallpaper-admin-test: %d ok, %d FAILED\n", ok, bad);
        return 1;
    }
    printf("wallpaper-admin-test: %d ok\n", ok);
    return 0;
}
