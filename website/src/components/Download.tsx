import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

const RELEASES = 'https://github.com/explorefaith/InsaneOS/releases'

const MEDIA: Array<{ name: string; desc: string; tag: string }> = [
  { name: 'Insane OS ISO', desc: 'A fresh install on any 64-bit PC.', tag: 'iso · amd64' },
  { name: 'ARM ISO', desc: 'ARM boards and single-board computers.', tag: 'iso · arm64' },
  { name: 'Virtual machine image', desc: 'Import it and boot inside the OS you already run.', tag: 'ova' },
  { name: 'Raspberry Pi image', desc: 'Built for the Pi\u2019s own hardware.', tag: 'img · arm64' },
  { name: 'Debian packages', desc: 'Install the desktop into an existing Debian 13.', tag: 'deb' },
]

export default function Download() {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>(0)

  const copy = async () => {
    const cmd = 'sudo bash upgrade-insaneos.sh'
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
          Images for bare metal, VMs and boards, packages for an existing
          Debian — everything a setup needs ships with every release.
        </p>
      </div>
      <div className="dl-grid">
        <div>
          <h3 className="dl-title">Fresh install, three steps</h3>
          <ol className="dl-steps">
            <li>Download the image for your machine from the release on GitHub.</li>
            <li>Write it to a USB stick with any imager — Insane OS’s own Imager app does this too.</li>
            <li>Boot from the stick and follow the installer.</li>
          </ol>
          <h3 className="dl-title dl-title-gap">On a machine that already runs it</h3>
          <div className="term">
            <div className="term-bar">
              <span className="term-title">shell</span>
              <button type="button" className="copy" onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre tabIndex={0}>
              <span className="tl-prompt">$ </span>
              cd fix{'\n'}
              <span className="tl-prompt">$ </span>
              sudo bash upgrade-insaneos.sh{'\n'}
              <span className="tl-prompt">$ </span>
              sudo reboot
            </pre>
          </div>
          <p className="term-note">
            The upgrade backs up everything it replaces to{' '}
            <code>/var/backups/</code> and writes a one-command revert before
            it touches anything.
          </p>
        </div>
        <div>
          <h3 className="dl-title">Everything in the release</h3>
          {MEDIA.map((m) => (
            <a
              className="media-row"
              key={m.name}
              href={RELEASES}
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
            Checksums and signing keys ship with every release. Requirements
            and step-by-step setup:{' '}
            <Link to="/docs" className="dl-docs-link">read the docs</Link>.
          </p>
        </div>
      </div>
    </section>
  )
}
