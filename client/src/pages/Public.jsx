import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../App'
import { pictureError } from '../pictures'

export function Landing() {
  const [board, setBoard] = useState(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    api.get('/api/board').then(setBoard).catch(() => setMissing(true))
  }, [])
  return (
    <div className="public-wrap" id="content">
      <header className="public-nav">
        <a className="brand brand-light" href="/">
          <img className="brand-mark" src="/bup-logo.png" alt="BUP" />
          <span><strong>HallMeal</strong><small>Residential dining</small></span>
        </a>
        <div className="public-actions">
          <Link className="btn btn-quiet" to="/signup">Request account</Link>
          <Link className="btn btn-accent" to="/login">Sign in</Link>
        </div>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Smart Hall Meal Management</p>
          <h1>Every plate accounted for.</h1>
          <p className="lede">Students turn breakfast, lunch, and dinner on or off before a cutoff the hall office can move. Staff enter the bazar. The rate splits itself, and every balance stays visible.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary btn-lg" to="/login">Sign in</Link>
            <Link className="btn btn-accent btn-lg" to="/signup">Request a student account</Link>
            <a className="btn btn-quiet btn-lg" href="#how">How a rate is split</a>
          </div>
        </div>
        <aside className="menu-board" aria-label="Today's menu">
          <p className="board-kicker">Tonight's board</p>
          <h2>{board ? board.dateLabel : 'Menu board'}</h2>
          <div className="board-rule" />
          {missing ? <p className="board-empty">The board appears once MongoDB is connected.</p> : null}
          {board ? board.meals.map((meal) => (
            <article className="board-row" key={meal.key}>
              <div>
                <p className="board-meal">{meal.label}</p>
                <p>{meal.items}</p>
              </div>
              <div>
                <strong>{meal.count}</strong>
                <small>{meal.lock.open ? 'Open' : 'Closed'}</small>
              </div>
            </article>
          )) : null}
        </aside>
      </section>
      <section className="feature-grid" id="how">
        <article className="feature">
          <p className="eyebrow">01</p>
          <h3>Mark the meal</h3>
          <p>A student turns a meal on before the lock. After that clock, the choice stays unless the mess desk corrects the sheet.</p>
        </article>
        <article className="feature">
          <p className="eyebrow">02</p>
          <h3>Enter the bazar</h3>
          <p>Staff write what breakfast, lunch, and dinner actually cost. The headcount is whoever is marked on for that meal.</p>
        </article>
        <article className="feature">
          <p className="eyebrow">03</p>
          <h3>Split it in the open</h3>
          <p>Rate = bazar ÷ students on that meal, rounded down to the paisa. What does not divide evenly stays on the report, so the market bill still matches.</p>
        </article>
      </section>
      <footer className="public-foot">
        <p>Smart Hall Meal Management System</p>
        <p>React and MongoDB for residential hall dining.</p>
      </footer>
    </div>
  )
}

export function Login() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.post('/api/login', { email, password })
      await auth.refresh()
      navigate('/app')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell" id="content">
      <section className="auth-aside">
        <Link className="brand brand-on-dark" to="/">
          <img className="brand-mark" src="/bup-logo.png" alt="BUP" />
          <span><strong>HallMeal</strong><small>{auth.hallName}</small></span>
        </Link>
        <div>
          <p className="eyebrow eyebrow-light">Sign in to your desk</p>
          <h1>The mess book lives here now.</h1>
          <p>Students, mess staff, and the hall office each see only their own work.</p>
        </div>
        <p className="aside-note">Lock times, deposits, and meal rates are kept in MongoDB.</p>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={onSubmit}>
          <h2>Welcome back</h2>
          {params.get('requested') ? <p className="banner is-ok">Request received. You can sign in after the hall office approves the account.</p> : null}
          {error ? <p className="banner is-bad">{error}</p> : null}
          <label>Email <span className="req-star" aria-hidden="true">*</span>
            <input className="form-control" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
          </label>
          <label>Password <span className="req-star" aria-hidden="true">*</span>
            <input className="form-control" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          </label>
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="auth-switch">New student? <Link to="/signup">Request an account</Link>. The hall office turns it on after checking the details.</p>
        </form>
        <aside className="demo-accounts">
          <p className="eyebrow">Demonstration accounts</p>
          <ul>
            <li><span>Administrator</span><code>admin@buphall.edu</code><code>Admin@123</code></li>
            <li><span>Mess staff</span><code>staff@buphall.edu</code><code>Staff@123</code></li>
            <li><span>Student</span><code>ayesha@buphall.edu</code><code>Student@123</code></li>
          </ul>
          <p>Other seeded students use <code>Student@123</code>.</p>
        </aside>
      </section>
    </div>
  )
}

export function Signup() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ fullName: '', email: '', studentCode: '', roomNo: '', phone: '', password: '', confirm: '' })
  const [photo, setPhoto] = useState(null)
  const [idCard, setIdCard] = useState(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [idUrl, setIdUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  function set(key) {
    return (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  }
  function choosePicture(kind) {
    return (event) => {
      const file = event.target.files && event.target.files[0]
      if (!file) return
      const problem = pictureError(file)
      if (problem) {
        setError(problem)
        event.target.value = ''
        return
      }
      setError('')
      const url = file ? URL.createObjectURL(file) : ''
      if (kind === 'photo') {
        if (photoUrl) URL.revokeObjectURL(photoUrl)
        setPhoto(file || null)
        setPhotoUrl(url)
      } else {
        if (idUrl) URL.revokeObjectURL(idUrl)
        setIdCard(file || null)
        setIdUrl(url)
      }
    }
  }
  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (!idCard) throw new Error('Add a photo of your ID card.')
      const body = new FormData()
      Object.entries(form).forEach(([key, value]) => body.append(key, value))
      body.append('idCard', idCard)
      if (photo) body.append('photo', photo)
      await api.upload('/api/signup', body)
      navigate('/login?requested=1')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="auth-shell" id="content">
      <section className="auth-aside">
        <Link className="brand brand-on-dark" to="/">
          <img className="brand-mark" src="/bup-logo.png" alt="BUP" />
          <span><strong>HallMeal</strong><small>{auth.hallName}</small></span>
        </Link>
        <div>
          <p className="eyebrow eyebrow-light">Student account</p>
          <h1>Ask the hall office to let you in.</h1>
          <p>Send your name, an ID, a photo of that ID card, a mobile number, and a password. A star marks every required field. You can sign in only after an administrator approves the request.</p>
        </div>
        <p className="aside-note">Staff and administrator accounts are created by the hall office.</p>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={onSubmit}>
          <h2>Request an account</h2>
          {error ? <p className="banner is-bad">{error}</p> : null}
          <label>Full name <span className="req-star" aria-hidden="true">*</span><input className="form-control" value={form.fullName} onChange={set('fullName')} required /></label>
          <label>Email <span className="req-star" aria-hidden="true">*</span><input className="form-control" type="email" value={form.email} onChange={set('email')} required /></label>
          <div className="pair">
            <label>ID <span className="req-star" aria-hidden="true">*</span><input className="form-control" value={form.studentCode} onChange={set('studentCode')} required /></label>
            <label>Room<input className="form-control" value={form.roomNo} onChange={set('roomNo')} /></label>
          </div>
          <label>Mobile number <span className="req-star" aria-hidden="true">*</span><input className="form-control" value={form.phone} onChange={set('phone')} inputMode="tel" required /></label>
          <label>Profile photo
            <input className="form-control" name="photo" type="file" accept="image/jpeg,image/png" onChange={choosePicture('photo')} />
          </label>
          {photoUrl ? <img className="portrait is-large" src={photoUrl} alt="" /> : null}
          <p className="stat-hint">Optional. JPG or PNG, 1 MB or smaller.</p>
          <label>ID card <span className="req-star" aria-hidden="true">*</span>
            <input className="form-control" name="idCard" type="file" accept="image/jpeg,image/png" onChange={choosePicture('idCard')} required />
          </label>
          {idUrl ? <img className="id-card" src={idUrl} alt="Selected ID card" /> : null}
          <p className="stat-hint">A clear photo of your university ID card. JPG or PNG, 1 MB or smaller.</p>
          <div className="pair">
            <label>Password <span className="req-star" aria-hidden="true">*</span><input className="form-control" type="password" value={form.password} onChange={set('password')} minLength={6} required /></label>
            <label>Confirm password <span className="req-star" aria-hidden="true">*</span><input className="form-control" type="password" value={form.confirm} onChange={set('confirm')} minLength={6} required /></label>
          </div>
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
          <p className="auth-switch">Already approved? <Link to="/login">Sign in</Link></p>
        </form>
      </section>
    </div>
  )
}
