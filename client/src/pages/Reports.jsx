import { useEffect, useState } from 'react'
import { api } from '../api'
import { todayInput } from './dates'
import { Banner, PageHead } from '../Shell'

function plainMoney(label) {
  if (!label || label === '—') return ''
  const negative = String(label).trim().startsWith('-')
  const digits = String(label).replace(/[^0-9.]/g, '')
  if (!digits) return ''
  return negative ? `-${digits}` : digits
}

function csvCell(value) {
  const text = value == null ? '' : String(value)
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function reportCsv(data) {
  const rows = [
    ['Hall meal report', `${data.start} to ${data.end}`],
    ['Breakfast', data.totals.breakfast],
    ['Lunch', data.totals.lunch],
    ['Dinner', data.totals.dinner],
    ['Bazar BDT', plainMoney(data.totals.costLabel)],
    ['Charged BDT', plainMoney(data.totals.postedLabel)],
    ['Left over BDT', plainMoney(data.totals.undistributedLabel)],
    [],
    ['Date', 'Meal', 'Students', 'Bazar BDT', 'Rate BDT', 'Charged BDT', 'Left over BDT']
  ]
  data.days.forEach((day) => {
    day.meals.forEach((meal) => {
      const charged = meal.rateLabel === '—' ? '' : (Number(meal.posted || 0) / 100).toFixed(2)
      rows.push([
        day.date,
        meal.label,
        meal.orders,
        plainMoney(meal.costLabel),
        plainMoney(meal.rateLabel),
        charged,
        plainMoney(meal.roundingLabel)
      ])
    })
  })
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

function downloadReport(data) {
  const file = new Blob([reportCsv(data)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = `hall-meal-${data.start}-to-${data.end}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  function load(nextStart, nextEnd) {
    const query = new URLSearchParams()
    if (nextStart) query.set('start', nextStart)
    if (nextEnd) query.set('end', nextEnd)
    return api.get(`/api/reports?${query}`).then((next) => {
      setData(next)
      setStart(next.start)
      setEnd(next.end)
    })
  }
  useEffect(() => { load().catch((err) => setError(err.message)) }, [])

  if (error && !data) return <Banner message={error} kind="error" />
  return (
    <>
      <PageHead eyebrow="Mess book" title="Reports" lede="Bazar against what was actually charged. The gap is undistributed paisa." />
      <form className="datebar" onSubmit={(event) => { event.preventDefault(); load(start, end).catch((err) => setError(err.message)) }}>
        <input className="form-control" type="date" value={start || todayInput()} onChange={(event) => setStart(event.target.value)} />
        <input className="form-control" type="date" value={end || todayInput()} onChange={(event) => setEnd(event.target.value)} />
        <button className="btn btn-primary" type="submit">Show</button>
        <button className="btn btn-quiet" type="button" disabled={!data} onClick={() => downloadReport(data)}>Download CSV</button>
      </form>
      <Banner message={error} kind="error" />
      {data ? (
        <>
          <section className="stat-grid">
            <article className="stat"><p className="stat-label">Breakfast</p><p className="stat-value">{data.totals.breakfast}</p></article>
            <article className="stat"><p className="stat-label">Lunch</p><p className="stat-value">{data.totals.lunch}</p></article>
            <article className="stat"><p className="stat-label">Dinner</p><p className="stat-value">{data.totals.dinner}</p></article>
            <article className="stat"><p className="stat-label">Bazar / charged</p><p className="stat-value">{data.totals.costLabel}</p><p className="stat-hint">Charged {data.totals.postedLabel} · left {data.totals.undistributedLabel}</p></article>
          </section>
          <div className="table-wrap panel plain-panel">
            <table className="sheet">
              <thead><tr><th>Day</th><th>Meal</th><th>On</th><th>Bazar</th><th>Rate</th><th>Left over</th></tr></thead>
              <tbody>
                {data.days.flatMap((day) => day.meals.map((meal) => (
                  <tr key={`${day.date}-${meal.meal}`}>
                    <td>{meal.meal === 'breakfast' ? day.label : ''}</td>
                    <td>{meal.label}</td>
                    <td>{meal.orders}</td>
                    <td>{meal.costLabel}</td>
                    <td>{meal.rateLabel}</td>
                    <td>{meal.roundingLabel}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </>
      ) : <p className="empty">Building the report…</p>}
    </>
  )
}
