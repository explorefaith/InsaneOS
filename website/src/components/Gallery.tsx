import { useState } from 'react'
import { useReducedMotion } from '../hooks'

type Shot = {
  src: string
  alt: string
  title: string
  text: string
}

const SHOTS: Shot[] = [
  {
    src: './screenshots/desktop.webp',
    alt: 'Insane OS desktop: glass clock and system widgets over a video wallpaper',
    title: 'The living desktop',
    text: 'A hardware-decoded video wallpaper plays behind glass widgets that show the time and live system stats, re-inked to match the wallpaper\u2019s own colours. It pauses the moment you don\u2019t need it.',
  },
  {
    src: './screenshots/terminal.webp',
    alt: 'The Terminal app with a tabbed shell and a live status bar',
    title: 'A shell that stays out of the way',
    text: 'kash runs on the compositor\u2019s own Wayland: tabbed sessions, a status bar with the real size and time, and nothing else between you and the prompt.',
  },
  {
    src: './screenshots/files.webp',
    alt: 'The Files app showing Home with favorites, tags and search',
    title: 'Files, right where you left them',
    text: 'Favorites, colour tags and instant search in a browser that paints as fast as the machine allows. The status bar tells the truth about what a folder holds.',
  },
  {
    src: './screenshots/appearance.webp',
    alt: 'Settings, Appearance: Insane Flow and Insane Classic styles, dark and light modes',
    title: 'Two styles, switched in place',
    text: 'Insane Flow and Insane Classic carry the same apps. Switching either style — or dark to light — applies right away, without logging out; open windows come back.',
  },
  {
    src: './screenshots/energy.webp',
    alt: 'Settings, Energy: battery health, power profiles and charge limit',
    title: 'Energy that tells the truth',
    text: 'Power profiles through power-profiles-daemon, a charge limit you set, and battery health shown exactly as it is — cycles, wear, and a service recommendation when one is due.',
  },
  {
    src: './screenshots/cooling.webp',
    alt: 'Settings, Cooling: passive cooling at 30 degrees with no controllable fans',
    title: 'Cooling, honestly labelled',
    text: 'When a machine has no fans Insane OS can drive, it says so instead of pretending. Passive cooling gets the same care: the real temperature, refreshed on demand.',
  },
]

const DEPTH = [
  'none',
  'translate(14px, 14px) scale(0.972)',
  'translate(28px, 28px) scale(0.944)',
  'translate(42px, 42px) scale(0.916)',
  'translate(56px, 56px) scale(0.888)',
  'translate(70px, 70px) scale(0.86)',
]

export default function Gallery() {
  const [index, setIndex] = useState(0)
  const reduced = useReducedMotion()
  const n = SHOTS.length

  const next = () => setIndex((i) => (i + 1) % n)

  return (
    <section className="sec sec-rule wrap" id="gallery">
      <div className="sec-head">
        <h2 className="display-2">See it running.</h2>
        <p className="lede">
          The desktop above is a mockup — everything below is the real thing,
          screenshotted on a machine running Insane OS today.
        </p>
      </div>
      <div className="gallery-grid">
        <button
          type="button"
          className="album"
          onClick={next}
          aria-label={`Show next photo (${index + 1} of ${n}: ${SHOTS[index].title})`}
        >
          {SHOTS.map((shot, i) => {
            const pos = (i - index + n) % n
            return (
              <span
                key={shot.src}
                className="album-card"
                style={{
                  transform: reduced ? (pos === 0 ? 'none' : 'scale(0)') : DEPTH[pos],
                  zIndex: n - pos,
                  opacity: pos === 0 ? 1 : pos <= 2 ? 1 : 0,
                  transitionDelay: reduced ? '0ms' : `${(n - pos) * 12}ms`,
                }}
              >
                <img src={shot.src} alt={pos === 0 ? shot.alt : ''} loading="lazy" />
              </span>
            )
          })}
        </button>
        <div className="gallery-copy">
          <div className="gallery-panel" key={index}>
            <h3>{SHOTS[index].title}</h3>
            <p>{SHOTS[index].text}</p>
          </div>
          <div className="gallery-nav" role="tablist" aria-label="Photos">
            {SHOTS.map((shot, i) => (
              <button
                key={shot.src}
                type="button"
                className={`gallery-dot${i === index ? ' active' : ''}`}
                aria-label={`Go to photo ${i + 1}: ${shot.title}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
              />
            ))}
            <span className="gallery-count">
              {index + 1} of {n}
            </span>
          </div>
          <p className="gallery-hint">Click the album for the next photo.</p>
        </div>
      </div>
    </section>
  )
}
