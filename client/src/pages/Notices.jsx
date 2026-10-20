import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import { Banner, PageHead, Star } from '../Shell'

export default function Notices() {
  const { user } = useAuth()
  return user.role === 'admin' ? <ManageNotices /> : <ReadNotices />
}

function ReadNotices() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.get('/api/notices').then((data) => setRows(data.notices)).catch((err) => setError(err.message)) }, [])
  return (
    <>
      <PageHead eyebrow="Hall board" title="Notices" lede="What the office wants the hall to know this week." />
      <Banner message={error} kind="error" />
      <NoticeList rows={rows} />
    </>
  )
}

function ManageNotices() {
  const [rows, setRows] = useState(null)
  const [form, setForm] = useState({ title: '', body: '' })
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  function load() { return api.get('/api/notices/manage').then((data) => setRows(data.notices)) }
  useEffect(() => { load().catch((err) => setError(err.message)) }, [])
  async function publish(event) {
    event.preventDefault()
    try {
      const result = await api.post('/api/notices', form)
      setNote(result.message)
      setForm({ title: '', body: '' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }
  async function toggle(id) {
    const result = await api.post(`/api/notices/${id}/toggle`, {})
    setNote(result.message)
    await load()
  }
  return (
    <>
      <PageHead eyebrow="Office" title="Notices" lede="Published notices show on the student and staff boards." />
      <Banner message={note} />
      <Banner message={error} kind="error" />
      <form className="panel form-grid narrow" onSubmit={publish}>
        <label>Title <Star /><input className="form-control" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
        <label>Notice <Star /><textarea className="form-control" rows={4} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} required /></label>
        <button className="btn btn-primary" type="submit">Publish</button>
      </form>
      <div className="stack">
        {(rows || []).map((row) => (
          <article className="panel" key={row.id}>
            <div className="section-title">
              <h2>{row.title}</h2>
              <span className={`status ${row.isActive ? 'st-resolved' : 'st-closed'}`}>{row.isActive ? 'Published' : 'Hidden'}</span>
            </div>
            <p>{row.body}</p>
            <p className="stat-hint">{row.when}</p>
            <button className="btn btn-quiet" type="button" onClick={() => toggle(row.id)}>{row.isActive ? 'Hide' : 'Publish again'}</button>
          </article>
        ))}
      </div>
    </>
  )
}

function NoticeList({ rows }) {
  if (!rows) return <p className="empty">Loading notices…</p>
  if (!rows.length) return <p className="empty">No notices are up.</p>
  return (
    <div className="stack">
      {rows.map((row) => (
        <article className="panel" key={row.id}>
          <h2>{row.title}</h2>
          <p>{row.body}</p>
          <p className="stat-hint">{row.when}</p>
        </article>
      ))}
    </div>
  )
}
