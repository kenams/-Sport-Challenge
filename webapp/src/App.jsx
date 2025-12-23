import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import NavTabs from './components/NavTabs'
import Home from './pages/Home'
import Sports from './pages/Sports'
import Live from './pages/Live'
import Bets from './pages/Bets'
import Coach from './pages/Coach'

export default function App() {
  return (
    <div className="app-root">
      <header className="brand">
        <div className="logo">SPORTCLASH</div>
        <nav className="topnav">
          <button className="profile">Profil</button>
        </nav>
      </header>
      <NavTabs />
      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sports" element={<Sports />} />
          <Route path="/live" element={<Live />} />
          <Route path="/bets" element={<Bets />} />
          <Route path="/coach" element={<Coach />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="footer">© SportClash</footer>
    </div>
  )
}
