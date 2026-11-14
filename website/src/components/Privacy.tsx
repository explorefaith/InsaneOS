const MECHANISMS = [
  {
    name: 'Per-app permissions',
    text: 'Camera, microphone, files and network are granted per app, revocable at any moment.',
  },
  {
    name: 'A firewall you can watch',
    text: 'Connections are shown live on a map. Nothing leaves the machine without a visible reason.',
  },
  {
    name: 'Sandboxed helpers',
    text: 'Landlock and seccomp confine every helper to exactly what it needs.',
  },
  {
    name: 'A vault that keeps to itself',
    text: 'The password vault isolates keyrings per app, so one breach stays one.',
  },
  {
    name: 'Signed packages',
    text: 'The Store verifies what it installs, end to end.',
  },
  {
    name: 'Verified at boot',
    text: 'System code is checked before your session starts.',
  },
]

export default function Privacy() {
  return (
    <section className="sec wrap" id="private">
      <div className="pod">
        <h2 className="display-2">No telemetry. No account. No server.</h2>
        <p className="pod-lede">
          There is nothing to phone home to, so nothing does. Crash logs stay
          in your home folder, and privacy is built into the system rather than
          bolted on after it.
        </p>
        <ul className="pod-list">
          {MECHANISMS.map((m) => (
            <li key={m.name}>
              <span className="dot" aria-hidden="true" />
              <div>
                <strong>{m.name}</strong>
                <span>{m.text}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
