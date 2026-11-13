# 🧪 রিবুট-পরবর্তী টেস্ট চেকলিস্ট — ক্রমানুসারে

রিবুটের পরে এই তালিকা ধরে যাও। যেটা কাজ করছে না শুধু সেটার নম্বর বলো — আমি ঠিক করব।

## ১. প্রথমেই লক্ষ্য করো (কোনো ক্লিক ছাড়া)
- [ ] লগইনের পর **chime বাজে** (C6-E6-G6, মৃদু)
- [ ] মেনু বারে ঘড়ির পাশে **CPU% · তাপমাত্রা** দেখা যায়
- [ ] ডেস্কটপ **স্ন্যাপি** — আগের মতো ল্যাগি না

## ২. Speed / Optimization
- [ ] Terminal খুলে `top` → `1` → insane-server idle-এ **অনেক কম CPU** (আগে 112–363%; এখন <50% হওয়ার কথা)
- [ ] `free -h` → **zram** দেখা যায় (~3.8GB, zstd)
- [ ] `findmnt -n -o OPTIONS /` → **noatime** লেখা আছে
- [ ] `systemctl status fstrim.timer` → active

## ৩. Screenshot
- [ ] **Ctrl+Shift+S** (বা PrintScreen) চাপো → cursor-এ **window hover-এ highlight**
- [ ] কোনো window-তে **click** → ওই window-র screenshot `~/Pictures/Screenshots`-এ
- [ ] **drag** করলে area selection (আগের মতো)
- [ ] টেস্ট সেশনে permission allow করা হয়েছিল — যদি "could not capture" আসে, বলো

## ৪. Traffic lights
- [ ] **Chromium/Firefox/GTK অ্যাপে** top-left এ red/yellow/green দেখা যায়
- [ ] তিনটাই **কাজ করে** (close/minimize/zoom)
- [ ] Terminal-এর মতো native অ্যাপে আগের মতোই আছে

## ৫. Control Center
- [ ] **Power Mode** — Performance/Balanced/Low Power switch কাজ করে
- [ ] **Speed up → Now** চাপলে কয়েক সেকেন্ড ব্যস্ত থেকে শেষ হয় (TRIM চলে)
- [ ] Dark toggle, effects — আগের মতো

## ৬. Settings
- [ ] **Settings → Appearance**: "Automatic Appearance" — auto dark toggle + ঘণ্টা
- [ ] **Settings → Desktops → Hot Corners** — প্রতি কোণার dropdown
- [ ] **Settings → Keyboard → Text Replacement** — token যোগ করে টেস্ট (যেমন `omw` → `on my way`), তারপর Terminal ছাড়া অন্য InsaneOS অ্যাপে (Notes/Text Editor) টাইপ করে দেখো
- [ ] **Settings → Energy → Charge limit** — 80% সেট করলে `cat /sys/class/power_supply/BAT0/charge_control_end_threshold` = 80

## ৭. Hot corners + auto behavior
- [ ] উপরে-বাঁ কোণায় pointer ০.৫ সেকেন্ড রাখো → **Overview** খোলে
- [ ] উপরে-ডান → **DND** toggle (মেনু বারে bell-এ dot)
- [ ] নিচে-বাঁ → **Show Desktop**
- [ ] চার্জার খুললে নিচে-ডান কোণায় নয় — কোণা ঠিক আছে; চার্জার খুললে **power-saver** এ যায় (Settings → Energy-তে Low Power জ্বলে)

## ৮. Freezer (memory চাপ)
- [ ] Chrome-এ ১০-১৫টা ট্যাব খুলো + কয়েকটা অ্যাপ → কিছুক্ষণ পরে `~/.cache/insaneos/freeze/log`-এ "freeze" লাইন
- [ ] ব্যাকগ্রাউন্ড অ্যাপে ফিরে গেলে সাথে সাথে জেগে ওঠে

## ৯. YouTube
- [ ] Chrome-এ 1080p ভিডিও → স্মুথ? `chrome://gpu`-তে **Video Decode: Hardware enabled** দেখো
- [ ] CPU usage ভিডিও চলাকালীন আগের চেয়ে অনেক কম

## ⚠️ সমস্যা হলে
- এক ফিচার ভাঙলে বাকি সব ঠিক থাকবে — নম্বর বললেই আলাদা করে ঠিক করব
- সব revert: `sudo bash /var/backups/insaneos-fix-*/REVERT.sh` + রিবুট

## ১০. Round 3 — রেসপন্সিভনেস (upgrade-insaneos.sh + relogin এর পরে)
- [ ] **ডক ম্যাগনিফিকেশন** — আইকনের উপর দিয়ে দ্রুত mouse নাড়ালে স্মুথ; ১০০০Hz mouse-এও ডক জুড়ে ঝিঁকে ওঠা নেই
- [ ] **Window restore** — Dock আইকনে ক্লিক করে minimize করা window ফেরত আনলে জিনি ইফেক্ট উল্টো দিকে (আইকন থেকে window); Reduce Motion-এ সরাসরি আসে
- [ ] **Control Center / Launchpad** — খোলার সময় হালকা fade+rise; বন্ধ আগের মতোই সাথে সাথে
- [ ] **লোডের মধ্যে pointer** — ভারী build চলাকালীন (clang++/gradle) window drag করো: cursor-এর পিছনে window আর লেগ করবে না (আগে flip-এর জন্য অপেক্ষা করত)
- [ ] **Foreground priority** — দুটো অ্যাপে ভারী কাজ চালু রেখে focused অ্যাপে কাজ করো: focused অ্যাপটা এগিয়ে থাকবে; `cat /sys/fs/cgroup/system.slice/insaneos.service/insaneos-session-1000/app-*.scope/cpu.weight`-এ focused টার 400, বাকিদের 100
- [ ] **Wallpaper pressure pause** — মেমরি চাপ দিলে (বড় balloon বা অনেক ট্যাব) wallpaper আগে থামবে (still image থাকবে), চাপ কমলে নিজেই ফিরবে — Settings-এর switch ছাড়াই, এটা protection
- [ ] **Pointer lag log** — `INSANE_INPUT_DEBUG=1` session-এ `cat $XDG_RUNTIME_DIR/insaneos-pointerlag.log` — ৫ সেকেন্ডে এক লাইন percentiles (docs/TROUBLESHOOTING.md)
- [ ] `bash fix/realworld-suite.sh all 12` upgrade-এর আগে ও পরে — দুটো SUMMARY.txt তুলনা (fix/REALWORLD-TESTS.md)
