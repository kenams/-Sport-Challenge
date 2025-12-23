import React from 'react'
import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Accueil' },
  { to: '/sports', label: 'Disciplines' },
  { to: '/live', label: 'Live' },
  { to: '/bets', label: 'Paris' },
  { to: '/coach', label: 'Coach IA' },
]

export default function NavTabs() {
  return (
    <div className="navtabs">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} className={({isActive}) => isActive ? 'tab active' : 'tab'}>
          {t.label}
        </NavLink>
      ))}
    </div>
  )
}
