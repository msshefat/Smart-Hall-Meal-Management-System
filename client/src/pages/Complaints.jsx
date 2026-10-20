import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import { Banner, PageHead, Star } from '../Shell'

export default function Complaints() {
  const { user } = useAuth()
  return user.role === 'admin' ? <AdminComplaints /> : <StudentComplaints />
}

function StudentComplaints() {
  const [rows, setRows] = useState(null)
  const [form, setForm] = useState({ subject: '', message: '' })
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  function load() {
    return api.get('/api/complaints').then((data) => setRows(data.complaints))
  }
  useEffect(() => { load().catch((err) => setError(err.message)) }, [])
  async function send(event) {
    event.preventDefault()
    setError('')
    try {
      const result = await api.post('/api/complaints', form)
      setNote(result.message)
      setForm({ subject: '', message: '' })
      await load()
    } catch (err) {
      setNote('')
      setError(err.message)
    }
  }
  return (
    <>
      <PageHead eyebrow="Hall office" title="Complaints" lede="Write when the rice is cold or a meal did not match the board. The office replies on the same note." />
      <Banner message={note} />
      <Banner message={error} kind="error" />
      <form className="panel form-grid narrow" onSubmit={send}>
        <label>Subject <Star /><input className="form-control" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} required /></label>
        <label>Message <Star /><textarea className="form-control" rows={4} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} required /></label>
        <button className="btn btn-primary" type="submit">Send to the office</button>
      </form>
      <ComplaintList rows={rows} />
    </>
  )
}

function AdminComplaints() {
  const [status, setStatus] = useState('open')
  const [rows, setRows] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    api.get(`/api/complaints/manage?status=${status}`).then((data) => setRows(data.complaints)).catch((err) => setError(err.message))
  }, [status, note])
  async function save(id, event) {
    event.preventDefault()
    const body = new FormData(event.target)
    try {
      const result = await api.post(`/api/complaints/${id}`, { status: body.get('status'), adminReply: body.get('adminReply') })
      setNote(result.message)
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <>
      <PageHead eyebrow="Queue" title="Complaints" lede="Reply on the note. Students see the status and your answer on their own page." />
      <Banner message={note} />
      <Banner message={error} kind="error" />
      <div className="datebar">
        {['open', 'in_review', 'resolved', 'closed', 'all'].map((item) => (
          <button key={item} className={`btn ${status === item ? 'btn-primary' : 'btn-quiet'}`} type="button" onClick={() => setStatus(item)}>{item.replace('_', ' ')}</button>
        ))}
      </div>
      <div className="stack">
        {(rows || []).map((row) => (
          <article className="panel" key={row.id}>
            <div className="section-title">
              <h2>{row.subject}</h2>
              <span className={`status st-${row.status}`}>{row.status.replace('_', ' ')}</span>
            </div>
            <p>{row.message}</p>
            <p className="stat-hint">{row.fullName} · {row.roomNo || 'No room'} · {row.when}</p>
            <form className="form-grid" onSubmit={(event) => save(row.id, event)}>
              <label>Status
                <select className="form-select" name="status" defaultValue={row.status}>
                  {['open', 'in_review', 'resolved', 'closed'].map((item) => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}
                </select>
              </label>
              <label>Reply<textarea className="form-control" name="adminReply" rows={3} defaultValue={row.adminReply} /></label>
              <button className="btn btn-primary" type="submit">Save reply</button>
            </form>
          </article>
        ))}
        {rows && !rows.length ? <p className="empty">Nothing in this queue.</p> : null}
      </div>
    </>
  )
}

function ComplaintList({ rows }) {
  if (!rows) return <p className="empty">Loading notes…</p>
  if (!rows.length) return <p className="empty">You have not written to the office yet.</p>
  return (
    <div className="stack">
      {rows.map((row) => (
        <article className="panel" key={row.id}>
          <div className="section-title"><h2>{row.subject}</h2><span className={`status st-${row.status}`}>{row.status.replace('_', ' ')}</span></div>
          <p>{row.message}</p>
          <p className="stat-hint">{row.when}</p>
          {row.adminReply ? <blockquote>{row.adminReply}</blockquote> : null}
        </article>
      ))}
    </div>
  )
}
