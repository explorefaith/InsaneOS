import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../hooks'

const BOOT_OUTPUT = [
  'insane-server — C11, Wayland',
  'init: userspace ready in 4.8 s',
  'compositor: 21 MB binary',
  'paint: damage-tracked, GPU path',
] as const

function DockGlyph({ kind }: { kind: 'files' | 'terminal' | 'mail' | 'calendar' | 'monitor' | 'store' }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (kind) {
    case 'files':
      return (
        <svg viewBox="0 0 18 18" aria-hidden="true">
          <path d="M2.5 5.5a1.5 1.5 0 0 1 1.5-1.5h3l1.6 1.8h5.9a1.5 1.5 0 0 1 1.5 1.5v6.2a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5Z" {...s} />
        </svg>
      )
    case 'terminal':
      return (
        <svg viewBox="0 0 18 18" aria-hidden="true">
          <path d="M3.5 5.5 6.5 8.5 3.5 11.5" {...s} />
          <path d="M8.5 12.5h6" {...s} />
        </svg>
      )
    case 'mail':
      return (
        <svg viewBox="0 0 18 18" aria-hidden="true">
          <rect x="2.5" y="4.5" width="13" height="9" rx="1.5" {...s} />
          <path d="m3.5 6 5.5 4 5.5-4" {...s} />
        </svg>
      )
    case 'calendar':
      return (
        <svg viewBox="0 0 18 18" aria-hidden="true">
          <rect x="3" y="4" width="12" height="11" rx="1.5" {...s} />
          <path d="M3 7.5h12M6 2.8v2.4M12 2.8v2.4" {...s} />
        </svg>
      )
    case 'monitor':
      return (
        <svg viewBox="0 0 18 18" aria-hidden="true">
          <path d="M2.5 9.5h3l2-4.5 3 8 2-3.5h3" {...s} />
        </svg>
      )
    case 'store':
      return (
        <svg viewBox="0 0 18 18" aria-hidden="true">
          <path d="M3.5 6.5h11l-1 8.5h-9Z" {...s} />
          <path d="M6.5 8V5.5a2.5 2.5 0 0 1 5 0V8" {...s} />
        </svg>
      )
  }
}

function BootMock() {
  const reduced = useReducedMotion()
  const [typed, setTyped] = useState(reduced ? 'boot' : '')
  const [lines, setLines] = useState<number>(reduced ? BOOT_OUTPUT.length : 0)
  const [booted, setBooted] = useState(reduced)
  const timers = useRef<number[]>([])

  useEffect(() => {
    if (reduced) return
    const later = (fn: () => void, at: number) =>
      timers.current.push(window.setTimeout(fn, at))

    // type the command
    const cmd = 'boot'
    for (let i = 1; i <= cmd.length; i++) {
      later(() => setTyped(cmd.slice(0, i)), 500 + i * 70)
    }
    // print output lines
    let at = 500 + cmd.length * 70 + 420
    BOOT_OUTPUT.forEach((_, i) => {
      later(() => setLines(i + 1), at)
      at += 480
    })
    // desktop assembles
    later(() => setBooted(true), at + 560)
    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [reduced])

  return (
    <div className={`mock${booted ? ' booted' : ''}`}>
      <div className="mock-screen" role="img" aria-label="The Insane OS desktop finishing a boot: a terminal prints the boot log while the menu bar, glass widgets and dock appear.">
        <div className="mock-menubar">
          <img src="./mark.png" alt="" aria-hidden="true" />
          <span>Files</span>
          <span>Terminal</span>
          <span className="mb-right">
            wed 04:14
            <span className="mb-batt" aria-hidden="true" />
          </span>
        </div>

        <div className="mock-terminal" aria-hidden="true">
          <div className="mt-bar">
            <span className="mt-lights"><i /><i /><i /></span>
            <span className="mt-title">Terminal</span>
          </div>
          <div className="mt-body">
            <div className="tl-cmd">
              <span className="tl-prompt">arafat@faith:~$ </span>
              {typed}
              {lines < BOOT_OUTPUT.length && <span className="tl-caret" />}
            </div>
            {BOOT_OUTPUT.slice(0, lines).map((line) => (
              <div key={line}>{line}</div>
            ))}
            {lines === BOOT_OUTPUT.length && (
              <div className="tl-ready">desktop ready</div>
            )}
          </div>
        </div>

        <div className="mock-widget w-clock" aria-hidden="true">
          <div className="w-time">04:14</div>
          <div className="w-date">Wednesday, 11 November</div>
        </div>

        <div className="mock-widget w-stats" aria-hidden="true">
          <div className="w-label">SYSTEM</div>
          <div className="w-row">
            <span>CPU</span>
            <span className="track"><i style={{ width: '34%' }} /></span>
          </div>
          <div className="w-row">
            <span>Memory</span>
            <span className="track"><i style={{ width: '61%' }} /></span>
          </div>
          <div className="w-row">
            <span>Decode</span>
            <span className="track"><i style={{ width: '52%' }} /></span>
          </div>
        </div>

        <div className="mock-dock" aria-hidden="true">
          {(['files', 'terminal', 'mail', 'calendar', 'monitor', 'store'] as const).map(
            (kind) => (
              <span key={kind} className={`dock-tile${kind === 'terminal' ? ' dark' : ''}`}>
                <DockGlyph kind={kind} />
              </span>
            ),
          )}
        </div>
      </div>
      <p className="mock-cap">On real hardware, this takes about five seconds.</p>
    </div>
  )
}

export default function Hero() {
  return (
    <section className="hero wrap" id="top">
      <div className="hero-grid">
        <div className="hero-copy">
          <h1 className="display-1">The desktop written in C.</h1>
          <p className="lede hero-lede">
            Insane OS is a Debian-based operating system with its own Wayland
            compositor, interface engine and native apps — built from scratch,
            line by line, in C11. No inherited desktop stack. The whole display
            stack is code you can read to the end.
          </p>
          <div className="hero-actions">
            <a className="btn btn-solid" href="#download">Download the ISO</a>
            <a className="btn btn-ghost" href="#built">See what makes it Insane</a>
          </div>
          <p className="hero-note">Free and open source under the GPL. Runs on any 64-bit PC.</p>
        </div>
        <BootMock />
      </div>
    </section>
  )
}
