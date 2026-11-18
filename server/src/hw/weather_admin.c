/* weather_admin.c — weather-get, a closed action of the admin helper: the desktop's weather tile
 * (Control Center) reads the machine's outside temperature from Open-Meteo instead of inventing one.
 *
 *   weather-get "<lat>,<lon>"   the current conditions + a 7-day forecast for that place
 *
 * The host is fixed here — the session never names a server, the same discipline as the wallpaper
 * catalog — and the reply is the bytes of api.open-meteo.com's small JSON, fetched with the wallpapers'
 * own child-as-nobody path (pkg/http.h fetch_batch, https only, size-capped). Root cannot answer with
 * the body itself (an admin reply is one 1024-byte line), so the JSON lands in the session user's own
 * cache (~/.cache/insaneos/weather.json, chowned, 0600) and the action answers with its name; the shell
 * reads only its own home and parses it there. Nothing in the bytes is trusted beyond being JSON: the
 * shell tone-maps nothing from them but numbers it picks apart defensively. */
#include "hw_admin.h"
#include "../admin.h"
#include "../pkg/http.h"

#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

#define WEATHER_MAX (256 * 1024)                        /* a 7-day forecast is a few KB; this is generous */

static void wprogress(uint64_t done, uint64_t total, void *ud) {
    (void)done;
    (void)total;
    (void)ud;                                           /* a one-shot fetch of a few KB: no progress line */
}

void hw_act_weather_get(const AdminReq *r, const char *arg, size_t len) {
    if (strlen(arg) != len || !len || len >= 48) { admin_err("admin.invalidArgument", NULL); return; }
    /* "<lat>,<lon>": two decimal numbers with an optional sign — and exactly those, so "1,2,3" or
     * anything with a letter in it can't reach the URL. */
    char lat[24], lon[24];
    if (sscanf(arg, "%23[-+.0-9],%23[-+.0-9]", lat, lon) != 2 || strlen(lat) + 1 + strlen(lon) != len) {
        admin_err("admin.invalidArgument", NULL);
        return;
    }
    char url[512];
    snprintf(url, sizeof url,
             "https://api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s"
             "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m"
             "&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7",
             lat, lon);
    char tmp[128];
    snprintf(tmp, sizeof tmp, "/var/lib/insaneos/weather-%d.json", (int)r->uid);
    mkdir("/var/lib/insaneos", 0755);
    FetchItem it;
    memset(&it, 0, sizeof it);
    snprintf(it.url, sizeof it.url, "%s", url);
    snprintf(it.dest, sizeof it.dest, "%s", tmp);
    it.max = WEATHER_MAX;
    int last = -1;
    fetch_batch(&it, 1, wprogress, &last);
    if (it.status != 200 || !it.size) {
        unlink(tmp);
        admin_err("weather.fetchFailed", NULL);
        return;
    }
    /* the user's copy: their cache dir, their file, 0600 — the session then reads it like any file of
     * its own (sdk/fs.js read), and a stale one from an older run is simply replaced */
    char dir[512], dst[600];
    snprintf(dir, sizeof dir, "%s/.cache/insaneos", r->home);
    mkdir(dir, 0700);
    chown(dir, r->uid, r->gid);
    snprintf(dst, sizeof dst, "%s/weather.json", dir);
    int in = open(tmp, O_RDONLY | O_CLOEXEC);
    int out = in >= 0 ? open(dst, O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC, 0600) : -1;
    int ok = in >= 0 && out >= 0;
    while (ok) {
        char buf[8192];
        ssize_t got = read(in, buf, sizeof buf);
        if (got < 0 && errno == EINTR) continue;
        if (got <= 0) break;
        ssize_t put = 0;
        while (put < got) {
            ssize_t w = write(out, buf + put, (size_t)(got - put));
            if (w < 0 && errno == EINTR) continue;
            if (w < 0) { ok = 0; break; }
            put += w;
        }
    }
    if (in >= 0) close(in);
    if (out >= 0) close(out);
    unlink(tmp);
    if (!ok) { admin_err("weather.fetchFailed", NULL); return; }
    chown(dst, r->uid, r->gid);
    admin_say("OK", "weather.json");                    /* i18n-ok: parsed by sdk/weather.js */
}
