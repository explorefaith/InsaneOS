# INSANE OS — Phase 2 test results

Everything below ran for real on 2026-11-19; commands and counts are quoted. "Manual (live
desktop)" items are listed honestly at the bottom — the headless lab renders but has no pointer.

## Automated (node, no display needed)

| Suite | Result |
|---|---|
| tests/theme_studio_model_test.mjs | 111 checks passed |
| tests/theme_studio_store_test.mjs | 60 checks passed (against the real settings store) |
| tests/theme_studio_themes_test.mjs | 1503 checks passed, 26 themes (in-bounds, no self-overlaps, real wallpapers/fonts/kinds) |
| tests/theme_studio_specs_test.mjs | 1241 checks passed, 105 kinds, 76 providers |
| tests/widgetmodel_test.mjs | 9 checks passed |
| tests/autohide_model_test.mjs | 689/689 checks passed |
| tests/paneglyph_test.mjs | green (run with i18n-check's suite) |

## Localization and error codes

- `node tools/i18n-check.mjs`: es/fr/it/pt 12098/12098 keys; lt partial 9.7 % (its documented
  state); err-check: 585 codes in the server, 0 problems; brand-check: ok.

## Build

- `node tools/build-theme.mjs default`: exit 0, 3026 KB bundle, code-manifest unchanged.

## Headless compositor lab (INSANE_HEADLESS_RENDER=1 + insaneos-testbench)

Recipe: memory `compositor-lab-profiling` (scratch HOME under ~/.cache/insane-lab, PID-file kill).

| Run | Configuration | Result |
|---|---|---|
| L1 | benchSection 'themes' + themeStudio.active 'acid-press' (pre-fix) | 2 react errors: 'wallpaperThumb'/'tsResolvePlan' is not defined → fixed (missing imports) |
| L2 | same, post-fix | 0 errors; 1461 frames, 55.8 fps |
| L3 | after the 105-kind factory | 0 errors, 0 missing-renderer/provider assertions; 737 frames, 46.5 fps |
| L4 | after audit round 1 (30 fixes) | 0 errors; paint 9.6–12.6 ms per full-frame headless render |
| L5 | after the Studio canvas + rich text + Control Center rounds | 0 errors |

## What the lab cannot prove (manual on the live desktop, after upgrade-insaneos.sh)

1. Apply each of the 26 themes; watch wallpaper/mode/accent/widgets land live (no restart).
2. Remove/add/hide a widget from the Themes page; watch the desktop follow immediately.
3. Drag a block in the Live preview; watch the real desktop move it.
4. Reboot; confirm the theme, its overrides and the presets survive.
5. The classic Widgets page's own flows still work after the suppression guard (deactivate a
   Studio theme → the classic cards come back).
6. Control Center: the vertical sliders against real hardware (volume sink, backlight), the
   capture tiles opening the screenshots/recorder apps, DND actually silencing notifications.
7. Weather consent flow from a widget's Allow link.
8. Rich text: style segments on a Label, verify the desktop widget reflows live.

## Regression guards added this phase

- tests/theme_studio_specs_test.mjs fails when a kind, variant, provider or theme kind drifts.
- The renderer asserts variant/provider coverage at load (a loud console error in the lab log,
  never a silent blank card).
- persistWidgets carries its scheduled state (a theme switch can no longer steal a pending write)
  and tsPersistFlush exists for tests.
