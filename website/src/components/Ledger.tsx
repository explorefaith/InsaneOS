import { useEffect, useRef, useState } from 'react'
import { useInView, useReducedMotion } from '../hooks'

type Spec = {
  name: string
  detail: string
  to?: number
  decimals?: number
  comma?: boolean
  prefix?: string
  unit?: string
}

const SPECS: Spec[] = [
  {
    name: 'Pointer latency',
    detail: 'From your hand to the pixel, on real hardware.',
    to: 0.09,
    decimals: 2,
    unit: 'ms',
  },
  {
    name: 'Userspace boot',
    detail: 'Power button to a working desktop.',
    to: 5,
    prefix: '~',
    unit: 's',
  },
  {
    name: 'Compositor binary',
    detail: 'The whole display stack, one C binary.',
    to: 21,
    unit: 'MB',
  },
  {
    name: 'Mail test checks passed',
    detail: 'The upstream suite, run against this tree.',
    to: 47467,
    comma: true,
  },
  {
    name: 'Engine suite checks',
    detail: 'Damage, layout, text and paint invariants, every tree.',
    to: 8831,
    comma: true,
  },
]

function fmt(value: number, spec: Spec) {
  if (spec.decimals) return value.toFixed(spec.decimals)
  if (spec.comma) return Math.round(value).toLocaleString('en-US')
  return String(Math.round(value))
}

function Count({ spec }: { spec: Spec }) {
  const reduced = useReducedMotion()
  const { ref, inView } = useInView<HTMLSpanElement>(0.5)
  const [value, setValue] = useState(reduced ? (spec.to ?? 0) : 0)
  const started = useRef(false)

  useEffect(() => {
    if (!inView || started.current) return
    started.current = true
    if (reduced || spec.to === undefined) {
      if (spec.to !== undefined) setValue(spec.to)
      return
    }
    const t0 = performance.now()
    const dur = 1100
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(spec.to! * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, reduced, spec])

  return (
    <span ref={ref} className="ledger-value">
      {spec.prefix && <span className="prefix">{spec.prefix}</span>}
      {spec.to !== undefined ? fmt(value, spec) : 'none'}
      {spec.unit && <span className="unit">{spec.unit}</span>}
    </span>
  )
}

export default function Ledger() {
  return (
    <section className="sec sec-rule wrap" id="measured">
      <div className="sec-head">
        <h2 className="display-2">Measured, not marketed.</h2>
        <p className="lede">
          Every number below comes off the machine, not from a slide deck. The
          compositor is one C binary, and these timings are what your hand and
          your eyes actually get.
        </p>
      </div>
      <div className="ledger">
        {SPECS.map((spec) => (
          <div className="ledger-row" key={spec.name}>
            <div>
              <div className="ledger-name">{spec.name}</div>
              <div className="ledger-detail">{spec.detail}</div>
            </div>
            <Count spec={spec} />
          </div>
        ))}
        <div className="ledger-row">
          <div>
            <div className="ledger-name">Telemetry collected</div>
            <div className="ledger-detail">Crash logs stay in your home folder.</div>
          </div>
          <span className="ledger-value none">none</span>
        </div>
      </div>
      <p className="ledger-note">
        Built and tested on Debian 13.7, kernel 6.12. The upstream test suite
        passes; the only failures are environmental.
      </p>
    </section>
  )
}
