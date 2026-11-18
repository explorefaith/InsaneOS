/* crypto_test.c — the pure parts of the Binance actions (phase 4, M5): the symbol charset, the
 * ticker field extraction from a real-shaped body (Binance sends numbers as strings), the klines
 * walk, and the failure paths (malformed JSON, missing fields). No network: fetch_batch is stubbed
 * (the fetch path is exercised by the live pass and the lab mock). */
#include <stdio.h>
#include <stdarg.h>
#include <string.h>
#include "../src/admin.h"
#include "../src/pkg/http.h"
#include "hw/hw_admin.h"

/* the stubs: the tested paths never fetch and never answer as the helper would —
 * admin_err is a macro here, so it is undefined before a capture function can exist */
#undef admin_err
void admin_err(const char *kind, ...) { (void)kind; }
void admin_say(const char *kind, const char *fmt, ...) { (void)kind; (void)fmt; }
int fetch_batch(FetchItem *items, int n, FetchProgress cb, void *ud) { (void)items; (void)n; (void)cb; (void)ud; return 0; }

int crypto_symbol_ok(const char *s, size_t n);
int crypto_ticker_json(const char *buf, size_t n, char *out, size_t outsz);
int crypto_klines_json(const char *buf, size_t n, char *out, size_t outsz);

int main(void) {
    int bad = 0;
#define CHECK(cond, what) do { if (!(cond)) { printf("✗ %s\n", what); bad++; } else printf("✓ %s\n", what); } while (0)

    /* the symbol charset */
    CHECK(crypto_symbol_ok("BTCUSDT", 7), "BTCUSDT accepted");
    CHECK(crypto_symbol_ok("XRPUSDT", 7), "XRPUSDT accepted");
    CHECK(!crypto_symbol_ok("btcusdt", 7), "lowercase rejected");
    CHECK(!crypto_symbol_ok("B", 1), "one character rejected");
    CHECK(!crypto_symbol_ok("BTCUSDTUSDTBTCUSDTUSDTX", 21), "over twenty rejected");
    CHECK(!crypto_symbol_ok("BTC-USDT", 8), "a dash rejected");
    CHECK(!crypto_symbol_ok("BTC USDT", 8), "a space rejected");

    /* the ticker: a real-shaped body — Binance sends the numbers as strings */
    char out[512];
    const char *body = "{\"symbol\":\"BTCUSDT\",\"lastPrice\":\"43210.5\",\"priceChange\":\"120.5\","
                       "\"priceChangePercent\":\"0.28\",\"highPrice\":\"43900\",\"lowPrice\":\"42800\","
                       "\"volume\":\"12345.6\"}";
    CHECK(crypto_ticker_json(body, strlen(body), out, sizeof out) == 0, "the ticker parses");
    CHECK(strstr(out, "\"symbol\":\"BTCUSDT\"") && strstr(out, "\"price\":43210.5"), "the ticker carries the fields");
    CHECK(strstr(out, "\"changePct\":0.28"), "the 24h percent carried");

    /* the failures */
    const char *malformed = "{\"symbol\":\"BTCUSDT\",\"lastPrice\":";
    CHECK(crypto_ticker_json(malformed, strlen(malformed), out, sizeof out) != 0, "malformed JSON refused");
    const char *nofields = "{\"foo\":\"bar\"}";
    CHECK(crypto_ticker_json(nofields, strlen(nofields), out, sizeof out) != 0, "a body without the fields refused");

    /* the klines: two rows, index 0 and 4 of each */
    const char *kl = "[[1700000000000,\"43000\",\"43500\",\"42900\",\"43210\",\"12.3\",1700000899999],"
                     "[1700000900000,\"43210\",\"44000\",\"43100\",\"43900\",\"9.9\",1700001799999]]";
    CHECK(crypto_klines_json(kl, strlen(kl), out, sizeof out) == 0, "the klines parse");
    CHECK(strstr(out, "[1700000000000,43210]") && strstr(out, "[1700000900000,43900]"), "the closes extracted");
    const char *klbad = "{\"no\":"; 
    CHECK(crypto_klines_json(klbad, strlen(klbad), out, sizeof out) != 0, "malformed klines refused");

    printf(bad ? "crypto-test: %d FAILURES\n" : "crypto-test: all checks passed\n", bad);
    return bad ? 1 : 0;
}
