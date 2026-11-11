# 🗺️ InsaneOS macOS-ification — Master Roadmap (multi-phase)

**নিয়ম:** প্রতিটা phase = source patch → build → verify → তোমার কাছে টেস্ট → তারপর পরেরটা।
এক phase-এর সমস্যা ধরা পড়লে আলাদা করে ঠিক করা যায়, সব একসাথে নয়।

## ✅ Phase 1 — তোমার OS-এ already ছিল (শুধু জানা লাগবে!)

| Feature | কীভাবে ব্যবহার |
|---|---|
| **Spotlight** | **❖-Space বা Ctrl+Space** — অ্যাপ, ফাইল, ক্যালকুলেটর (2*(3+4)), ইউনিট (10 km to mi), notes, clipboard history, Store — ৫০০ লাইনের পুরো implementation ছিল! |
| Night Light sunset schedule | Settings — time zone থেকে sunset/sunrise নিজেই বের করে |
| Screenshot thumbnail | তোলার পর কোণায় ভাসে, click = markup editor |
| Power profiles API | C-তে ছিল (ppd), Control Center toggle এখন যোগ করলাম (নিচে) |
| Menu bar battery | StatusItems দিয়ে আসে |

## 🟢 Phase 1 — রাতেই বানানো হলো (এই upgrade-এ আসছে)

1. ✅ **Hot Corners** — কোণায় 350ms dwell: TL=Overview, TR=Do Not Disturb, BL=Show Desktop, BR=off. Config: `settings.hotCorners`
2. ✅ **Power Mode tile** — Control Center-এ Performance/Balanced/Low Power (ppd)
3. ✅ **Battery 80% limit** — boot service (ThinkPad sysfs), ব্যাটারি health
4. ✅ **Login chime** — নতুন synthesized C6-E6-G6 arpeggio (snd.c), শুধু session-এ (login screen এ না)
5. ✅ **Auto dark mode** — `settings.autoDark {on, from, to}` — রাতে dark, দিনে light (default: on, 19:00–07:00)
6. ✅ **Dynamic wallpaper** — `settings.dynamicWallpaper {on, day, night, from, to}` (engine রেডি; Settings UI Phase 2)
7. ✅ **Menu bar CPU/Temp widget** — ঘড়ির পাশে `34% · 62°` (4s refresh)
8. ✅ **Text replacement** — `settings.textReplace = {omw: 'on my way'}` — InsaneOS-এর নিজের টেক্সট ফিল্ডে (Linux apps-এ Phase 2: IME hook)

## 🟡 Phase 2 — শুরু হলো (সত্য যাচাই + Settings UI)

**যাচাইয়ে ধরা পড়ল — এগুলো already ছিল:**
- **Trackpad gestures** — tp.c: ৩-আঙুল swipe (desktop), three-finger drag, ৪-আঙুল swipe (setting!) — Settings → Desktops-এ swipe4 toggle-ও আছে
- **Per-app volume mixer** — Settings → Sound-এই আছে (PipeWire)
- **App Switcher / per-app windows** — appswitcher.jsx, overview toggleAppWindows

**এই phase-এ বানানো হলো — Phase 1 engines-এর Settings UI (সব verified):**
1. ✅ **Settings → Automatic Appearance** — auto dark toggle + dark hours (TimeField) + wallpaper follows schedule + day/night wallpaper picker
2. ✅ **Settings → Desktops → Hot Corners** — on/off + চার কোণার action dropdown
3. ✅ **Settings → Keyboard → Text Replacement** — token→phrase list editor (+/−)

**বাকি আছে (reboot-টেস্টের পরে):** snap preview overlay, Stage Manager, thumbnail drag-to-app (DnD), Universal Clipboard, system-wide text replacement (ime.c)

**Phase 2 দ্বিতীয় ধাপ (এই build-এ):**
- ✅ **Battery Charge Limit UI** — Settings → Energy: 80/85/90/95/Full dropdown → নতুন root admin action `battery-limit` (sysfs লেখে + `/etc/insaneos/battery-limit`-এ মনে রাখে, boot service সেটা apply করে)
- ✅ **যাচাইয়ে জানা গেল আরও:** Snap preview **already আছে** (sdk/windows.js-এ snap zones + edges polling — window edge-এ টানলেই কাজ করবে)

**সত্যিকারের defer (design/protocol লাগবে, Phase 3-এর সাথে):**
- Stage Manager — overview + app switcher আছে; আলাদা paradigm, তোমার ব্যবহার দেখে design করা ভালো
- Screenshot thumbnail drag-to-app — shell-এ generic DnD API নেই (C design কাজ)
- Universal Clipboard — LAN protocol design
- System-wide text replacement — ime.c hook (Linux apps)

1. **Trackpad gestures** — ৩-আঙুল swipe: desktop switch + Overview (pointer-gestures আছে)
2. **Three-finger drag** — window move
3. **Snap preview overlay** — edge-এ টানলে half/quarter highlight
4. **Stage Manager** — বাঁয়ে recent windows
5. **App Exposé** — Dock icon-এ ওই অ্যাপের windows spread
6. **Per-app volume mixer** — Control Center
7. **Dynamic wallpaper Settings UI** — day/night picker
8. **Hot Corners Settings UI** + power profile Settings page
9. **Universal Clipboard** (LAN, insane-lan দিয়ে)
10. **Screenshot thumbnail drag-to-app** — DnD protocol কাজ
11. **Text replacement system-wide** — ime.c hook
12. **Battery limit Settings toggle** — insane.admin op

## 🔴 Phase 3 — বড় প্রজেক্ট

### ✅ 1. Dictation (❖D) — v1 বানানো হয়েছে (এই build-এ)!
- **❖D** চাপো → mic রেকর্ড → আবার ❖D → whisper.cpp **লোকালি** transcribe → text clipboard-এ → focused অ্যাপে paste
- নতুন root admin action `dictate-transcribe` (A_FORK — whisper-এর stdout সরাসরি অ্যাপে stream হয়; শুধু ওই এক WAV পড়ে, কিছুই বাইরে যায় না)
- নতুন `sdk/voicein.js` + Settings → AI → Dictation সেকশন
- upgrade script **whisper.cpp build করে** (/opt/whisper.cpp → /usr/local/bin/whisper-cli) + ggml-base model (~148MB, one time) নামায়
- সীমাবদ্ধতা: base model English ভালো, Bangla মাঝারি — `ggml-small.bin` (466MB) নামালে ভালো হবে (same folder-এ রাখলেই হবে)

### 🔜 বাকি (পরের ধাপে — design + তোমার ফিডব্যাক লাগবে)
2. **File content search** — Spotlight-এ ভেতরের লেখা: incremental indexer (mtime-based) — আলাদা সেশনে
3. **Universal Clipboard** — LAN protocol (দুটো ডিভাইস লাগবে টেস্টে)
4. **Find My / Phone integration** — সিদ্ধান্ত লাগবে: self-hosted সার্ভিস নাকি KDE Connect adopt

## ⚠️ সততার নোট
- প্রতিটা C change-এর পরে **তোমার রিবুট + টেস্ট** লাগবে — আমি headless টেস্ট করতে পারি না
- Settings UI ছাড়া ফিচারগুলো এখন settings.json দিয়ে configure হয় (আমি চাইলে default বদলে দিতে পারি)
- সব কিছু আবার upstream-এ পাঠানোর মতো করে লেখা — তোমার OS-এর ডেভেরাও উপকৃত হবে
