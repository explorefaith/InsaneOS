/* cgweight_test.c — the cgroup service's verbs and the foreground-priority helpers (sec/cgroup.c):
 *   - "enter" keeps its four-field form and takes the new optional weight (both accepted);
 *   - "weight <scope> <1..10000>" is parsed, clamped and refused like the header says;
 *   - a bad verb, a bad scope name or a weight out of range is refused before any trust check;
 *   - the trust checks still run: the test process is not in a session's «server» leaf, so every
 *     well-formed request ends at "err not in the session leaf" (the placing itself is a root
 *     sessiond path, covered on a real session, not here);
 *   - cgroup_scope_of_pid on this very process: not an app scope (or, if the test itself was
 *     launched from one, the name it returns has the app scope's shape);
 *   - cgroup_weight without insane-sessiond: refused, never "applied". */
#include "../src/sec/cgroup.h"

#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/wait.h>
#include <unistd.h>

static int fails, checks;
#define CHECK(c) do { checks++; if (!(c)) { fails++; fprintf(stderr, "%s:%d: CHECK(%s) failed\n", __FILE__, __LINE__, #c); } } while (0)

/* The served side answers in the child; SO_PEERCRED on a socketpair sees the creds of the process
 * that created the pair (this one, before the fork), so the checks run against the test itself. */
static int ask(const char *req, char *rep, size_t n) {
    int sv[2];
    if (socketpair(AF_UNIX, SOCK_SEQPACKET | SOCK_CLOEXEC, 0, sv)) return -1;
    pid_t p = fork();
    if (p < 0) { close(sv[0]); close(sv[1]); return -1; }
    if (p == 0) {
        close(sv[1]);
        cgroup_place_serve(sv[0], "/usr/lib/insaneos/bin", 1);
        _exit(0);
    }
    close(sv[0]);
    rep[0] = 0;
    size_t ln = strlen(req);
    ssize_t s = send(sv[1], req, ln, 0);
    ssize_t r = s == (ssize_t)ln ? recv(sv[1], rep, n - 1, 0) : -1;
    close(sv[1]);
    int st;
    waitpid(p, &st, 0);
    return r > 0 ? (int)r : -1;
}

static void expect(const char *req, const char *want) {
    char rep[128];
    int r = ask(req, rep, sizeof rep);
    CHECK(r > 0 && !strncmp(rep, want, strlen(want)));
    if (r <= 0 || strncmp(rep, want, strlen(want)))
        fprintf(stderr, "  cgweight: \"%s\" answered \"%s\" (want \"%s…\")\n", req, r > 0 ? rep : "(none)", want);
}

int main(void) {
    char rep[128];
    /* well-formed requests reach the trust checks, which refuse this process */
    expect("weight app-insaneos-test.scope 400", "err not in the session leaf");
    expect("enter app-insaneos-test.scope 0 0 0", "err not in the session leaf");
    expect("enter app-insaneos-test.scope 0 0 0 400", "err not in the session leaf");
    expect("enter app-insaneos-test.scope 512 1024 200 50", "err not in the session leaf");
    /* malformed before any trust check */
    expect("weight app-insaneos-test.scope", "err request");
    expect("weight app-insaneos-test.scope 0", "err weight");
    expect("weight app-insaneos-test.scope 10001", "err weight");
    expect("weight app-insaneos-test.scope -5", "err weight");
    expect("enter app-insaneos-test.scope 0 0 0 10001", "err weight");
    expect("enter app-insaneos-test.scope 0 0", "err request");
    expect("bogus app-insaneos-test.scope 400", "err request");
    expect("weight ../escape.scope 400", "err request");
    expect("weight app-insaneos-lpk-x.scope 0", "err weight");
    /* the client helpers on this machine */
    CHECK(cgroup_weight("../bad.scope", 400) == -1);
    CHECK(cgroup_weight("app-insaneos-test.scope", 400) != 0);   /* no insane-sessiond here */
    CHECK(cgroup_weight("app-insaneos-test.scope", 0) == -1);
    CHECK(cgroup_weight("app-insaneos-test.scope", 10001) == -1);
    /* this test process: not an app scope — or, launched from one, a well-shaped name */
    int in_scope = cgroup_scope_of_pid(getpid(), rep, sizeof rep);
    if (!in_scope) CHECK(!strncmp(rep, "app-insaneos-", 13) && !strcmp(rep + strlen(rep) - 6, ".scope"));
    else CHECK(in_scope == -1);
    printf("cgweight-test: %d checks, %d fails\n", checks, fails);
    return fails ? 1 : 0;
}
