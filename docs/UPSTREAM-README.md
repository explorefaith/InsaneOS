<p align="center">
  <a href="https://insaneos.org">
    <img src="docs/brand/png/logo-horizontal-light-800.png#gh-light-mode-only" alt="Insane OS" width="360">
    <img src="docs/brand/png/logo-horizontal-dark-800.png#gh-dark-mode-only" alt="Insane OS" width="360">
  </a>
</p>

<h3 align="center">The free, fast and secure Linux desktop.</h3>

<p align="center">
  <a href="https://insaneos.org"><b>insaneos.org</b></a> ·
  <a href="https://insaneos.org/#download">Download</a> ·
  <a href="https://insaneos.org/features/own-desktop/">Features</a> ·
  <a href="https://insaneos.org/gallery/">Gallery</a> ·
  <a href="https://insaneos.org/paper/">Paper</a> ·
  <a href="https://insaneos.org/faq/">FAQ</a> ·
  <a href="docs/README.md">Docs</a>
</p>

Insane OS is a free GNU/Linux distribution based on Debian, with its own desktop environment:
a display server and Wayland compositor written in C, its own interface engine, and native apps
made to feel calm, clear and private. It runs on 64-bit PCs and on the Raspberry Pi 5, and the
Linux apps you already use (Chromium, Firefox, GTK and Qt apps) run alongside the native ones.

<p align="center">
  <img src="docs/screenshots/desktop-overview-light.png#gh-light-mode-only" alt="The Insane OS desktop" width="860">
  <img src="docs/screenshots/desktop-overview-dark.png#gh-dark-mode-only" alt="The Insane OS desktop in dark mode" width="860">
</p>

## Everything you need. Nothing you don't.

| | |
|---|---|
| **[A desktop of its own](https://insaneos.org/features/own-desktop/)** | Its own display server and Wayland compositor in C and its own interface engine, on a solid Debian base. Smooth on any 64-bit PC (amd64), and light enough for the Raspberry Pi 5 (arm64). |
| **[Private by design](https://insaneos.org/features/private-by-design/)** | Installable Insane OS apps run isolated and ask before using your camera, microphone, files or network. You decide. |
| **[A firewall you can see](https://insaneos.org/features/visible-firewall/)** | Watch every connection on a live world map, then allow or block it per app, by domain, address or network, and restrict camera, microphone, files and more. Subscribe to public blocklists of ads, trackers and malware, or deny everything a rule doesn't allow. |
| **[Passwords built in](https://insaneos.org/features/passwords/)** | A vault for passwords, 2FA codes and cards that unlocks with a password or a USB key. |
| **[Mail, Calendar, Contacts](https://insaneos.org/features/mail-calendar/)** | Native apps for your accounts, with remote images blocked until you say so. |
| **[Your Linux apps too](https://insaneos.org/features/linux-apps/)** | Chromium, Firefox and GTK apps fit right in, with the same window frame and dark mode. |
| **AI apps in the Store** | A curated catalog: Claude Code, Claude Desktop, Visual Studio Code, Cursor, Codex CLI, goose, opencode, and llama.cpp and whisper.cpp to run models on your own computer, each from a pinned, verified source. The Store downloads over HTTPS. |
| **System Information** | Every piece of hardware and what Insane OS makes of it, a report you can read before you copy it, and checks that try Insane OS's security claims on your own computer. A Performance tab runs InsaneBench: quick and full tests shown against reference machines, never as one score. Community hardware reports: share yours on GitHub with your own account (Insane OS sends nothing), and the Compatibility panel shows what others confirmed. |
| **Cleaner** | See what uses the disk and remove what can safely go. A scan only reads, and nothing changes until you review and confirm a plan. |
| **Remote Desk** | One app for RDP and VNC, drawn by Insane OS itself, with no client window or toolkit. Files connects to servers too: SMB, NFS, SFTP, FTP and WebDAV open as folders. |
| **Moving wallpapers** | Short loops behind the desktop and the login screen, for a compatible GPU with hardware decoding, with no software mode. They pause when nobody sees them. |
| **Disk Formats** | One Store item opens NTFS, exFAT, FAT, HFS+ and APFS volumes on the desktop, with every driver's license and source shown first. HFS+ and APFS are read-only. |

Measured, not promised: on the final ISO test before the first release (a 0.7.0 build, 2026-10-18) the
whole system idled at **465–487 MB of RAM**, of which `insane-server` (the display server with the whole
desktop) was **32–36 MB**, and booted in about **16 s** (see [`docs/ISO.md`](docs/ISO.md), "Final ISO
test"). The released 0.8.5-beta, updated in place on a VMware VM with GPU composition, used **592 MB** for
the whole system about five minutes after sign-in and showed its first frame **7.4 s** after the kernel
started ([`results/0.8.5-beta/vmware-fusion`](results/0.8.5-beta/vmware-fusion)). What is isolated today, exactly, is in
[`docs/PRIVACY.md`](docs/PRIVACY.md).

## Get Insane OS

The latest release is **[0.8.8-beta](https://github.com/insaneos/Insane OS/releases/tag/v0.8.8-beta)**
(2026-11-02). Releases are signed and published on [GitHub Releases](https://github.com/insaneos/Insane OS/releases)
and on [insaneos.org](https://insaneos.org/#download). Before you download, see
[what Insane OS needs](https://insaneos.org/requirements/) and
[how to run it in a virtual machine](https://insaneos.org/virtual-machine/).

- **PC (64-bit):** a live and installable ISO, `insaneos-live-0.8.8-amd64.iso`. Try it without installing.
- **Virtual machine:** an OVA for VirtualBox and VMware, `insaneos-0.8.8-amd64.ova`. Give any virtual machine at least 4 CPUs and 4 GB of memory, ideally 16 GB with many apps.
- **Generic arm64 (UEFI):** a live and installable ISO for arm64 machines and virtual machines,
  `insaneos-live-0.8.8-arm64.iso`, new in 0.8.7. Tested on emulated QEMU only; this release's was built but not booted.
- **Raspberry Pi 5:** a ready-to-flash image for SD card or NVMe, `insaneos-0.8.8-rpi5-arm64.img.xz`,
  with fan control and our own kernel. The Raspberry Pi 5 is the only supported board.
- **Already running Insane OS?** It updates in place from the signed repository on insaneos.org.
- **Already on Debian 13?** Install Insane OS on top of your current system with one command:

  ```sh
  curl -fsSL https://insaneos.org/install.sh | sh
  ```

**Verify your download.** `SHA256SUMS` is signed with the Insane OS release key (Ed25519),
fingerprint `c7155b8e6bbbb180f907381994d06af76d333016cd6f3facf67cadd053ea108e`. See
[code signing](https://insaneos.org/legal/code-signing/) and [`docs/SIGNING.md`](docs/SIGNING.md).

Status: **beta**. See [`CHANGELOG.md`](CHANGELOG.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Documentation

- [`docs/README.md`](docs/README.md): the index of every document.
- [The paper](https://insaneos.org/paper/) ([`docs/PAPER.md`](docs/PAPER.md)): vision, architecture,
  security model, performance and roadmap, with links to the source files.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): components, processes and dependencies.

## Repository map

- `server/`: `insane-server` (display server and Wayland compositor: DRM/KMS and evdev straight
  from the kernel, without X11, libdrm or libinput) plus `insane-sessiond`, `insane-netd`,
  `insane-netperm`, `insane-fand` and the sandboxed helpers (`insane-media`, `insane-doc`, `insane-vault`,
  `insane-maild`, `insane-fetch`, `insane-tls`, `insane-clean`, `insane-lan`, `insane-rdesk`, and InsaneBench's
  `insane-bench`).
- `runtime/`: `@insaneos/runtime`, the React renderer for insane-server.
- `sdk/`: `@insaneos/sdk`, the API for themes and apps.
- `apps/`: the native apps. See [`apps/README.md`](apps/README.md).
- `themes/`: complete desktops in React, swappable live. See [`themes/README.md`](themes/README.md).
- `assets/`: fonts, icons, the brand and Lumo, and the UI texts per language.
- `tools/`: ISO and Raspberry Pi image builders, the Debian installer, release signing, the website.
- `web/`: the [insaneos.org](https://insaneos.org) website.
- `third_party/`: QuickJS, stb, Monocypher and word lists, vendored (see [`THIRD_PARTY.md`](THIRD_PARTY.md)).

## Building from source

On the development machine (needs Node.js):

```sh
npm install && npm run build        # bundles every theme with the SDK and the apps
```

On Debian 13 (see [`docs/VM-SETUP.md`](docs/VM-SETUP.md) for the full list of packages):

```sh
make -C server -j4 && make -C server test
```

Images: [`docs/ISO.md`](docs/ISO.md) (PC) and [`docs/RASPBERRY.md`](docs/RASPBERRY.md) (Raspberry Pi 5).

## Contributing and security

- [`CONTRIBUTING.md`](CONTRIBUTING.md) and the [code of conduct](CODE_OF_CONDUCT.md).
- Found a vulnerability? Please read [`SECURITY.md`](SECURITY.md) and don't open a public issue.
- Bugs and ideas: [how to report](https://insaneos.org/legal/issues/).

## Support the project

Insane OS is free and open source. If it makes your computer better, help us keep building it:
[insaneos.org/#support](https://insaneos.org/#support).

## Made by iPERFEX

Insane OS is developed by [iPERFEX](https://www.iperfex.com/?lang=en). Meet Lumo, the guardian of
Insane OS, in the [brand guide](docs/INSANEOS-BRAND.md). To work with us on Insane OS (sponsorship,
collaborations, custom apps or support), see [insaneos.org/about](https://insaneos.org/about/).

## License

MIT for Insane OS's code (see [`LICENSE`](LICENSE)). Each third-party component keeps its own
license (see [`THIRD_PARTY.md`](THIRD_PARTY.md) and [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md)).
The Insane OS name, logo and Lumo are covered by the [trademark policy](https://insaneos.org/legal/trademark/).

Copyright © 2026 [iPERFEX](https://www.iperfex.com/?lang=en). All rights reserved for the website, brand and content; the code is free software under the MIT license.
