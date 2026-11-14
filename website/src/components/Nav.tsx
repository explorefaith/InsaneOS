import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useScrollSpy } from '../hooks'

const SECTIONS = ['measured', 'built', 'gallery', 'private', 'apps']
const NAV_HEIGHT = 64

const LINKS: Array<{ id: string; label: string }> = [
  { id: 'measured', label: 'Measured' },
  { id: 'built', label: 'Built' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'private', label: 'Private' },
  { id: 'apps', label: 'Apps' },
]

export default function Nav() {
  const { active, scrolled } = useScrollSpy(SECTIONS, NAV_HEIGHT)
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const [indicator, setIndicator] = useState({ x: 0, w: 0, ready: false })

  useLayoutEffect(() => {
    const move = () => {
      const el = linkRefs.current[active]
      if (!el) {
        setIndicator((s) => ({ ...s, ready: false }))
        return
      }
      setIndicator({ x: el.offsetLeft, w: el.offsetWidth, ready: true })
    }
    move()
    window.addEventListener('resize', move)
    return () => window.removeEventListener('resize', move)
  }, [active])

  // hide the pill entirely while fonts settle and no section is active
  useEffect(() => {
    document.fonts?.ready.then(() =>
      setIndicator((s) => ({ ...s, ready: true })),
    )
  }, [])

  return (
    <header className={`nav${scrolled ? ' is-scrolled' : ''}`}>
      <div className="wrap nav-inner">
        <a className="brand" href="#top">
          <img src="./mark.png" alt="" aria-hidden="true" />
          Insane OS
        </a>
        <nav className="nav-links" aria-label="Sections">
          <span
            className="nav-indicator"
            style={{
              transform: `translate(${indicator.x}px, -50%)`,
              width: indicator.w,
              opacity: indicator.ready && active ? 1 : 0,
            }}
          />
          {LINKS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className={`nav-link${active === id ? ' active' : ''}`}
              ref={(el) => {
                linkRefs.current[id] = el
              }}
            >
              {label}
            </a>
          ))}
        </nav>
        <a className="btn btn-solid btn-sm nav-cta" href="#download">
          Download
        </a>
      </div>
    </header>
  )
}
