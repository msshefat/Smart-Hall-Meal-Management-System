import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../App'
import { Banner, PageHead, Portrait } from '../Shell'

export default function Users() {
  const auth = useAuth()
  const location = useLocation()
  const [q, setQ] = useState('')
  const [data, setData] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  function load(search = q) {
    return api.get(`/api/users?q=${encodeURIComponent(search)}`).then(setData)
  }
  useEffect(() => { load('').catch((err) => setError(err.message)) }, [])
  useEffect(() => { if (location.state?.note) setNote(location.state.note) }, [location.state])

  async function remove(person) {
    const sure = window.confirm(`Delete ${person.fullName}? Their profile is removed, including meals and balance. This cannot be undone.`)
    if (!sure) return
    try {
      const result = await api.delete(`/api/users/${person.id}`)
      setNote(result.message)
      await auth.refresh()
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function setStatus(id, status) {
    try {
      const result = await api.post(`/api/users/${id}/status`, { status })
      setNote(result.message)
      await auth.refresh()
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <PageHead eyebrow="Directory" title="People" lede="Approve a signup, or delete a profile. You can delete anyone except yourself. Deactivate keeps the account on the record.">
        <Link className="btn btn-primary" to="/app/users/new">Add person</Link>
      </PageHead>
      <Banner message={note} />
      <Banner message={error} kind="error" />
      {data?.pending?.length ? (
        <section className="panel request-panel">
          <div className="section-title"><h2>Signup requests</h2><span>{data.pending.length} waiting</span></div>
          <p className="lede tight">These students cannot sign in until you approve them.</p>
          <div className="table-wrap">
            <table className="sheet">
              <thead><tr><th>Name</th><th>Student ID</th><th>Room</th><th>ID card</th><th></th></tr></thead>
              <tbody>
                {data.pending.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="person-line">
                        <Portrait user={user} />
                        <div><strong>{user.fullName}</strong><small>{user.email}</small></div>
                      </div>
                    </td>
                    <td>{user.studentCode || '—'}</td>
                    <td>{user.roomNo || '—'}{user.phone ? <small>{user.phone}</small> : null}</td>
                    <td>{user.hasIdCard ? <a href={`/api/media/${user.id}/id-card`} target="_blank" rel="noreferrer"><img className="id-thumb" src={`/api/media/${user.id}/id-card`} alt={`ID card for ${user.fullName}`} /></a> : '—'}</td>
                    <td className="row-actions">
                      <button className="is-approve" type="button" onClick={() => setStatus(user.id, 'active')}>Approve</button>
                      <button type="button" onClick={() => setStatus(user.id, 'inactive')}>Decline</button>
                      <button className="is-delete" type="button" onClick={() => remove(user)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      <form className="datebar" onSubmit={(event) => { event.preventDefault(); load().catch((err) => setError(err.message)) }}>
        <input className="form-control" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name, email, ID, room" aria-label="Search people" />
        <button className="btn btn-primary" type="submit">Search</button>
      </form>
      <div className="table-wrap panel plain-panel">
        {!data ? <p className="empty">Loading people…</p> : !data.directory.length ? <p className="empty">No one matches that search.</p> : (
          <table className="sheet">
            <thead><tr><th>Name</th><th>Role</th><th>Room / ID</th><th>Balance</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {data.directory.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="person-line">
                      <Portrait user={user} />
                      <div><strong>{user.fullName}</strong><small>{user.email}</small></div>
                    </div>
                  </td>
                  <td><span className={`status st-${user.role}`}>{user.role}</span></td>
                  <td>{user.roomNo || '—'}{user.studentCode ? <small>{user.studentCode}</small> : null}</td>
                  <td className="num">{user.role === 'student' ? user.balanceLabel : '—'}</td>
                  <td><span className={`status st-${user.status}`}>{user.status}</span></td>
                  <td className="row-actions">
                    <Link to={`/app/users/${user.id}`}>Edit</Link>
                    <button type="button" onClick={() => setStatus(user.id, user.status === 'active' ? 'inactive' : 'active')}>
                      {user.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    {user.id === auth.user.id ? null : <button className="is-delete" type="button" onClick={() => remove(user)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
