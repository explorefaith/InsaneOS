/* wallpaper_find_test.c — what the admin actions accept from a wallpaper catalog: the motion catalog's
 * own github base, and the web pictures' upload.wikimedia.org, each behind its own prefix. */
#include "../src/hw/wallpaper_find.h"

#include <stdio.h>
#include <string.h>

#define H "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
#define GH "https://raw.githubusercontent.com/insaneos/"
#define WM "https://upload.wikimedia.org/"
static int bad;
static void t(const char *name, const char *json, const char *arg, const char *prefix, int want) {
    char url[200] = "", sha[65] = "";
    unsigned long long size = 0;
    int r = hw_wallpaper_find(json, strlen(json), arg, prefix, url, sizeof url, sha, sizeof sha, &size);
    if (r != want) { printf("FAIL %s: %d\n", name, r); bad++; }
    if (!r && strncmp(url, prefix, strlen(prefix))) { printf("FAIL %s url: %s\n", name, url); bad++; }
}
int main(void) {
    const char *ok = "{\"base\":\"https://raw.githubusercontent.com/insaneos/x\",\"items\":[{\"id\":\"a\",\"variants\":[{\"name\":\"1080.hevc\",\"file\":\"a/1080.hevc.mp4\",\"sha256\":\"" H "\",\"size\":10}]}]}";
    t("found", ok, "a 1080.hevc", GH, 0);
    t("unknown id", ok, "b 1080.hevc", GH, -1);
    t("unknown variant", ok, "a 2160.hevc", GH, -1);
    t("no space", ok, "a", GH, -1);
    t("path in the id", ok, "../a 1080.hevc", GH, -1);
    t("slash in variant", ok, "a ../x", GH, -1);
    t("upper case", ok, "A 1080.hevc", GH, -1);
    t("other host", "{\"base\":\"https://example.org\",\"items\":[]}", "a 1080.hevc", GH, -1);
    t("base beyond the prefix", ok, "a 1080.hevc", "https://raw.githubusercontent.com/insaneos/other/", -1);
    t("bad hash", "{\"base\":\"https://raw.githubusercontent.com/insaneos/x\",\"items\":[{\"id\":\"a\",\"variants\":[{\"name\":\"v\",\"file\":\"f\",\"sha256\":\"zz\",\"size\":10}]}]}", "a v", GH, -1);
    t("too big", "{\"base\":\"https://raw.githubusercontent.com/insaneos/x\",\"items\":[{\"id\":\"a\",\"variants\":[{\"name\":\"v\",\"file\":\"f\",\"sha256\":\"" H "\",\"size\":200000000}]}]}", "a v", GH, -1);
    t("not json", "nope", "a v", GH, -1);
    const char *wm = "{\"base\":\"https://upload.wikimedia.org/wikipedia/commons\",\"items\":[{\"id\":\"p\",\"variants\":[{\"name\":\"1920\",\"file\":\"thumb/1/1f/P.jpg/1920px-P.jpg\",\"sha256\":\"" H "\",\"size\":480000}]}]}";
    t("web found", wm, "p 1920", WM, 0);
    t("web behind the other prefix", wm, "p 1920", GH, -1);
    printf("wallpaper-find-test: %s\n", bad ? "FAILED" : "ok");
    return bad != 0;
}
