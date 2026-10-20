import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import { pictureError } from '../pictures'
import MealQr from '../MealQr'
import { Banner, PageHead, Portrait, Star } from '../Shell'

export default function Profile() {
  const auth = useAuth()
  const [form, setForm] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [password, setPassword] = useState({ current: '', next: '' })
  const [passwordNote, setPasswordNote] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [photo, setPhoto] = useState(null)
  const [idCard, setIdCard] = useState(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [idUrl, setIdUrl] = useState('')
  const [pictureNote, setPictureNote] = useState('')
  const [pictureErrorText, setPictureErrorText] = useState('')
  const [pictureBusy, setPictureBusy] = useState(false)

  useEffect(() => {
    if (!auth.user || form) return
    setForm({
      fullName: auth.user.fullName || '',
      roomNo: auth.user.roomNo || '',
      phone: auth.user.phone || ''
    })
  }, [auth.user, form])

  function set(key) {
    return (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  }

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNote('')
    try {
      const result = await api.put('/api/profile', form)
      setNote(result.message)
      await auth.refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function savePassword(event) {
    event.preventDefault()
    setPasswordBusy(true)
    setPasswordError('')
    setPasswordNote('')
    try {
      const result = await api.post('/api/password', password)
      setPasswordNote(result.message)
      setPassword({ current: '', next: '' })
    } catch (err) {
      setPasswordError(err.message)
    } finally {
      setPasswordBusy(false)
    }
  }

  function choosePicture(kind) {
    return (event) => {
      const file = event.target.files && event.target.files[0]
      if (!file) return
      const problem = pictureError(file)
      if (problem) {
        setPictureErrorText(problem)
        event.target.value = ''
        return
      }
      setPictureErrorText('')
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

  async function savePictures(event) {
    event.preventDefault()
    setPictureBusy(true)
    setPictureErrorText('')
    setPictureNote('')
    try {
      if (!photo && !idCard) throw new Error('Choose a picture to save.')
      const body = new FormData()
      if (photo) body.append('photo', photo)
      if (idCard) body.append('idCard', idCard)
      const result = await api.upload('/api/profile/pictures', body, 'PUT')
      setPictureNote(result.message)
      setPhoto(null)
      setIdCard(null)
      if (photoUrl) URL.revokeObjectURL(photoUrl)
      if (idUrl) URL.revokeObjectURL(idUrl)
      setPhotoUrl('')
      setIdUrl('')
      event.target.reset()
      await auth.refresh()
    } catch (err) {
      setPictureErrorText(err.message)
    } finally {
      setPictureBusy(false)
    }
  }

  if (!form) return <p className="empty">Loading your profile…</p>
  return (
    <>
      <PageHead eyebrow="Account" title="Your profile" lede="Update your name, room, mobile number, and pictures. The email stays fixed, and only the hall office can change an ID." />
      <Banner message={note} />
      <Banner message={error} kind="error" />
      <form className="panel form-grid narrow" onSubmit={savePictures}>
        <h2>Pictures</h2>
        <p className="stat-hint">JPG or PNG. Each picture must be 1 MB or smaller.</p>
        <Banner message={pictureNote} />
        <Banner message={pictureErrorText} kind="error" />
        <div className="picture-row">
          <div>
            <label>Profile photo
              {photoUrl ? <img className="portrait is-large" src={photoUrl} alt="" /> : <Portrait className="portrait is-large" user={auth.user} />}
              <input className="form-control" type="file" accept="image/jpeg,image/png" onChange={choosePicture('photo')} />
            </label>
          </div>
          <div>
            <label>ID card
              {idUrl ? <img className="id-card" src={idUrl} alt="Selected ID card" /> : auth.user.hasIdCard ? <img className="id-card" src={`/api/media/${auth.user.id}/id-card`} alt="Your ID card" /> : <p className="empty">No ID card yet.</p>}
              <input className="form-control" type="file" accept="image/jpeg,image/png" onChange={choosePicture('idCard')} />
            </label>
          </div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={pictureBusy}>{pictureBusy ? 'Saving…' : 'Save pictures'}</button>
      </form>
      <section className="panel form-grid narrow">
        <h2>Meal card</h2>
        <p className="stat-hint">This QR code is unique to your ID. The mess desk scans it on Meal taken, and the search field receives your ID.</p>
        <MealQr studentCode={auth.user.studentCode} name={auth.user.fullName} />
      </section>
      <form className="panel form-grid narrow" onSubmit={save}>
        <p className="stat-hint">Signed in as {auth.user.email} · {auth.user.role}</p>
        <label>Full name <Star /><input className="form-control" value={form.fullName} onChange={set('fullName')} required /></label>
        <div className="pair">
          <label>ID
            <input className="form-control" value={auth.user.studentCode || 'Not assigned'} disabled />
          </label>
          <label>Room<input className="form-control" value={form.roomNo} onChange={set('roomNo')} /></label>
        </div>
        <p className="stat-hint">Only an administrator can change an ID.</p>
        <label>Mobile number <Star /><input className="form-control" value={form.phone} onChange={set('phone')} inputMode="tel" required /></label>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
      </form>

      <form className="panel form-grid narrow" onSubmit={savePassword}>
        <h2>Password</h2>
        <p className="stat-hint">Use a password you have not used on another site.</p>
        <Banner message={passwordNote} />
        <Banner message={passwordError} kind="error" />
        <label>Current password <Star /><input className="form-control" type="password" value={password.current} onChange={(event) => setPassword({ ...password, current: event.target.value })} autoComplete="current-password" required /></label>
        <label>New password <Star /><input className="form-control" type="password" minLength={6} value={password.next} onChange={(event) => setPassword({ ...password, next: event.target.value })} autoComplete="new-password" required /></label>
        <button className="btn btn-primary" type="submit" disabled={passwordBusy}>{passwordBusy ? 'Updating…' : 'Update password'}</button>
      </form>
    </>
  )
}
