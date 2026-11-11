# Bug Report: insane-server sustained ~112% CPU from leaked 8ms IPC pollers

**Affected version:** InsaneOS 0.8.8.5 (theme bundle "Insane Flow", `theme.bundle.js` sha256 of original recorded at install time)
**Symptom:** `insane-server --headless 1280x800` burns ~110–120% of one core continuously from boot (observed: 446 CPU-minutes over 6h23m uptime), heating the CPU to 88–95°C and causing system-wide lag/thermal throttling.

## Root cause

The theme bundle's IPC layer uses response polling with two interval tiers per channel:

- Slow keep-alive poller: `setInterval(poll, 500–600ms)` — started once, by design never cleared (fine).
- Fast request poller: started at 8ms (vault/doc) or 12ms (mail) when a request is queued; cleared only when *every* pending entry resolves:

```js
// vault
C2.set(r,{resolve:i,reject:s}),GT||(GT=setInterval(IJ,8))
function IJ(){ ... !C2.size&&GT&&(clearInterval(GT),GT=null) }

// doc
Z2.set(`${e}:${t}`,{...}),O5||(O5=setInterval(ZTe,8))
function ZTe(){ ... !Z2.size&&!insane.doc.pending()&&O5&&(clearInterval(O5),O5=null) }

// mail
z2.set(n,{...}),ZT||(ZT=setInterval(WJ,12))
function WJ(){ ... !z2.size&&ZT&&(clearInterval(ZT),ZT=null) }
```

**The leak:** if any queued request never resolves (daemon stall, dropped response), or `insane.doc.pending()` never returns 0, the fast poller is never cleared and runs at **125 wakeups/sec indefinitely**. Each wakeup calls into `insane.vault.poll()` / `insane.doc.poll()` / `insane.mail.poll()`. On this system the fast pollers were observed running for hours.

## Suggested upstream fixes (in order of preference)

1. **Event-driven delivery** — expose a callback/subscription (`insane.vault.onResponse(cb)`) instead of polling; the pollers disappear entirely.
2. **Promise timeout** — reject entries in `C2/Z2/z2` after a sane deadline (e.g. 60s) so queues can't hold the fast poller open forever.
3. **Idle backoff** — if the fast poller has been alive >10s with no message delivered, reschedule at 50–60ms until activity resumes (this is what our workaround patch does).

## Workaround patch shipped here

`patch_theme.py` applies 6 surgical replacements to `theme.bundle.js`:
- records `lastActivity = Date.now()` at request-queue insert and on each delivered message batch
- after 10s of silence, reschedules the fast poller at 60ms; snaps back to 8/12ms on first message
- no change to API semantics, response payloads, or ordering

## Additional notes for the InsaneOS team

- Kernel is hitting **95°C** (B0D4 / x86_pkg_temp) under this load on an i5-8365U; the burn also causes thermal throttling system-wide.
- Binary exposes `INSANE_DAMAGE`, `INSANE_PIPELINE` (values `poll|multi|classic` seen in the string table) and `INSANE_FRAME_STATS` — documenting these would help users tune rendering CPU. If `insane-server` renders full frames when idle (no damage tracking), enabling damage tracking by default would further reduce idle CPU.
- Consider surfacing stuck IPC requests (e.g. `INSANE_DOC_DEBUG`) in a diagnostic log so leaked pollers are visible to users.
