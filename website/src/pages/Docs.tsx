import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'

type TocItem = { id: string; label: string; group: string }

const TOC: TocItem[] = [
  { id: 'what-you-need', label: 'What you need', group: 'Setup' },
  { id: 'from-an-image', label: 'Install from an image', group: 'Setup' },
  { id: 'in-a-vm', label: 'In a virtual machine', group: 'Setup' },
  { id: 'raspberry-pi', label: 'Raspberry Pi and ARM', group: 'Setup' },
  { id: 'beside-debian', label: 'Beside an existing Debian', group: 'Setup' },
  { id: 'upgrade', label: 'Upgrade a running OS', group: 'Setup' },
  { id: 'from-source', label: 'Build from source', group: 'Setup' },
  { id: 'the-desktop', label: 'The desktop', group: 'First days' },
  { id: 'permissions', label: 'Permissions and privacy', group: 'First days' },
  { id: 'apps-and-data', label: 'Apps and your data', group: 'First days' },
  { id: 'troubleshooting', label: 'Troubleshooting', group: 'Help' },
  { id: 'privacy-details', label: 'Privacy, in detail', group: 'About' },
  { id: 'where-things-live', label: 'Where things live', group: 'About' },
  { id: 'credits', label: 'Licenses and credits', group: 'About' },
]

function Term({ children }: { children: string }) {
  return (
    <div className="term docs-term">
      <div className="term-bar">
        <span className="term-title">shell</span>
      </div>
      <pre tabIndex={0}>
        {children.split('\n').map((line, i) => (
          <div key={i}>
            {line.startsWith('$ ') ? (
              <>
                <span className="tl-prompt">$ </span>
                {line.slice(2)}
              </>
            ) : (
              line || '\u00A0'
            )}
          </div>
        ))}
      </pre>
    </div>
  )
}

export default function Docs() {
  const [active, setActive] = useState('')

  useEffect(() => {
    let raf = 0
    const measure = () => {
      raf = 0
      let current = ''
      for (const item of TOC) {
        const el = document.getElementById(item.id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= 140) current = item.id
      }
      setActive(current)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      <header className="nav is-scrolled">
        <div className="wrap nav-inner">
          <Link className="brand" to="/">
            <img src="./mark.png" alt="" aria-hidden="true" />
            Insane OS
          </Link>
          <nav className="nav-links" aria-label="Site">
            <Link className="nav-link" to="/">Home</Link>
            <a className="nav-link" href="https://github.com/explorefaith/InsaneOS" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
          <a className="btn btn-solid btn-sm nav-cta" href="https://github.com/explorefaith/InsaneOS/releases" target="_blank" rel="noreferrer">
            Download
          </a>
        </div>
      </header>

      <main className="wrap docs-main">
        <div className="docs-head">
          <h1 className="display-2">Docs.</h1>
          <p className="lede">
            Everything a new machine needs: setup paths for every kind of
            install, the first days on the desktop, and what to do when
            something misbehaves.
          </p>
        </div>

        <div className="docs-grid">
          <nav className="docs-toc" aria-label="Contents">
            {TOC.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`docs-toc-link${active === item.id ? ' active' : ''}`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="docs-body">
            <h2 id="what-you-need">What you need</h2>
            <ul>
              <li>A 64-bit PC (amd64), an ARM board, or a Raspberry Pi (arm64).</li>
              <li>A USB stick the image fits on, for a bare-metal install.</li>
              <li>Fifteen quiet minutes.</li>
              <li>For building from source: Debian 13 with the development packages listed below.</li>
            </ul>

            <h2 id="from-an-image">Install from an image</h2>
            <p>The usual path, for any 64-bit PC:</p>
            <ol>
              <li>
                Download the amd64 ISO from{' '}
                <a href="https://github.com/explorefaith/InsaneOS/releases" target="_blank" rel="noreferrer">
                  the releases page
                </a>
                , along with its checksum.
              </li>
              <li>Write it to the USB stick with any imager. Insane OS’s own Imager app does this too, from another machine running the OS.</li>
              <li>Boot from the stick. The installer takes over from there: pick the disk, create your account, let it finish, reboot.</li>
            </ol>
            <p>
              System code is verified at boot, and packages are signed — the
              first desktop you see is the one that was built.
            </p>

            <h2 id="in-a-vm">In a virtual machine</h2>
            <p>
              Download the OVA and import it into your hypervisor. The same
              desktop boots in a window, wallpapers and widgets included. A
              plain ISO attached to a UEFI VM works the same way if you prefer
              to install it yourself.
            </p>

            <h2 id="raspberry-pi">Raspberry Pi and ARM boards</h2>
            <p>
              The arm64 image is built for the Pi’s own hardware. Write it to
              an SD card or USB drive with any imager, put it in the board, and
              boot. ARM boards with UEFI firmware boot the arm64 ISO directly.
            </p>

            <h2 id="beside-debian">Beside an existing Debian</h2>
            <p>
              On a machine that already runs Debian 13, Insane OS can install
              <em> beside </em> your current desktop instead of replacing it.
              Nothing is deleted: your existing session, settings and files
              stay intact, and your data is copied — never moved — to the names
              the new session reads. From a checkout of the repository:
            </p>
            <Term>{`$ git clone https://github.com/explorefaith/InsaneOS.git
$ cd InsaneOS
$ ./install-insaneos.sh`}</Term>
            <p>
              The script is safe to run again. It lists every change it is
              about to make, and the only machine-state changes are package
              additions, one documented dpkg diversion, and which greeter
              starts at boot.
            </p>

            <h2 id="upgrade">Upgrade a running OS</h2>
            <p>On a machine already running Insane OS:</p>
            <Term>{`$ cd fix
$ sudo bash upgrade-insaneos.sh
$ sudo reboot`}</Term>
            <p>
              The upgrade backs up everything it replaces to{' '}
              <code>/var/backups/insaneos-&lt;time&gt;/</code>, writes a
              one-command revert script beside it, then installs the new
              compositor and bundles, wires the wallpaper and boot splash, and
              takes a security snapshot.
            </p>

            <h2 id="from-source">Build from source</h2>
            <p>Build dependencies on Debian 13:</p>
            <Term>{`$ sudo apt install build-essential cmake pkg-config \\
    libxkbcommon-dev libwayland-dev wayland-protocols \\
    libgbm-dev libegl1-mesa-dev libgles2-mesa-dev \\
    libavcodec-dev libavformat-dev libavutil-dev \\
    libswscale-dev libswresample-dev libssl-dev \\
    libsystemd-dev libpoppler-glib-dev libarchive-dev \\
    libcairo2-dev libfreetype-dev libfontconfig-dev`}</Term>
            <p>The compositor and every helper are plain make:</p>
            <Term>{`$ cd server
$ make -j$(nproc)`}</Term>
            <p>
              The theme (menu bar, dock, apps) is React-style JSX bundled by
              esbuild, and the brand mark regenerates with zero dependencies:
            </p>
            <Term>{`$ npm ci
$ node tools/build-theme.mjs
$ python3 tools/gen-brand-insane.py`}</Term>

            <h2 id="the-desktop">The desktop</h2>
            <p>
              Two styles ship with the system: <strong>Insane Flow</strong> and{' '}
              <strong>Insane Classic</strong>. They carry the same apps;
              switching — like switching dark to light — applies right away,
              without logging out, and open windows come back where you left
              them. Both can follow a schedule.
            </p>
            <p>
              The wallpaper is a hardware-decoded video that pauses when you
              don’t need it. Glass widgets on the desktop show the time and
              live system stats, re-inked to match the wallpaper’s colours.
              Right-click the desktop and choose <strong>Edit Widgets</strong>{' '}
              to drag cards around, remove them, or add clock, calendar,
              battery, system and media widgets.
            </p>

            <h2 id="permissions">Permissions and privacy</h2>
            <ul>
              <li>Camera, microphone, files and network are granted per app, in Settings → Privacy, revocable at any moment.</li>
              <li>The firewall draws every connection on a live map — nothing leaves without a visible reason.</li>
              <li>Helpers are confined with Landlock and seccomp to exactly what they need.</li>
              <li>The password vault isolates keyrings per app, so one breach stays one.</li>
              <li>Packages are signed; system code is verified at boot.</li>
            </ul>

            <h2 id="apps-and-data">Apps and your data</h2>
            <p>
              Files, Terminal, Monitor, Screenshots (with offline OCR),
              Recorder, Mail, Calendar, Backup, Cleaner, Notes, Camera,
              Passwords and the Store all ship with the desktop, all native,
              all local-first. The Store installs signed packages. Backup
              keeps versioned copies of what matters. Crash logs stay in your
              home folder — there is no server to send them to.
            </p>

            <h2 id="troubleshooting">Troubleshooting</h2>

            <h3>The screen stays black at boot</h3>
            <p>
              The compositor reaches userspace in about five seconds; a black
              screen past that is usually a display handshake. Try one more
              boot. If it persists, open an issue with a photo of the last
              line on screen and your hardware — that is enough to start.
            </p>

            <h3>Graphics feel slow</h3>
            <p>
              Painting is damage-tracked, with a GPU path that falls back to
              the CPU and stays smooth. If a machine feels heavy, check
              Settings → Energy for the performance mode, and Monitor to see
              what is actually loading the machine.
            </p>

            <h3>The wallpaper is heavy on older machines</h3>
            <p>
              It already pauses whenever it is not needed. If you want it gone
              entirely, Settings → Wallpaper swaps it for a still.
            </p>

            <h3>Battery shows “service recommended”</h3>
            <p>
              That is the real wear report, not a scare: health percentage,
              cycle count, and a recommendation when one is due. Setting a
              charge limit — 80 percent by default — keeps the battery healthy
              for longer.
            </p>

            <h3>Fans can’t be controlled</h3>
            <p>
              If a computer is cooled passively or by its firmware, Settings →
              Cooling says so plainly instead of showing fake controls. Where
              controllable fans exist, they appear there.
            </p>

            <h3>An app misbehaves</h3>
            <p>
              Force Quit is in the app grid, and the Logs app shows what a
              component actually said. If an app can’t reach something it
              needs, check its permissions in Settings → Privacy first — most
              surprises are a revoked permission doing its job.
            </p>

            <h3>Undoing an upgrade</h3>
            <p>
              Every upgrade leaves a revert script in its backup folder:
            </p>
            <Term>{`$ sudo bash /var/backups/insaneos-<time>/REVERT.sh
$ sudo reboot`}</Term>

            <h2 id="privacy-details">Privacy, in detail</h2>
            <p>
              No telemetry. No account. No server. There is nothing to phone
              home to, so nothing does. Crash logs are written under your home
              folder and stay there. The firewall map, the per-app permissions,
              the signed packages and the verified boot all exist for the same
              reason: privacy by construction, not by promise.
            </p>

            <h2 id="where-things-live">Where things live</h2>
            <ul>
              <li>Settings and app data — under your home folder, owned by you.</li>
              <li>Crash logs — your home folder, never sent anywhere.</li>
              <li>Upgrade backups and their revert scripts — <code>/var/backups/insaneos-&lt;time&gt;/</code>.</li>
              <li>The source of everything you see — <a href="https://github.com/explorefaith/InsaneOS" target="_blank" rel="noreferrer">the repository</a>.</li>
            </ul>

            <h2 id="credits">Licenses and credits</h2>
            <p>
              Insane OS is GPL-licensed, like the upstream it is built on. It
              stands on Debian GNU/Linux, libc, libxkbcommon, libwayland,
              vendored QuickJS and stb. Third-party notices list everything
              borrowed and everyone credited. The Insane OS edition, rebrand
              and engineering by explorearafat.
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
