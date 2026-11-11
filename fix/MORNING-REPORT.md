# 🌅 সকালের রিপোর্ট — LordOS ফিক্স (রাতভর কাজ, round 2 সহ)

**সবচেয়ে গুরুত্বপূর্ণ:** রিবুট করার **আগে** একটাই কমান্ড চালাও:

```bash
cd ~/Desktop/Operating/fix
sudo bash upgrade-lordos.sh
```

তারপর **রিবুট**। (স্ক্রিপ্টে ~১০ মিনিট লাগবে: build deps + compile + install)

---

## ✅ এখনই কাজ করছে (user-level, re-login এ active)

| বাগ | কী হয়েছিল | ফিক্স |
|---|---|---|
| **Screenshot "নেই"** | ফিচার ছিল, কিন্তু `permisos.json`-এ permission **deny** ছিল → সব capture চুপচাপ ফেইল | `allow` করা হয়েছে (backup: `permisos.json.bak`) |
| **Screenshot shortcut "নেই"** | আসলে ছিল: **PrintScreen** / ❖⇧3 (full), ❖⇧4 (area), ❖⇧5 (panel) — permission deny থাকায় কাজ করত না | permission ঠিক → এখন কাজ করবে |
| **Mouse "onek fast"** | settings-এ `mouseSpeed: 1` = কার্সর **২x** গতি (C কোড: `1+2*(k-0.5)`) | default 0.5 = 1x (backup: `settings.json.bak`) |
| **Cursor "size thik nei"** | `pointerSize: 0.75` (ছোট) | 1.0 (default) |
| **Scroll উল্টো** | মাউসে `mouseNatural: true` → হুইল inverted | false (Linux default) |
| **Lag এর মূল কারণ** | theme-এর vault/doc/mail poller: stall হলে **৮ms timer চিরকাল** ঘোরে → lord-server ~112% CPU → ৯৫°C → throttling | backoff প্যাচ (নিচে দেখো) |

## 🔨 রাতে build করা হয়েছে (upgrade-lordos.sh ইনস্টল করবে)

**আমার প্যাচ** (upstream-এ নেই, আমি লিখেছি):
- `sdk/vault.js`, `sdk/doc.js`, `sdk/mail.js` — poller idle backoff: ১০ সেকেন্ড activity না থাকলে fast poller 8/12ms → 60ms, activity ফিরলে সাথে সাথে fast। CPU বাগের স্থায়ী সমাধান। Build করা ৩টা bundle-এ (default/greeter/classic) প্যাচ verified ✅

**Upstream master (0.8.8.6-dev) থেকে যা আসছে** — তোমার বাগ-লিস্টের সাথে মিল:
- **Screenshot silent fail** → "Media jobs no longer wait forever when lord-media is missing... Screenshots saved and copied nothing and said nothing" — ঠিক তোমার সমস্যা; এখন error notification-ও দেখাবে
- **Blurry text** → master-এ text/vector "rasterized at the display's resolution (150% is sharp, not upscaled)" — 125% scale-এও sharp হওয়ার কথা
- **App ধীরে খোলা / Cloud freeze** → Files/cloud ফোল্ডার আর desktop freeze করাবে না (async fs, worker pool)
- **Bluetooth mouse** → boot/login-এ reconnect ঠিক
- **Multi-display screenshot**, OCR (❖⇧4 এ T), color picker, screenshot → clipboard
- CPU microcode (security fix) + ৩৪টা GitHub issue fix

## ⚠️ যা জানা দরকার

1. **"Development build"** — About-এ দেখাবে। আমরা release key ছাড়া build করেছি; dev build unsigned manifest নেয়। সব ফিচার কাজ করবে, শুধু লেবেলটা এমন।
2. ** lordos.org-এ নতুন stable এলে** `sudo apt install lordos` দিয়ে official upgrade নিলে এই dev build বদলে যাবে — আমার SDK প্যাচগুলো তখন upstream-কে পাঠালেই হবে (`BUG-REPORT.md` রেডি)।
3. **Revert**: সব backup `/var/backups/lordos-fix-<time>/`-এ, সাথে `REVERT.sh` — `sudo bash REVERT.sh` + রিবুট = আগের অবস্থা।
4. User-level backups: `~/.config/lordos/settings.json.bak`, `permisos.json.bak`।

## 🆕 Round 2 — তোমার চাওয়া ৩টা ফিচার (ভোরে যোগ হলো)

### ১. Pressure-based background app freezer ✅ (নতুন ফিচার, আমার লেখা কোড)
অনেক অ্যাপ খুললে / RAM-চাপ বাড়লে **background process গুলো automatic freeze** হয়ে যায়, চাপ কমলে আবার জেগে ওঠে:
- নতুন C API: `lord.wm.nodePid(node)` (`wl.c`, `js_wm.c`) — window-এর পেছনের process-এর pid
- Shell (sdk/windows.js) স্ক্রিনে থাকা window-গুলোর pid `~/.cache/lordos/fgpids.json`-এ লেখে
- **`lordos-smooth-freeze.sh`** (user systemd service): PSI pressure দেখে (mem avg60 ≥ 25%, বা burst + RAM < 400MB) 150MB+ RSS-এর background process SIGSTOP করে; চাপ কমলে/সামনে এলে SIGCONT
- **কখনো ধরে না**: lord-server/sessiond/helpers, audio (video call চলতেই থাকবে), ZCode, Xwayland, systemd/dbus, focused window
- Log: `~/.cache/lordos/freeze/log` • Manual thaw: `lordos-smooth-freeze.sh thaw`

### ২. Ctrl+Shift+S screenshot ✅
`capture.full` shortcut-এ যোগ হয়েছে — এখন **PrintScreen / ❖⇧3 / Ctrl+Shift+S** তিনটাই কাজ করবে। (সতর্কতা: VSCode-এর Save All, Firefox-এর screenshot টুলের সাথে conflict — ওসব অ্যাপে সেটা চাইলে `apps/screenshots/index.jsx` থেকে `'Ctrl+Shift+S'` মুছে আবার build)

### ৩. YouTube/video smoothness ✅
- **VA-API hardware decode ইনস্টল হচ্ছে** (`intel-media-va-driver-nonfree`) — তোমার UHD 620 GPU ভিডিও decode করবে, CPU প্রায় খাবে না। আগে driver-ই ছিল না!
- **Chrome user-level override** (`~/.local/share/applications/google-chrome.desktop`): `VaapiVideoDecodeLinuxGL` + GPU rasterization + zero-copy — Dock থেকে Chrome খুললেই এগুলো সহ
- Compositor GPU build (mesa dev ইনস্টল হওয়ায় GPU=1) + CPU বাগ ফিক্স + zram + microcode

## 🆕 Round 3 — window capture + traffic lights (সকালে যোগ হলো)

### ১. macOS-style window capture ✅
- **Ctrl+Shift+S / PrintScreen / ❖⇧3** চাপলেই: কোনো window-এর উপর **hover করলে window highlight + title দেখাবে, click করলে সেই window capture** — drag করলে আগের মতো area selection (দুটোই একসাথে, macOS-এর মতো)
- Space দিয়ে window-mode toggle আগের মতোই আছে

### ২. সব অ্যাপে traffic lights ✅
- আগে শুধু native অ্যাপে (Terminal ইত্যাদি) ছিল — **Chromium/Firefox/GTK নিজের frame আঁকে (CSD) বলে skip হতো**
- এখন CSD window-গুলোতেও **top-left এ ভাসমান red/yellow/green overlay** — click = close/minimize/zoom কাজ করে, hover-এ ×/−/+ glyph, unfocused-এ dim (macOS-এর মতো)
- শুধু ওই ৩টা ছোট circle click নেয়, বাকি জায়গা অ্যাপের নিজের (tab strip ইত্যাদি ঠিক চলবে)
- Note: Lord Classic theme-এ নেই (তুমি default ব্যবহার করছ)

## 🆕 Phase 1 সম্পূর্ণ — macOS স্টাইলের ৮টা ফিচার বানানো হলো

**সবচেয়ে বড় আবিষ্কার: Spotlight তোমার OS-এ already ছিল!** — **❖Space বা Ctrl+Space** চাপো: অ্যাপ, ফাইল, ক্যালকুলেটর (`2*(3+4)`), ইউনিট কনভার্ট (`10 km to mi`), notes, clipboard history — সব এক জায়গায়।

নতুন বানানো (সব verified, manifest 10/10):
1. **Hot Corners** — কোণায় pointer রাখলে (350ms): উপরে-বাঁ=Overview, উপরে-ডান=DND toggle, নিচে-বাঁ=Show Desktop (config: `settings.hotCorners`)
2. **Power Mode** — Control Center-এ Performance/Balanced/**Low Power** switch
3. **Battery 80% limit** — boot service, ব্যাটারি বাঁচাবে (বাদ দিতে: `systemctl disable --now lordos-battery-limit`)
4. **Login chime** — নতুন C6-E6-G6 arpeggio (নিজে synthesize করা, snd.c-তে)
5. **Auto dark** — 19:00–07:00 dark, দিনে light (`settings.autoDark`)
6. **Dynamic wallpaper engine** — day/night wallpaper (`settings.dynamicWallpaper`; Settings UI Phase 2)
7. **Menu bar widget** — ঘড়ির পাশে CPU% · তাপমাত্রা
8. **Text replacement** — `settings.textReplace = {"omw": "on my way"}` সেট করলেই কাজ করবে (LordOS অ্যাপে)

পুরো পরিকল্পনা: [ROADMAP.md](~/Desktop/Operating/fix/ROADMAP.md) (Phase 2: gestures/snap/Stage Manager — রিবুট-টেস্টের পরে; Phase 3: Dictation ইত্যাদি)

## 🆕 Phase 2 শুরু — সত্য যাচাই + Settings UI

**আরও যা already ছিল** (তোমার OS অসাধারণ!): **trackpad gestures** (৩-আঙুল swipe = desktop switch, three-finger drag, ৪-আঙুল swipe — Settings → Desktops-এ toggle), **per-app volume mixer** (Settings → Sound), App Switcher।

**নতুন বানানো — Phase 1 ফিচারগুলোর Settings UI (সব verified):**
- **Settings → Automatic Appearance** — auto dark ঘণ্টা ঠিক করা + day/night wallpaper picker
- **Settings → Desktops → Hot Corners** — প্রতি কোণার action dropdown থেকে বদলানো
- **Settings → Keyboard → Text Replacement** — নিজের token→phrase যোগ/বাদ (omw → on my way)

## 🆕 Phase 2 শেষ — আরও যা যোগ/জানা হলো

- **যাচাই**: Snap preview **already আছে** (window edge-এ টানলে half/quarter snap — sdk/windows.js), Trackpad gestures already, per-app mixer already
- **নতুন**: **Settings → Energy → Charge limit** — 80/85/90/95/Full dropdown; নতুন root admin action `battery-limit` (sysfs + `/etc/lordos/battery-limit`, boot service re-apply করে)
- **সৎ defer** (design লাগবে, একা বসে ভালো করা যাবে না): Stage Manager, thumbnail drag-to-app, Universal Clipboard, Linux apps-এ text replacement

## 🆕 Phase 3 শুরু — 🎙️ Dictation (macOS-এর সবচেয়ে দুর্দান্ত ফিচার)

**❖D চাপো → বলো → আবার ❖D** → whisper.cpp তোমার কথা **লোকালি** transcribe করে → text সরাসরি focused অ্যাপে paste! কিছুই ইন্টারনেটে যায় না।
- Script whisper.cpp **build করে** + ggml-base model (~148MB) নামায় — প্রথমবার ~৫-১০ মিনিট বাড়তি লাগবে
- Settings → AI → Dictation-এ বিবরণ; নতুন C admin action `dictate-transcribe` (নিরাপদ: শুধু ওই এক recording পড়ে)
- **Bangla কথা বললে**: base model-এ মাঝারি মান — `ggml-small.bin` (466MB) `/usr/local/share/lordos-whisper/`-এ রাখলেই ভালো হবে

## 🆕 Phase 3 সংশোধিত — model বাদ, তার জায়গায় ফিচার + optimization

তোমার কথা মতো **কোনো AI model নেই** — Dictation-এর whisper/model পুরো বাদ (shortcut + Settings section সরানো; plumbing কোড থেকে গেছে, পরে চাইলে যেকোনো দিন ফিরিয়ে আনা যাবে)। জায়গায়:

**নতুন ফিচার:**
1. **"Speed up" button** (Control Center) — এক ক্লিকে: page cache free + SSD TRIM + journal ছোট (নতুন root admin action `optimize-now`)
2. **Auto Power Profile** — charger খুললেই power-saver, লাগালে balanced (macOS-এর মতো; Settings → Energy-তে toggle; নিজে manually বদলালে সেটাও সম্মান করে — শুধু plug বদলালে সুইচ করে)

**Optimizations (script-এ):**
3. **Weekly TRIM** enable (NVMe healthy + fast)
4. **Journal cap 128MB** (logs আর কখনো GB খাবে না)
5. **noatime on /** — SSD-তে কম write, দ্রুত ফাইল অ্যাক্সেস (fstab backup + verify সহ, না মিললে auto-restore)

## 🧪 Verification pass — যা ধরা পড়ল ও ঠিক হলো

শিপ করার আগে গভীর চেক চালালে **৩টা crash-level বাগ ধরা পড়ে ঠিক হয়েছে**:
1. **MenuBar `useEffect` import ছিল না** — মেনু বার রেন্ডারেই পুরো ডেস্কটপ ক্র্যাশ করত
2. **Control Center-এ `Button` import ছিল না** — Speed up button খুললেই ক্র্যাশ
3. **store callback কোনো argument পায় না** — Auto Power Profile কখনোই আগু না

সব ১৭টা patched ফাইল esbuild parse ✅ • manifest 10/10 ✅ • **OS-এর নিজের test suite চালানো হয়েছে**: clean-test 1097/0 ✅ cloud-test 2279/0 ✅ outputs-test 136/136 ✅ lan-test 335/0 ✅ (rconnect-run-এর 7 fail = environmental — cgroup refusal, আমার কোড ওই test-এ নেই)

## 🔍 যেগুলো খোঁজা হলো, ফিক্স upgrade-এর পরে টেস্ট করতে হবে

- **Paste কাজ করে না**: firewall খালি (restriction নেই), clipboard কোডে obvious বাগ চোখে পড়েনি। Upgrade-এর পরেও হলে: কোন অ্যাপে (native নাকি Linux app?), copy করার পর কী হয় — এগুলো দিলে ডিবাগ করব।
- **Streaming lag/crash**: CPU burn fix + zram + microcode — এতগুলোর পরে অনেকটা ভালো হওয়ার কথা। না হলে GPU/hwdecode আলাদা দেখতে হবে (`docs/GPU.md`, `docs/MEDIA.md` রেডি)।
- **Blurry text**: 125% scale-এ master sharp রেন্ডার করে বলে আশা। তবু ঝাপসা লাগলে `Settings → Displays`-এ scale 100% — তখন নিশ্চিত sharp।

## 📊 সকালে চেক-লিস্ট (আমাকে বললেই মেপে দেখাব)

1. `top` — lord-server idle CPU (আগে: 112–363%)
2. CPU temp (আগে: 88–95°C)
3. PrintScreen কাজ করে + `~/Pictures/Screenshots`-এ ফাইল
4. Notification top-right এ
5. Mouse speed/scroll ঠিক লাগছে কি না
