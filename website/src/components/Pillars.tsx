const PILLARS = [
  {
    title: 'An island that follows your wallpaper',
    body: [
      'The menu bar is a floating island, and the whole desktop wears the wallpaper\u2019s colours: the compositor reads the picture you set and the bar, panels and accents retint to match \u2014 no theme picker required (it\u2019s the default; six hand-made presets are one click away). The audio visualizer dances to what the machine is actually playing \u2014 a 1024-point FFT over the sink\u2019s monitor in C \u2014 and goes completely still when you are. Weather comes from Open-Meteo, asked once, cached for half an hour, honest when the network is down.',
    ],
  },
  {
    title: 'A living desktop',
    body: [
      'The wallpaper is a hardware-decoded video that pauses when you don\u2019t need it, so the desktop costs nothing while you work. Glass widgets show the time and live system stats, re-inked to match the wallpaper\u2019s own colours. The Control Center\u2019s CPU meter now draws every core, from the kernel\u2019s own counters.',
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
