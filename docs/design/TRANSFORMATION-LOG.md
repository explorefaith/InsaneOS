# Transformation Log — Insane OS desktop experience

Working branch: `transform/desktop-experience` (off `stabilize/baseline` @
9dfcbce8). The stabilize branch keeps its own campaign; this branch carries
the desktop transformation. Reference: `docs/design/reference-video-analysis.md`
Plan: `docs/design/transformation-plan.md`

## 2026-11-18 — Session 1

- Full reference analysis: 74 frames sampled every 12 s across the whole
  14:49 video; audio profiled (−14.2 LUFS, continuous music, bass-heavy);
  spectrogram archived then deleted with the analysis scratch (kept the video
  itself in `refvideo/`).
- Optional repo visited (`shell-ninja/hyprconf-install` + the `hyprconf`
  dotfiles repo the video tours). Facts folded into the reference doc.
- Phase 1 audit done (architecture summary + gap list in the plan doc).
- Phase 2 plan written.
- **Increment 1 implemented, committed (34dfa088)**: `media.accentFrom(src)` +
  `image_decoded()` accessor in C (engine picture cache, no second decode, no
  home-bound media job); `media.accent(id)` for MediaSrc frames; shell Auto
  accent (settings default `auto`, tone-mapped per mode in tokens.js, violet
  fallback on older servers); Control Center accent pill chips with Auto;
  `settings.barStyle 'island'` — MenuBar as a centred floating pill, work-area
  and panel behaviour untouched; deeper charcoal dark surfaces; Settings
  bar-style picker with i18n in all 6 locales.
  Verified: headless lab (theme 2944 KB loads, testbench 314 frames @ 52 fps,
  zero react errors), probe saw `accent #211c40` from lumo-celestial with
  `barStyle island`; engine-test 8831/0, canvas-test, imgops-test clean.
  Note: two lessons — (1) `media_open_input` is home-bound, so asset: pictures
  must go through the engine cache, not the media pipeline; (2) in a
  sandboxed-per-call shell, scratch dirs under `/tmp` vanish between commands —
  the lab scratch lives in `~/.cache/`.
- **Increment 2 started**: real-audio spectrum (C) + desktop visualizer widget.

- **Increment 2 done, committed (ab07c888)**: C spectrum — `snd_spectrum(on)` keeps a 48 kHz
  mono record stream on the default sink's monitor only while a visualizer is mounted
  (rearmed on reconnect, cleared on kill), `snd_spectrum_bands` = Hann window + 1024-point
  radix-2 FFT + geometric fold into ≤64 bands; `insane.sound.spectrumOn/spectrum`;
  DesktopWidgets VisualizerCard (the reference's bottom-left card) — refcounted capture,
  ~22 Hz poll that re-renders only when the bands' quantized shape changes, so silence
  costs no frames. Verified: themes build (i18n gate), lab run 0 errors, headless control
  with zero widgets shows the 100% per-frame repaints are the headless driver's own.
  Lesson caught in the lab: a `useState` missing from the react import killed the shell
  ('useState' is not defined) — one frame, one react error line, fixed immediately.
