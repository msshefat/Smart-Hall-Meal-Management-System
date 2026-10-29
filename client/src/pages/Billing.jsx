import { useEffect, useState } from 'react'
import { api } from '../api'
import { Banner, PageHead, Star } from '../Shell'

const STATUS = { pending: 'Waiting', approved: 'Added', declined: 'Declined' }

export default function Billing() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [form, setForm] = useState({ amount: '', note: '' })
  const [busy, setBusy] = useState(false)

  function load() {
    return api.get('/api/billing').then(setData)
  }
  useEffect(() => { load().catch((err) => setError(err.message)) }, [])

  async function requestMoney(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNote('')
    try {
      const result = await api.post('/api/deposits', form)
      setNote(result.message)
      setForm({ amount: '', note: '' })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!data) return error ? <Banner message={error} kind="error" /> : <p className="empty">Loading expenses…</p>
  return (
    <>
      <PageHead eyebrow="Your account" title="Expenses" lede="Ask the hall office to add money. It reaches your balance only after an administrator approves the request. A negative balance is an amount due." />
      <Banner message={note} />
      <Banner message={error} kind="error" />
      {data ? (
        <form className="panel form-grid narrow" onSubmit={requestMoney}>
          <h2>Add money</h2>
          <div className="pair">
            <label>Amount (৳) <Star /><input className="form-control" inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></label>
            <label>Note<input className="form-control" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="bKash, cash at the office" /></label>
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
        </form>
      ) : null}
      {data?.requests?.length ? (
        <div className="table-wrap panel plain-panel">
          <table className="sheet">
            <thead><tr><th>When</th><th>Amount</th><th>Note</th><th>Status</th></tr></thead>
            <tbody>
              {data.requests.map((row) => (
                <tr key={row.id}>
                  <td>{row.when}</td>
                  <td className="num">{row.amountLabel}</td>
                  <td>{row.note || '—'}</td>
                  <td><span className={`status st-${row.status === 'approved' ? 'resolved' : row.status === 'declined' ? 'closed' : 'pending'}`}>{STATUS[row.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <section className="stat-grid">
        <article className={`stat ${data.due ? 'is-due' : ''}`}>
          <p className="stat-label">{data.due ? 'Amount due' : 'Balance'}</p>
          <p className="stat-value">{data.balanceLabel}</p>
          <p className="stat-hint">{data.due ? 'Amount due. New meals close past −৳500.' : 'Updated when a meal rate is posted'}</p>
        </article>
        <article className="stat">
          <p className="stat-label">{data.monthLabel}</p>
          <p className="stat-value">{data.monthSpent}</p>
          <p className="stat-hint">Net meal charges this month</p>
        </article>
      </section>
      <div className="table-wrap panel plain-panel">
        {!data.entries.length ? <p className="empty">No ledger entries yet.</p> : (
          <table className="sheet">
            <thead><tr><th>When</th><th>Note</th><th>Type</th><th></th></tr></thead>
            <tbody>
              {data.entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.when}</td>
                  <td>{entry.note}</td>
                  <td>{entry.type}</td>
                  <td className="num">{entry.amountLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
