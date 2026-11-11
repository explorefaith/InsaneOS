<p align="center">
  <img src="assets/icons/insaneos-icon-256.png" alt="Insane OS" width="120">
</p>

<h1 align="center">Insane OS</h1>

<p align="center"><em>A desktop written in C. Calm on the surface. Peculiar underneath.</em></p>

---

**Insane OS** is a Debian-based desktop operating system with its own Wayland compositor,
interface engine and native apps — built from scratch, line by line, in C11. No inherited
desktop stack, no layers you can't read: on top of nothing but libc, libxkbcommon,
libwayland, vendored QuickJS and stb. The whole display stack is code you can read to the end.

This tree is the Insane OS edition: upstream InsaneOS 0.8.8.6-dev, rebased with a full rebrand
and a long list of engineering changes (see [fix/INSANE-OS-CHANGELOG.md](fix/INSANE-OS-CHANGELOG.md)).

---

## What makes it Insane

- **A living desktop** — the wallpaper is a hardware-decoded video that pauses when you don't
  need it; glass widgets on the desktop show the time and live system stats, re-inked to match
  the wallpaper's own colours.
- **Written in C, measured in microseconds** — one 21 MB compositor binary, 0.09 ms pointer
  latency, ~5 s userspace boot, damage-tracked painting with a GPU path that falls back to the
  CPU and stays smooth.
- **Private by construction** — per-app permissions (camera, mic, files, network), a firewall
  you can watch on a live map, sandboxed helpers with Landlock and seccomp, a password vault
  with per-app keyring isolation, signed packages, and verified system code at boot.
- **No telemetry. No account. No server.** Crash logs stay in your home folder.
- **Everything else you expect** — screenshots with offline OCR, screen recording, a Store
  with signed packages, backup, cleaner, monitor, terminal, mail, calendar.

The full change list against upstream lives in
[fix/INSANE-OS-CHANGELOG.md](fix/INSANE-OS-CHANGELOG.md).

## Build it

```sh
# build dependencies (Debian 13)
sudo apt install build-essential cmake pkg-config libxkbcommon-dev libwayland-dev \
  wayland-protocols libgbm-dev libegl1-mesa-dev libgles2-mesa-dev \
  libavcodec-dev libavformat-dev libavutil-dev libswscale-dev libswresample-dev \
  libssl-dev libsystemd-dev libpoppler-glib-dev libarchive-dev libcairo2-dev \
  libfreetype-dev libfontconfig-dev

# the compositor and every helper
cd server
make -j"$(nproc)"
```

The theme (menu bar, dock, apps) is React-style JSX bundled by esbuild:

```sh
npm ci
node tools/build-theme.mjs
```

Rebrand assets (the burst mark) regenerate with zero dependencies:

```sh
python3 tools/gen-brand-insane.py
```

## Install / upgrade this tree on a running Insane OS machine

```sh
cd fix
sudo bash upgrade-insaneos.sh
sudo reboot
```

The script backs up everything it replaces to `/var/backups/insaneos-fix-<time>/` (with a
one-command `REVERT.sh`), builds and installs the compositor and bundles, wires the live
wallpaper, sets the login background, refreshes the boot splash, and writes a security
enforcement snapshot. Details: [fix/TEST-CHECKLIST.md](fix/TEST-CHECKLIST.md).

## In this tree

| Path | What it is |
|---|---|
| `server/` | the Wayland compositor, interface engine, helpers — all C11 (`make` in here) |
| `themes/` | the desktop themes (Insane Flow / Insane Classic / greeter), bundled with esbuild |
| `sdk/`, `runtime/` | the interface SDK the apps and themes share |
| `apps/` | native apps: Files, Store, Terminal, Monitor, Screenshots, Passwords, … |
| `fix/` | this edition's installer, freezer service, engineering docs and reports |
| `website/` | the Insane OS site — open `website/index.html` or serve the folder |
| `docs/` | upstream architecture docs (`docs/UPSTREAM-README.md` is their original readme) |

## Status

Built and tested on Debian 13.7, kernel 6.12. The upstream test suite passes
(mail-test 47,467 checks, cloud-test 2,279, clean-test 1,097, … — the only failures are
environmental cgroup refusals in one remote-connect test). See
[fix/INSANE-OS-TEST-REPORT.md](fix/INSANE-OS-TEST-REPORT.md).

## Credits

Built on [InsaneOS](https://insaneos.org) by its authors (upstream readme:
[docs/UPSTREAM-README.md](docs/UPSTREAM-README.md)), which is built on Debian GNU/Linux.
The Insane OS edition, rebrand, engineering fixes and features in `fix/` and this tree's
changes by explorearafat.

## License

Same as upstream: GPL — see [LICENSE](LICENSE). Third-party notices in
[THIRD_PARTY.md](THIRD_PARTY.md).
