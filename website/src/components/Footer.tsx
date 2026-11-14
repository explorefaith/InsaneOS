const REPO = 'https://github.com/explorefaith/InsaneOS'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-top">
          <a className="brand" href="#top">
            <img src="./mark.png" alt="" aria-hidden="true" />
            Insane OS
          </a>
          <p className="footer-tag">Calm on the surface. Peculiar underneath.</p>
        </div>
        <nav className="footer-links" aria-label="Project links">
          <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
          <a href={`${REPO}/releases`} target="_blank" rel="noreferrer">Releases</a>
          <a href="/docs">Docs</a>
          <a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer">GPL license</a>
          <a href={`${REPO}/blob/main/THIRD_PARTY.md`} target="_blank" rel="noreferrer">Third-party notices</a>
        </nav>
        <p className="footer-fine">
          Built on Debian GNU/Linux. The Insane OS edition, rebrand and
          engineering by explorearafat. No telemetry, no account, no server.
        </p>
      </div>
    </footer>
  )
}
