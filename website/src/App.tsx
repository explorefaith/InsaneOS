import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Nav from './components/Nav'
import Hero from './components/Hero'
import Ledger from './components/Ledger'
import Pillars from './components/Pillars'
import Gallery from './components/Gallery'
import Privacy from './components/Privacy'
import Apps from './components/Apps'
import Download from './components/Download'
import Footer from './components/Footer'
import Docs from './pages/Docs'

function ScrollToHash() {
  const location = useLocation()
  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1))
      if (el) {
        el.scrollIntoView()
        return
      }
    }
    window.scrollTo(0, 0)
  }, [location])
  return null
}

function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <Ledger />
        <Pillars />
        <Gallery />
        <Privacy />
        <Apps />
        <Download />
      </main>
      <Footer />
    </>
  )
}

export default function App() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <ScrollToHash />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/docs" element={<><Docs /><Footer /></>} />
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  )
}
