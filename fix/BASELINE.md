# Baseline (BEFORE fix) — InsaneOS 0.8.8.5, faith-pc

## Boot #1 (Nov 09, uptime 6h18m at measurement)
- insane-server (PID 789): ~112% CPU sustained, 446 CPU-minutes total
- Thread pattern: main 60% + 6 threads @ 20-30% each (~200% total)
- Swap: 100% full earlier (Chrome tab leaked it), then 96% free after tab died
- Load avg: 9-11 (8 threads) | CPU temp: 88-95°C (B0D4 / x86_pkg_temp) → throttling

## Boot #2 (Nov 10, fresh boot, only ~10 min uptime at measurement)
- insane-server (PID 765): 90% main + 7 threads @ 20-30% ≈ 250-363% CPU
- CPU time already 7:55 (main) + ~4:00 x 7 (workers) within 10 min
- RAM: 6353MB/7754MB used, 225MB free, 1401MB avail (session restore pulled everything back)
- Swap: ~0 (fresh) | Load avg: 8.52 | CPU temp: 88°C again
- Conclusion: bug reproduces on every boot from the shell itself (render + IPC pollers)

## Files
- original bundle: /usr/lib/insaneos/themes/default/theme.bundle.js
  sha256 f5b08c77c45ddf619256c886d9e18dec9c8a50f6fc936510b91d993dcfb13a18
- patched bundle: theme.bundle.patched.js
  sha256 eabb8167a71785293f2db08477aadb7f83df6864dbc0417185cfb29d3991c27c

## Success criteria (measure after logout/login)
- insane-server steady-state CPU well below baseline (target: <50% sustained idle)
- CPU temp below ~70°C when idle
- No swap thrashing; zram active
