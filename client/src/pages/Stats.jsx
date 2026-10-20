import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Banner, PageHead } from '../Shell'

export default function Stats() {
  const [params, setParams] = useSearchParams()
  const view = params.get('view') || 'monthly'
  const date = params.get('date') || ''
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const query = new URLSearchParams({ view })
    if (date) query.set('date', date)
    api.get(`/api/stats?${query}`).then(setData).catch((err) => setError(err.message))
  }, [view, date])
  if (error) return <Banner message={error} kind="error" />
  if (!data) return <p className="empty">Counting meals…</p>
  return (
    <>
      <PageHead eyebrow={data.label} title="Statistics" lede="Meals you marked on, and what those meals cost after the bazar was posted." />
      <div className="datebar">
        {['daily', 'weekly', 'monthly'].map((item) => (
          <button key={item} className={`btn ${view === item ? 'btn-primary' : 'btn-quiet'}`} type="button" onClick={() => setParams({ view: item, date: data.anchor })}>{item}</button>
        ))}
        <button className="btn btn-quiet" type="button" onClick={() => setParams({ view, date: data.prev })}>Previous</button>
        <button className="btn btn-quiet" type="button" onClick={() => setParams({ view, date: data.next })}>Next</button>
      </div>
      <section className="stat-grid">
        <article className="stat"><p className="stat-label">Breakfast</p><p className="stat-value">{data.totals.breakfast}</p></article>
        <article className="stat"><p className="stat-label">Lunch</p><p className="stat-value">{data.totals.lunch}</p></article>
        <article className="stat"><p className="stat-label">Dinner</p><p className="stat-value">{data.totals.dinner}</p></article>
        <article className="stat"><p className="stat-label">Spent</p><p className="stat-value">{data.totals.spentLabel}</p></article>
      </section>
      <section className="panel">
        {data.days.map((day) => (
          <div className="bar-row" key={day.date}>
            <span className="bar-label">{day.label}</span>
            <span className="bar"><span style={{ width: `${day.width}%` }} /></span>
            <span className="bar-meta">{day.spentLabel}</span>
          </div>
        ))}
      </section>
    </>
  )
}
