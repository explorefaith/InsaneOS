import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

const RELEASE = 'https://github.com/explorefaith/InsaneOS/releases/tag/v0.8.8.6-beta'
const RELEASES = 'https://github.com/explorefaith/InsaneOS/releases'

const MEDIA: Array<{ name: string; desc: string; tag: string; href?: string }> = [
  {
    name: 'Desktop packages',
    desc: 'The desktop, its hardware snapshot and cloud backend — installable into an existing Debian 13.',
    tag: 'deb · amd64',
    href: RELEASE,
  },
  {
    name: 'Live ISO',
    desc: 'USB and CD, BIOS and UEFI. Built by tools/iso/build.sh in the repo.',
    tag: 'iso · amd64',
  },
  {
    name: 'ARM ISO',
    desc: 'ARM boards and single-board computers, UEFI boot.',
    tag: 'iso · arm64',
  },
  {
    name: 'Virtual machine image',
    desc: 'A standard OVA — double-click in VirtualBox or VMware.',
    tag: 'ova',
  },
  {
    name: 'Raspberry Pi image',
    desc: 'Built for the Pi’s own hardware.',
    tag: 'img · arm64',
  },
]

export default function Download() {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>(0)

  const copy = async () => {
    const cmd = 'sudo apt install ./insaneos_0.8.8.6_amd64.deb'
    try {
      await navigator.clipboard.writeText(cmd)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard unavailable (http, permissions): leave the text selectable
    }
  }

  return (
    <section className="sec sec-rule wrap" id="download">
      <div className="sec-head">
        <h2 className="display-2">Take it home.</h2>
        <p className="lede">
          The desktop packages are downloadable today. The ISO, OVA and Pi
          images come off the same pipeline — they attach to releases as the
          build produces them.
        </p>
      </div>
      <div className="dl-grid">
        <div>
          <h3 className="dl-title">Install today, on Debian 13</h3>
          <div className="term">
            <div className="term-bar">
              <span className="term-title">shell</span>
              <button type="button" className="copy" onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre tabIndex={0}>
              <span className="tl-prompt">$ </span>
              sudo apt install ./insaneos-hwdata_2026.11.06_all.deb{'\n'}
              <span className="tl-prompt">$ </span>
              sudo apt install ./insaneos-rclone_1.75.2-1_amd64.deb{'\n'}
              <span className="tl-prompt">$ </span>
              sudo apt install ./insaneos_0.8.8.6_amd64.deb
            </pre>
          </div>
          <p className="term-note">
            Download the three packages from the release below, keep them in
            one folder, and install them together — the desktop installs{' '}
            <em>beside</em> your current one: your files, settings and session
            are copied, never moved, and nothing is deleted.
          </p>
          <h3 className="dl-title dl-title-gap">Build the images yourself</h3>
          <p className="dl-build-note">
            The same pipeline that makes the releases lives in the repo — an
            amd64 machine with Debian 13 produces the ISO and the OVA:
          </p>
          <div className="term docs-term">
            <div className="term-bar">
              <span className="term-title">shell</span>
            </div>
            <pre tabIndex={0}>
              <span className="tl-prompt">$ </span>
              sudo tools/iso/build.sh{'\n'}
              <span className="tl-prompt">$ </span>
              sudo tools/iso/build-ova.sh
            </pre>
          </div>
        </div>
        <div>
          <h3 className="dl-title">From the release</h3>
          {MEDIA.map((m) => (
            <a
              className="media-row"
              key={m.name}
              href={m.href ?? RELEASES}
              target="_blank"
              rel="noreferrer"
            >
              <div>
                <span className="media-name">{m.name}</span>
                <span className="media-desc">{m.desc}</span>
              </div>
              <span className="tag">{m.tag}</span>
            </a>
          ))}
          <p className="dl-foot">
            Checksums ship with every release. Step-by-step setup,
            troubleshooting and details:{' '}
            <Link to="/docs" className="dl-docs-link">read the docs</Link>.
          </p>
        </div>
      </div>
    </section>
  )
}
