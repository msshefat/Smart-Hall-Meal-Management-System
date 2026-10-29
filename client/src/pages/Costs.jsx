import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Banner, PageHead, Star } from '../Shell'

export default function Costs() {
  const [params, setParams] = useSearchParams()
  const date = params.get('date') || ''
  const [data, setData] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  function load(queryDate) {
    const query = queryDate ? `?date=${queryDate}` : ''
    return api.get(`/api/costs${query}`).then((next) => {
      setData(next)
      setDrafts(Object.fromEntries(next.meals.map((meal) => [meal.key, { amount: meal.amount, note: meal.note }])))
    })
  }
  useEffect(() => { load(date).catch((err) => setError(err.message)) }, [date])

  async function save(meal) {
    setError('')
    try {
      const result = await api.post('/api/costs', {
        date: data.date,
        meal,
        amount: drafts[meal].amount,
        note: drafts[meal].note
      })
      setNote(result.message)
      await load(data.date)
    } catch (err) {
      setNote('')
      setError(err.message)
    }
  }

  if (!data) return error ? <Banner message={error} kind="error" /> : <p className="empty">Loading bazar costs…</p>
  return (
    <>
      <PageHead eyebrow={data.dateLabel} title="Bazar costs" lede="The rate is the bazar divided by students marked on, rounded down to the paisa. Leftover paisa stays undistributed.">
        <div className="datebar">
          <button className="btn btn-quiet" type="button" onClick={() => setParams({ date: data.prev })}>Previous</button>
          <button className="btn btn-quiet" type="button" onClick={() => setParams({ date: data.next })}>Next</button>
        </div>
      </PageHead>
      <Banner message={note} />
      <Banner message={error} kind="error" />
      <div className="cost-grid">
        {data.meals.map((meal) => (
          <article className="panel" key={meal.key}>
            <h2>{meal.label}</h2>
            <p className="stat-hint">{meal.count} students on</p>
            <label>Amount (৳) <Star />
              <input className="form-control" inputMode="decimal" value={drafts[meal.key]?.amount || ''} onChange={(event) => setDrafts((current) => ({ ...current, [meal.key]: { ...current[meal.key], amount: event.target.value } }))} />
            </label>
            <label>Note
              <input className="form-control" value={drafts[meal.key]?.note || ''} onChange={(event) => setDrafts((current) => ({ ...current, [meal.key]: { ...current[meal.key], note: event.target.value } }))} />
            </label>
            {meal.rateLabel ? <p className="stat-hint">Rate {meal.rateLabel} · undistributed {meal.roundingLabel}</p> : <p className="stat-hint">Not posted yet</p>}
            <button className="btn btn-primary" type="button" onClick={() => save(meal.key)}>Post {meal.label.toLowerCase()}</button>
          </article>
        ))}
      </div>
    </>
  )
}
