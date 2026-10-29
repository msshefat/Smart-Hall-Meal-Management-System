import { useState } from 'react'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { api } from './api'
import { useAuth } from './App'

const LINKS = {
  student: [
    ['/app', 'Overview', true],
    ['/app/orders', 'Order meals'],
    ['/app/menu', 'Menu board'],
    ['/app/billing', 'Expenses'],
    ['/app/stats', 'Statistics'],
    ['/app/complaints', 'Complaints'],
    ['/app/notices', 'Notices']
  ],
  staff: [
    ['/app', 'Mess desk', true],
    ['/app/records', 'Meal records'],
    ['/app/serving', 'Meal taken'],
    ['/app/costs', 'Bazar costs'],
    ['/app/menu', 'Menu board'],
    ['/app/reports', 'Reports'],
    ['/app/notices', 'Notices']
  ],
  admin: [
    ['/app', 'Hall office', true],
    ['/app/users', 'People'],
    ['/app/menu', 'Menus'],
    ['/app/records', 'Meal records'],
    ['/app/serving', 'Meal taken'],
    ['/app/costs', 'Bazar costs'],
    ['/app/settings', 'Lock times'],
    ['/app/balances', 'Balances'],
    ['/app/complaints', 'Complaints'],
    ['/app/notices', 'Notices'],
    ['/app/reports', 'Reports'],
    ['/app/activity', 'Activity']
  ]
}

export default function Shell() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  if (auth.loading) return <p className="empty public-wait">Opening your desk…</p>
  if (!auth.user) return <Navigate to="/login" replace />

  async function signOut() {
    await api.post('/api/logout', {})
    await auth.refresh()
    navigate('/login')
  }

  const links = LINKS[auth.user.role] || []
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'is-open' : ''}`} id="sidebar">
        <a className="brand" href="/app">
          <img className="brand-mark" src="/bup-logo.png" alt="BUP" />
          <span>
            <strong>HallMeal</strong>
            <small>{auth.hallName}</small>
          </span>
        </a>
        <nav className="side-nav" aria-label="Hall sections">
          {links.map(([to, label, end]) => (
            <NavLink key={to} to={to} end={Boolean(end)} className={({ isActive }) => `side-link ${isActive ? 'is-active' : ''}`} onClick={() => setOpen(false)}>
              {label}
              {to === '/app/users' && auth.pendingSignups > 0 ? <span className="nav-count">{auth.pendingSignups}</span> : null}
              {to === '/app/balances' && auth.pendingDeposits > 0 ? <span className="nav-count">{auth.pendingDeposits}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <NavLink to="/app/profile" className={({ isActive }) => `side-link ${isActive ? 'is-active' : ''}`} onClick={() => setOpen(false)}>Profile</NavLink>
          <button className="side-link side-button" type="button" onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button className="nav-toggle" type="button" aria-label="Open menu" onClick={() => setOpen(true)}>Menu</button>
          <p className="topbar-clock">Hall time · {auth.hallNow}</p>
          <div className="who">
            {auth.user.role === 'student' ? <a className={`balance-chip ${auth.user.balance < 0 ? 'is-due' : ''}`} href="/app/billing">{auth.user.balanceLabel}</a> : null}
            <Portrait user={auth.user} />
            <div>
              <p className="who-name">{auth.user.fullName}</p>
              <p className="who-role">{auth.user.role}</p>
            </div>
            <button className="btn btn-quiet btn-signout" type="button" onClick={signOut}>Sign out</button>
          </div>
        </header>
        <main className="content" id="content">
          <DebtNotice user={auth.user} />
          <Outlet />
        </main>
      </div>
      <div className="scrim" hidden={!open} onClick={() => setOpen(false)} />
    </div>
  )
}

export function DebtNotice({ user }) {
  if (!user || user.role !== 'student' || !user.inDebt) return null
  const text = user.orderingBlocked
    ? `Your balance is ${user.balanceLabel}. New meals are closed once it goes past −৳500. You can still turn a meal off, and the hall office can add money.`
    : `Your balance is ${user.balanceLabel}. You can still order meals until it goes past −৳500.`
  return <p className="callout" role="status">{text}</p>
}

export function PageHead({ eyebrow, title, lede, children }) {
  return (
    <header className="page-head">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {children}
    </header>
  )
}

export function Star() {
  return <span className="req-star" aria-hidden="true">*</span>
}

export function Portrait({ user, className = 'portrait' }) {
  const letter = (user?.fullName || '?').trim().charAt(0).toUpperCase() || '?'
  if (user?.hasPhoto && user.id) {
    return <img className={className} src={`/api/media/${user.id}/photo`} alt="" />
  }
  return <span className={`${className} is-empty`} aria-hidden="true">{letter}</span>
}

export function Banner({ message, kind = 'ok' }) {
  if (!message) return null
  return <p className={`banner ${kind === 'error' ? 'is-bad' : 'is-ok'}`} role="status">{message}</p>
}

export function useBusy() {
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  return { error, note, setError, setNote, fail(err) { setNote(''); setError(err.message) }, ok(message) { setError(''); setNote(message) } }
}
