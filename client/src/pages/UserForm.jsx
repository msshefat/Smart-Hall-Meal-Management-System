import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../App'
import MealQr from '../MealQr'
import { Banner, PageHead, Portrait, Star } from '../Shell'

const empty = { fullName: '', email: '', role: 'student', studentCode: '', roomNo: '', phone: '', status: 'active', password: '', balance: '0' }

export default function UserForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const auth = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(empty)
  const [issuedCode, setIssuedCode] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    api.get(`/api/users/${id}`).then((data) => {
      setForm({ ...empty, ...data.user, password: '', balance: '0' })
      setIssuedCode(data.user.studentCode || '')
    }).catch((err) => setError(err.message))
  }, [id])

  function set(key) {
    return (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  }

  async function remove() {
    const sure = window.confirm(`Delete ${form.fullName}? Their profile is removed, including meals and balance. This cannot be undone.`)
    if (!sure) return
    try {
      const result = await api.delete(`/api/users/${id}`)
      navigate('/app/users', { state: { note: result.message } })
    } catch (err) {
      setError(err.message)
    }
  }

  async function save(event) {
    event.preventDefault()
    setError('')
    try {
      const result = editing ? await api.put(`/api/users/${id}`, form) : await api.post('/api/users', form)
      navigate('/app/users', { state: { note: result.message } })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <PageHead eyebrow="Directory" title={editing ? 'Edit person' : 'Add person'} lede={editing ? 'Leave the password blank to keep the current one. ID and mobile stay required.' : 'Every person needs an ID and a mobile number. Share the password. They can change it after signing in.'} />
      <form className="panel form-grid narrow" onSubmit={save}>
        <Banner message={error} kind="error" />
        {editing && form.id ? (
          <div className="picture-row">
            <div>
              <p className="stat-label">Profile photo</p>
              <Portrait className="portrait is-large" user={form} />
            </div>
            <div>
              <p className="stat-label">ID card</p>
              {form.hasIdCard ? <a href={`/api/media/${form.id}/id-card`} target="_blank" rel="noreferrer"><img className="id-card" src={`/api/media/${form.id}/id-card`} alt={`ID card for ${form.fullName}`} /></a> : <p className="empty">No ID card on file.</p>}
            </div>
          </div>
        ) : null}
        {editing && issuedCode ? (
          <div className="meal-card-block">
            <p className="stat-label">Meal card</p>
            <MealQr studentCode={issuedCode} name={form.fullName} />
            {form.studentCode !== issuedCode ? <p className="stat-hint">Save the new ID before printing a replacement card.</p> : null}
          </div>
        ) : null}
        <label>Full name <Star /><input className="form-control" value={form.fullName} onChange={set('fullName')} required /></label>
        <label>Email <Star /><input className="form-control" type="email" value={form.email} onChange={set('email')} required /></label>
        <label>Role <Star />
          <select className="form-select" value={form.role} onChange={set('role')}>
            {['student', 'staff', 'admin'].map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </label>
        <div className="pair">
          <label>ID <Star /><input className="form-control" value={form.studentCode || ''} onChange={set('studentCode')} required /></label>
          <label>Room<input className="form-control" value={form.roomNo || ''} onChange={set('roomNo')} /></label>
        </div>
        <label>Mobile number <Star /><input className="form-control" value={form.phone || ''} onChange={set('phone')} inputMode="tel" required /></label>
        <label>Status <Star />
          <select className="form-select" value={form.status} onChange={set('status')}>
            <option value="active">Active</option>
            <option value="pending">Waiting for approval</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label>{editing ? 'New password (optional)' : <>Password <Star /></>}
          <input className="form-control" type="text" value={form.password} onChange={set('password')} minLength={editing ? undefined : 6} required={!editing} autoComplete="new-password" />
        </label>
        {!editing ? <label>Opening balance for a student (TK )<input className="form-control" type="number" min="0" step="0.01" value={form.balance} onChange={set('balance')} /></label> : null}
        <div className="page-actions">
          <button className="btn btn-primary" type="submit">{editing ? 'Save changes' : 'Create account'}</button>
          <Link className="btn btn-quiet" to="/app/users">Cancel</Link>
          {editing && id !== auth.user.id ? <button className="btn btn-quiet is-delete" type="button" onClick={remove}>Delete profile</button> : null}
        </div>
      </form>
    </>
  )
}
