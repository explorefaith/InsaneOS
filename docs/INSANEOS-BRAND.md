<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/svg/logo-horizontal-dark.svg">
    <img src="brand/svg/logo-horizontal-light.svg" alt="Insane OS" height="96">
  </picture>
</p>

# Insane OS brand identity

This document describes the Insane OS identity: the logo, its colours, its typefaces and how to use
them. The file index (every SVG, PNG and favicon, and how they are generated) is in
[`brand/README.md`](brand/README.md). All the files come from `tools/gen-brand-insane.py`. Don't edit
the renders by hand.

## 1. What Insane OS is

Insane OS is a free, fast and secure GNU/Linux distribution based on Debian, with a desktop environment of
its own, built from its fundamental components on top of Debian and Wayland. It has its own display server and Wayland compositor written in C and
its own React-based interface engine, the whole system idles at 465–487 MB of RAM (measured once,
live ISO and installed, in a VM; `insane-server` 32–36 MB RSS at idle; the paper's §7.1), and it brings a Dock, an app launcher, a menu bar, instant search and polished
native apps to PCs and to the Raspberry Pi 5, while still running regular Linux applications. The
apple stands for a desktop where the user rules: fast, private and fully under their control.

## 2. The logo

The logo is an orange apple — body, stem and leaf — with an amber heart (a radial gradient from
amber through brand orange to deep orange) and a soft gloss on the shoulder. Next to it is the
wordmark **Insane OS**.

### App icon

<img src="brand/svg/app-icon.svg" alt="App icon" width="128"> <img src="brand/png/app-icon-64.png" alt="App icon, 64 px" width="64"> <img src="brand/png/app-icon-32.png" alt="App icon, 32 px" width="32"> <img src="brand/png/app-icon-16.png" alt="App icon, 16 px" width="16">

The apple on a warm dark rounded square (22 % corner radius). It is the
system's own icon (About, Settings → General, the Dock, Monitor, Help). Outside Insane OS, use it for
store listings, avatars and anywhere a square mark is needed. File: `brand/svg/app-icon.svg`, PNGs
from 16 to 1024 px in `brand/png/`.

### Apple symbol

<img src="brand/svg/apple.svg" alt="Apple" width="128">

The apple alone on a transparent background. Use it when the name is already nearby: splash
screens, section headers, stickers. File: `brand/svg/apple.svg`, `brand/png/apple-{256,512}.png`.

### Horizontal logo

| On light | On dark |
|---|---|
| <img src="brand/svg/logo-horizontal-light.svg" alt="Horizontal logo, light" width="320"> | <img src="brand/svg/logo-horizontal-dark.svg" alt="Horizontal logo, dark" width="320"> |

The apple with the wordmark, on a transparent background. It's the main logo for websites, documents,
the README and presentations. Use the light version (navy text) on light backgrounds and the dark
version (white text) on dark ones. On the web, switch between them with `<picture>` and
`prefers-color-scheme`. Files: `brand/svg/logo-horizontal-{light,dark}.svg`,
`brand/png/logo-horizontal-{light,dark}-{400,800}.png` (1x and 2x).

### Monochrome

| Black | White |
|---|---|
| <img src="brand/svg/logo-mono-black.svg" alt="One-colour logo, black" width="320"> | <img src="brand/svg/logo-mono-white.svg" alt="One-colour logo, white" width="320"> |

A flat, single-colour version: the whole silhouette filled. Use it for print, engraving,
embroidery, small sizes and on photos or busy backgrounds where the full-colour apple would get
lost. Files: `brand/svg/logo-mono-{black,white}.svg`, `brand/svg/apple-mono.svg`.

### Small variants

<img src="brand/svg/app-icon-small.svg" alt="Small app icon" width="32"> <img src="brand/svg/app-icon-small.svg" alt="Small app icon, 16 px" width="16"> &nbsp; <img src="brand/svg/apple-mono-small.svg" alt="Small one-colour apple" width="32"> <img src="brand/svg/apple-mono-small.svg" alt="Small one-colour apple, 16 px" width="16">

The icon and the one-colour apple are redrawn on a pixel grid (32 px and 16 px), with fewer details,
so they stay sharp where the detailed versions would blur. Use `app-icon-small.svg` from 16 to 32 px
and `apple-mono-small.svg` for 12–20 px glyphs. In the OS, the menu bar logo is the small apple in
the menu text colour:

<img src="brand/screenshots/menubar-glyph-3x.png" alt="Menu bar glyph on light and dark" width="480">

### Favicon

<img src="brand/favicon/favicon.svg" alt="Favicon" width="32"> <img src="brand/favicon/apple-touch-icon-180.png" alt="Home screen icon" width="60">

`brand/favicon/favicon.svg` (the pixel-grid icon) for browser tabs, with `favicon-32.png` as a
fallback, `apple-touch-icon-180.png` for phone home screens and `favicon-512.png` for a web app
manifest. The HTML is in [`brand/README.md`](brand/README.md).

### Social card

<img src="brand/png/social-card-1200x630.png" alt="Social card" width="600">

1200 × 630: the white lockup on the brand's orange gradient. Use it for link previews (`og:image`) and
social posts. Files: `brand/svg/social-card.svg`, `brand/png/social-card-1200x630.png`.

### In the system

| About (light) | Login screen |
|---|---|
| <img src="brand/screenshots/about-light.png" alt="About Insane OS, light" width="420"> | <img src="brand/screenshots/greeter.png" alt="Login screen" width="420"> |

The two desktop styles carry the brand's name since 0.8.5: **Insane Flow** (menu bar and Dock, formerly
Insane Default) and **Insane Classic** (taskbar and start menu, formerly Classic), in every language. In a
terminal, `insaneos-fetch` (0.8.5) draws the apple in the brand colours beside a summary of the computer
(true colour when the terminal says so, plain ASCII without colour).

## 3. Colours

| | Hex | Role |
|---|---|---|
| <img src="brand/swatches/violet-light.svg" width="64" alt=""> | `#FFB24A` | Amber heart: the apple gradient's core |
| <img src="brand/swatches/apple-lavender.svg" width="64" alt=""> | `#F7701C` | Brand orange: the apple gradient's mid — the brand colour |
| <img src="brand/swatches/indigo.svg" width="64" alt=""> | `#C43A08` | Deep orange: the apple gradient's edge |
| <img src="brand/swatches/icon-gradient.svg" width="64" alt=""> | `#FFB24A → #C43A08` | The brand gradient, radial |
| <img src="brand/swatches/gem-yellow.svg" width="64" alt=""> | `#FFD60A` | Gem yellow — Lumo's cape clasp only |
| <img src="brand/swatches/navy.svg" width="64" alt=""> | `#12122A` | Navy: the wordmark and text on light backgrounds |
| <img src="brand/swatches/white.svg" width="64" alt=""> | `#FFFFFF` | White: the wordmark on dark backgrounds, the apple on the icon |

- **On light backgrounds:** the full-colour apple with the navy wordmark (`logo-horizontal-light`),
  or the black one-colour logo.
- **On dark backgrounds:** the full-colour apple with the white wordmark (`logo-horizontal-dark`),
  or the white one-colour logo.
- **On the brand gradient:** the dark logo (white text), as in the social card.
- In the OS the wordmark follows the theme: navy in light mode, white in dark mode.

## 4. Typography

- **Wordmark: Plus Jakarta Sans.** "Insane OS" in ExtraBold (800), with a normal word space. SIL
  Open Font License 1.1 (release 2.7.1, github.com/tokotype/PlusJakartaSans). The font ships in
  `assets/fonts/` with its license. In the OS the wordmark is live text in this face
  (`fontFamily: 'brand'`, the `InsaneWordmark` component). In the SVGs it is outlined from the same
  file (a TrueType parser in the generator), so they don't need the font installed.
- **Interface: Inter.** All UI text (Regular 400, Medium 500, SemiBold 600, Bold 700). SIL Open Font
  License 1.1. Code and the terminal use JetBrains Mono.

Plus Jakarta Sans is only for the name "Insane OS" (and, if needed, short headlines next to it), never
for body text.

## 5. Usage

### Clear space

Keep free space around the logo at least as large as **half the wordmark's cap height**. Around the
app icon, keep 10 % of its size. No text, edges or other marks go inside it. In the lockup the apple is
about two and a half times the cap height, centred on the text, about half a cap height from it. Use
the files as they are.

### Minimum sizes

| Version | Minimum |
|---|---|
| Horizontal logo | 96 px wide (24 mm in print); below 120 px prefer the one-colour version |
| App icon | 16 px (`app-icon-small.svg` up to 32 px) |
| Apple, full colour | 24 px |
| Apple, one colour | 12 px (`apple-mono-small.svg`) |
| Live wordmark in the UI | 13 px font size |

### Do

- Use the provided files and the generator. Pick light or dark by the background.
- Give the logo its clear space and keep the apple on the left of the name, also in right-to-left
  languages.
- Use the one-colour versions on photos, in print and at small sizes.
- Use the small variants at 32 px and below.

### Don't

- Don't stretch, skew, rotate or re-proportion the logo, or move the apple to another side.
- Don't recolour the apple or swap its gradient for flat colour, or put the logo on clashing colours.
- Don't set "Insane OS" in another font or weight, remove the space ("InsaneOS") or change the case
  ("INSANE OS", "Insaneos").
- Don't add outlines, drop shadows, glows, bevels or textures (the app icon's soft shadow is part
  of it).
- Don't use the light logo on dark backgrounds or the dark logo on light ones.
- Don't trace or rebuild the logo from screenshots or raster images. Change `tools/gen-brand-insane.py`
  and regenerate.

## 6. Lumo, the guardian of Insane OS

Lumo, the guardian of Insane OS: a small celestial fox with white fur and violet highlights, who wears
an apple and a cape as symbols of protection, freedom and control.

**Anatomy:**

- big, pointed fox ears;
- abundant, fluffy white fur, like an arctic fox;
- a short, fluffy, slightly curved tail;
- a round, kitten-like face with big, expressive eyes;
- a small, compact fantasy-creature body.

Lumo is curious by nature and loyal by design: a small guardian for a greater tomorrow. It
watches over the system quietly and shows up only when there is something worth a little warmth:
a welcome, a job well done, a moment of calm, or a gentle hand when something goes wrong.

| Front | Three-quarter | Back | Avatar |
|:-:|:-:|:-:|:-:|
| ![Lumo, front view](brand/mascot/png/lumo-front-512.png) | ![Lumo, three-quarter view](brand/mascot/png/lumo-three-quarter-512.png) | ![Lumo, back view](brand/mascot/png/lumo-back-512.png) | ![Lumo avatar](brand/mascot/png/lumo-avatar-256.png) |

The head is big and the body small. The Insane OS apple sits on top of the head, with a small
three-lobed tuft of fur in front of its stem. The violet capelet is fastened at the neck with a
yellow gem and leaves the round white belly in view; from the back it shows a four-point star.

### Poses

| Pose | Name | Meaning | Where Insane OS uses it |
|:-:|---|---|---|
| ![Lumo waving](brand/mascot/png/lumo-wave-512.png) | `lumo-wave` | Hello, welcome | The installer's welcome step and the first page of the first-login tour (Help) |
| ![Lumo with a shield](brand/mascot/png/lumo-shield-512.png) | `lumo-shield` | Protected, all good | Monitor → Network when the firewall is on and nothing was blocked |
| ![Lumo running](brand/mascot/png/lumo-run-512.png) | `lumo-run` | Speed, work in progress | Brand material for speed and downloads |
| ![Lumo sleeping](brand/mascot/png/lumo-sleep-512.png) | `lumo-sleep` | Rest, energy saving, idle | Brand material for energy saving and idle |
| ![Lumo celebrating](brand/mascot/png/lumo-celebrate-512.png) | `lumo-celebrate` | Done, success | Store → Updates when everything is up to date |
| ![Lumo confused](brand/mascot/png/lumo-confused-512.png) | `lumo-confused` | Something went wrong, nothing here | Error and "not available" states (Calendar, Contacts, Reminders, Logs, Disks, Help, the Store's package engine) |

In Insane OS (real sessions on the test VM, light and dark):

| First-login tour (Help) | Installer | Service not available | About |
|:-:|:-:|:-:|:-:|
| ![Welcome tour with Lumo waving](brand/mascot/screens/help-welcome-light.png) | ![Installer welcome with Lumo waving](brand/mascot/screens/installer-welcome-light.png) | ![Calendar not available, Lumo confused](brand/mascot/screens/calendar-unavailable-dark.png) | ![About with the Lumo avatar](brand/mascot/screens/about-dark.png) |

In the UI, `<Lumo pose="..." size={...} />` (sdk/mascot.js) or `<EmptyState mascot="confused" />`
draws a pose; `<Lumo pose="avatar" size={20} />` draws the avatar (About). One Lumo per view at most,
in outcome states, never in "nothing selected" panes.

### Palette

| Colour | Hex | Use |
|---|---|---|
| Outline | `#2A2366` | thin dark-indigo outline (3.4 px on silhouettes, 2.2 px inside, on a 512 canvas) |
| Fur | `#FFFFFF` → `#E9E4FF` → `#7C78EE` | white face and belly, lavender shading, periwinkle tufts |
| Violet highlights | `#7C5CFF` | ear tips, tail tip, cape |
| Cape | `#7C5CFF` → `#5B3FE0` | capelet gradient; lining `#4C31C9` → `#3B24A6`; sheen `#9B6BFF` |
| Eyes | `#0B0833` → `#3A2BA0` | irises, violet rim light below, white highlights |
| Paws | `#5550C8` → `#2E2984` | dark-indigo paws with toe lines |
| Blush and mouth | `#FF8FAB`, `#B42E55`, `#FF8098` | cheeks, mouth, tongue |
| Gems | `#FFF1A8`, `#FFD60A`, `#FFC300`, `#FFB000`, `#FFE45C` | the apple's and the clasp's facets |

### Do's and don'ts

- Do use the files in `assets/brand/mascot/` or their renders; change `tools/gen-mascot.py` or
  `assets/brand/mascot/src/lumo-parts.svg` and regenerate, so every pose stays the same character.
- Do keep Lumo small and occasional: one per view, in welcome, success, security and error states.
- Do keep the outline: it is what makes Lumo read on dark backgrounds.
- Don't distort, stretch, rotate or crop Lumo (the avatar is the only crop).
- Don't recolour the apple or its gems; it is the Insane OS apple.
- Don't change the cape's colour: it stays violet.
- Don't give Lumo a long snout, a long tail or a big body; don't make it look like another
  project's mascot.
- Don't trace or rebuild Lumo from raster images or screenshots.

## 7. Wallpapers

Created by iPERFEX with an AI image generator; part of the Insane OS brand assets.
© iPERFEX, part of the Insane OS brand.

Eleven original wallpapers in three categories, shipped in `/usr/share/backgrounds/insaneos/` and
listed by category in **Settings → Wallpaper** (with the Insane Flow theme's four gradients as a fourth
category, "Gradients"). The files, sizes and how to regenerate them are in
[`assets/wallpapers/README.md`](../assets/wallpapers/README.md).

| | Signature | |
|:-:|:-:|:-:|
| ![Crystal Apple](../assets/wallpapers/thumbs/signature/insaneos-crystal-apple.jpg)<br>**Crystal Apple** (login screen) | ![Eternal Dawn](../assets/wallpapers/thumbs/signature/insaneos-eternal-dawn.jpg)<br>**Eternal Dawn** | ![Royal Flow](../assets/wallpapers/thumbs/signature/insaneos-royal-flow.jpg)<br>**Royal Flow** |
| ![Royal Waves](../assets/wallpapers/thumbs/signature/insaneos-royal-waves.jpg)<br>**Royal Waves** | ![Violet Horizon](../assets/wallpapers/thumbs/signature/insaneos-violet-horizon.jpg)<br>**Violet Horizon** | |

| Lumo | |
|:-:|:-:|
| ![Celestial](../assets/wallpapers/thumbs/lumo/insaneos-lumo-celestial.jpg)<br>**Celestial** (default desktop) | ![Aurora](../assets/wallpapers/thumbs/lumo/insaneos-lumo-aurora.jpg)<br>**Aurora** |

| | Cosmos | | |
|:-:|:-:|:-:|:-:|
| ![Event Horizon](../assets/wallpapers/thumbs/cosmos/insaneos-event-horizon.jpg)<br>**Event Horizon** | ![Infinite Galaxy](../assets/wallpapers/thumbs/cosmos/insaneos-infinite-galaxy.jpg)<br>**Infinite Galaxy** | ![Solar Odyssey](../assets/wallpapers/thumbs/cosmos/insaneos-solar-odyssey.jpg)<br>**Solar Odyssey** | ![Stellar Voyage](../assets/wallpapers/thumbs/cosmos/insaneos-stellar-voyage.jpg)<br>**Stellar Voyage** |

- **Defaults:** new users start on **Celestial** (Lumo); the login screen and the remote login page
  use **Crystal Apple**. Users who already chose a wallpaper keep it.
- **Size:** the originals are 1672×941. They ship as high-quality JPEG (about 4 MB for all eleven
  instead of 23 MB of PNG) with 320×180 thumbnails for the pickers. On 4K screens they look soft;
  a `insaneos-<name>@3840x2160` version added to the collection is picked automatically on screens
  that need it.
- **License and provenance:** iPERFEX created the images with an AI image generator; they are
  not hand-drawn. They ship under the repository's terms (MIT) like
  the rest of the brand kit, and the name, apple and Lumo in them fall under the trademark and brand
  policy. AI-generated images may get limited copyright protection in some countries; the
  trademark policy still applies.
- **Lumo pieces:** Celestial and Aurora are an artistic interpretation of the celestial fox, with a
  long flowing tail. They don't replace the mascot drawings in section 6; for Lumo in the interface,
  use the brand kit.
- **Do** use them as desktop, login and promotional backgrounds for Insane OS, with the logo on top
  following section 5.
- **Don't** crop the apple out of Crystal Apple for use as a logo, or present them as another
  project's artwork.
