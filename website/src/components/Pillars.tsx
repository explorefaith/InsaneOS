const PILLARS = [
  {
    title: 'A living desktop',
    body: [
      'The wallpaper is a hardware-decoded video that pauses when you don\u2019t need it, so the desktop costs nothing while you work. Glass widgets show the time and live system stats, re-inked to match the wallpaper\u2019s own colours.',
    ],
  },
  {
    title: 'Written in C, measured in microseconds',
    body: [
      'One 21 MB compositor binary does everything you see: damage-tracked painting with a GPU path that falls back to the CPU and stays smooth. Around five seconds from power button to userspace.',
    ],
  },
  {
    title: 'Private by construction',
    body: [
      'Per-app permissions for camera, microphone, files and network. A firewall you can watch on a live map. Helpers confined with Landlock and seccomp, a password vault with per-app keyring isolation, signed packages, and system code verified at boot.',
    ],
  },
]

export default function Pillars() {
  return (
    <section className="sec sec-rule wrap" id="built">
      <div className="sec-head">
        <h2 className="display-2">What makes it Insane.</h2>
        <p className="lede">
          Three decisions carry the whole system. Each one is visible from the
          first boot, and each one is traceable to a line of C.
        </p>
      </div>
      {PILLARS.map((p) => (
        <article className="pillar" key={p.title}>
          <h3>{p.title}</h3>
          <div className="pillar-body">
            {p.body.map((para) => (
              <p key={para.slice(0, 24)}>{para}</p>
            ))}
          </div>
        </article>
      ))}
    </section>
  )
}
