/* crypto_admin.c — the Binance market-data actions for the widgets (phase 4, M5): public market
 * data only, no key, no account, no secrets anywhere. Two closed actions:
 *
 *   crypto-ticker "<SYMBOL>"   the 24 h ticker → {"symbol","price","change","changePct","high","low","volume"}
 *   crypto-klines "<SYMBOL>"   the last 24 h of 15 m closes → {"closes":[[ms,close],…]}
 *
 * https only, two hosts on the allowlist, fixed endpoint templates, the symbol checked against a
 * strict charset (uppercase letters and digits, 2–20), one MiB cap, and BOTH answers are rebuilt
 * here from the parsed fields — the shell never sees Binance's raw bytes. Errors carry codes
 * (errors.json). Nothing runs without the widget asking through the closed action.
 */
#include "../admin.h"
#include "hw_admin.h"
#include "../pkg/http.h"
#include "../sec/json.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

#define CRYPTO_HOST  "https://api.binance.com"
#define CRYPTO_HOST2 "https://data-api.binance.vision"
#define CRYPTO_MAX   (1ULL << 20)                       /* 1 MiB: the answers are small */

/* uppercase letters and digits only, 2–20 characters */
int crypto_symbol_ok(const char *s, size_t n) {
    if (!s || n < 2 || n > 20) return 0;
    for (size_t i = 0; i < n; i++) {
        char c = s[i];
        if (!((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9'))) return 0;
    }
    return 1;
}

/* one fetch over the allowlisted hosts (the market host, then the data mirror); 0 on success */
static int crypto_fetch(const char *pathq, char *dest, size_t destsz) {
    (void)destsz;
    static const char *const hosts[2] = { CRYPTO_HOST, CRYPTO_HOST2 };
    for (int h = 0; h < 2; h++) {
        FetchItem it;
        memset(&it, 0, sizeof it);
        snprintf(it.url, sizeof it.url, "%s%s", hosts[h], pathq);
        snprintf(it.dest, sizeof it.dest, "%s", dest);
        it.max = CRYPTO_MAX;
        fetch_batch(&it, 1, NULL, NULL);
        if (it.status == 200 && it.size > 0) {
            chmod(dest, 0644);
            return 0;
        }
        unlink(dest);
    }
    return -1;
}

static double numof(const JVal *o, const char *k) {
    /* Binance returns numbers as strings; accept both shapes */
    const JVal *v = json_get(o, k);
    if (!v) return 0;
    if (v->type == J_NUM) return v->num;
    if (v->type == J_STR && v->str && *v->str) return strtod(v->str, NULL);
    return 0;
}

/* rebuilds the trusted ticker answer from a fetched body; 0 on success, the answer in out */
int crypto_ticker_json(const char *buf, size_t n, char *out, size_t outsz) {
    JDoc d;
    if (json_parse(buf, n, &d, NULL, 0) != 0) return -1;
    const JVal *o = d.root;
    int bad = (!o || o->type != J_OBJ || !json_get(o, "lastPrice") || !json_str(o, "symbol"));
    if (!bad) {
        const char *sym = json_str(o, "symbol");
        double price = numof(o, "lastPrice"), chg = numof(o, "priceChange"), pct = numof(o, "priceChangePercent");
        double hi = numof(o, "highPrice"), lo = numof(o, "lowPrice"), vol = numof(o, "volume");
        snprintf(out, outsz, "{\"symbol\":\"%.20s\",\"price\":%.8g,\"change\":%.8g,\"changePct\":%.8g,\"high\":%.8g,\"low\":%.8g,\"volume\":%.8g}",
                 sym && *sym ? sym : "?", price, chg, pct, hi, lo, vol);
    }
    json_free(&d);
    return bad ? -1 : 0;
}

/* walks Binance's klines array and emits [[openTime,close],…] — index 0 and 4 of each row */
int crypto_klines_json(const char *buf, size_t n, char *out, size_t outsz) {
    JDoc d;
    if (json_parse(buf, n, &d, NULL, 0) != 0) return -1;
    const JVal *arr = d.root;
    int bad = (!arr || arr->type != J_ARR || !arr->kid);
    if (!bad) {
        size_t used = (size_t)snprintf(out, outsz, "{\"closes\":[");
        for (const JVal *row = arr->kid; row && used + 40 < outsz; row = row->next) {
            if (row->type != J_ARR || row->len < 5 || !row->kid) continue;
            const JVal *ms = row->kid;
            const JVal *cl = row->kid;
            double msV, clV;
            for (int i = 0; i < 4 && cl; i++) cl = cl->next;   /* index 4: the close */
            if (!ms || !cl) continue;
            /* Binance sends the times as numbers and the prices as strings */
            if (ms->type == J_NUM) msV = ms->num; else if (ms->type == J_STR && ms->str) msV = strtod(ms->str, NULL); else continue;
            if (cl->type == J_NUM) clV = cl->num; else if (cl->type == J_STR && cl->str) clV = strtod(cl->str, NULL); else continue;
            used += (size_t)snprintf(out + used, outsz - used, "%s[%.0f,%.8g]", used > 12 ? "," : "", msV, clV);
        }
        snprintf(out + used, outsz - used, "]}");
    }
    json_free(&d);
    return bad ? -1 : 0;
}

/* one action: validate, fetch (the market host then the mirror), rebuild, answer */
static void crypto_run(const char *kind, const char *arg, size_t len) {
    if (strlen(arg) != len || !crypto_symbol_ok(arg, len)) { admin_err("crypto.badSymbol", NULL); return; }
    char pathq[128], dest[64];
    snprintf(pathq, sizeof pathq, "/api/v3/%s?symbol=%s", strcmp(kind, "ticker") == 0 ? "ticker/24hr" : "klines?interval=15m&limit=96", arg);
    snprintf(dest, sizeof dest, "/tmp/insane-crypto-%s.json", kind);
    if (crypto_fetch(pathq, dest, CRYPTO_MAX) != 0) { admin_err("crypto.noData", NULL); return; }
    static char body[CRYPTO_MAX + 1];
    FILE *f = fopen(dest, "rb");
    if (!f) { admin_err("crypto.noData", NULL); return; }
    size_t got = fread(body, 1, CRYPTO_MAX, f);
    fclose(f);
    body[got] = 0;
    char out[8192];
    int rc = strcmp(kind, "ticker") == 0 ? crypto_ticker_json(body, got, out, sizeof out) : crypto_klines_json(body, got, out, sizeof out);
    unlink(dest);
    if (rc != 0) { admin_err("crypto.badAnswer", NULL); return; }
    admin_say("OK", "%s", out);                         /* i18n-ok: parsed by sdk/crypto.js */
}

void hw_act_crypto_ticker(const AdminReq *r, const char *arg, size_t len) { (void)r; crypto_run("ticker", arg, len); }
void hw_act_crypto_klines(const AdminReq *r, const char *arg, size_t len) { (void)r; crypto_run("klines", arg, len); }
