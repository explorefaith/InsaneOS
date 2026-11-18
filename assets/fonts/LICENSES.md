# Font licenses

All fonts bundled here are redistributed under their own free licenses; none are modified.

| Files | Family | License | Source |
|---|---|---|---|
| Inter-*.ttf | Inter | SIL Open Font License 1.1 | rsms.me/inter |
| JetBrainsMono-*.ttf | JetBrains Mono | SIL Open Font License 1.1 | jetbrains.com/mono |
| PlusJakartaSans-*.ttf | Plus Jakarta Sans | SIL Open Font License 1.1 | tokotype.github.io/PlusJakartaSans |
| NotoSerifDisplay-*.ttf | Noto Serif Display | SIL Open Font License 1.1 (C)n Google LLC | fonts.google.com/noto |
| NotoSansDisplay-*.ttf | Noto Sans Display | SIL Open Font License 1.1 (C)n Google LLC | fonts.google.com/noto |
| LiberationSansNarrow-*.ttf | Liberation Sans Narrow | SIL Open Font License 1.1 | github.com/liberationfonts |
| DejaVuSansCondensed-*.ttf, DejaVuSerifCondensed-*.ttf | DejaVu (Condensed) | Bitstream Vera license + public domain additions (free, redistributable) | dejavu-fonts.github.io |

The Theme Studio families are loaded by file name on first use (`font_for` in
`server/src/ui/text.c`): `serif` → Noto Serif Display, `display` → Noto Sans Display,
`narrow` → Liberation Sans Narrow, `compact` → DejaVu Sans Condensed, `book` → DejaVu
Serif Condensed. Weights 400/700 per family, with the italic pair where the table has one.
