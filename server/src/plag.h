/* plag.h — pointer latency trace (like keylag.h for keys, privacy rules here).
 *
 * With INSANE_INPUT_DEBUG=1 (insane-sessiond sets it for a debug session, never the login screen)
 * every pointer motion batch is timed through three stages, in microseconds after the kernel's own
 * evdev timestamp:
 *
 *   stage 1  evdev → read       the loop reached the device (busy or preempted before it)
 *   stage 2  read → dispatch    the coalesced batch reached JS and the Wayland clients
 *   stage 3  dispatch → flip    the main display's next completed page flip (the first chance
 *                               the pointer's state had to reach the screen)
 *
 * Every 5 s one line of percentiles (p50/p95/p99/max) per stage goes to
 * $XDG_RUNTIME_DIR/insaneos-pointerlag.log (0600), never the session log: timestamps only,
 * no content, like keylag. Batches whose flip paired with a later dispatch are dropped (the
 * latest state is the one the flip shows); a wheel-only or button-only batch is not traced.
 */
#ifndef INSANE_PLAG_H
#define INSANE_PLAG_H
#include <stdint.h>
#include <sys/time.h>

void plag_init(int greeter);
int  plag_enabled(void);
void plag_event(const struct timeval *tv);  /* a SYN_REPORT that moved the pointer */
void plag_dispatch(void);                   /* the batch reached dispatch_pointer */
void plag_presented(uint64_t flip_ns);      /* the main display's flip completed */
void plag_flush(void);                      /* every main-loop pass: writes at its own pace */
#endif
