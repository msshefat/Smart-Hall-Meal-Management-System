import { useEffect, useState } from 'react'
import { api } from '../api'
import { Banner, PageHead } from '../Shell'

export default function Activity() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.get('/api/activity').then((data) => setRows(data.rows)).catch((err) => setError(err.message)) }, [])
  return (
    <>
      <PageHead eyebrow="Office" title="Activity" lede="Who signed in, changed a lock time, posted a bazar, or approved a student." />
      <Banner message={error} kind="error" />
      <div className="table-wrap panel plain-panel">
        {!rows ? <p className="empty">Loading the record…</p> : (
          <table className="sheet">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.when}-${index}`}>
                  <td>{row.when}</td>
                  <td>{row.who}{row.role ? <small>{row.role}</small> : null}</td>
                  <td>{row.action}</td>
                  <td>{row.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
