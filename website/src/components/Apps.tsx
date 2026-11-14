const APPS: Array<[string, string]> = [
  ['Files', 'Browse, open and manage your disk.'],
  ['Store', 'Signed packages, installed with a click.'],
  ['Terminal', 'The kash shell, on the compositor\u2019s own Wayland.'],
  ['Monitor', 'Live CPU, memory and processes.'],
  ['Screenshots', 'Capture, with offline OCR built in.'],
  ['Recorder', 'Screen recording, straight to a file.'],
  ['Passwords', 'A vault with per-app keyring isolation.'],
  ['Mail', 'Plain email, nothing in between.'],
  ['Calendar', 'Your days, kept local.'],
  ['Backup', 'Versioned copies of what matters.'],
  ['Cleaner', 'Find and drop what weighs the disk down.'],
  ['Notes', 'Quick notes that stay on the machine.'],
  ['Camera', 'Photos and video, permissioned per app.'],
  ['Settings', 'Permissions, firewall and displays in one place.'],
]

export default function Apps() {
  return (
    <section className="sec sec-rule wrap" id="apps">
      <div className="sec-head">
        <h2 className="display-2">Everything the desktop needs.</h2>
        <p className="lede">
          Native apps, written against the same interface engine as the desktop
          itself. No browser wrappers, no second toolkit, nothing pretending to
          be installed.
        </p>
      </div>
      <div className="apps-grid">
        {APPS.map(([name, desc]) => (
          <div className="app-row" key={name}>
            <span className="app-name">{name}</span>
            <span className="app-desc">{desc}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
