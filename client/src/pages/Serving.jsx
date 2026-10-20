import { useRef, useState } from 'react'
import { api } from '../api'
import QrScan from '../QrScan'
import { idFromMealQr } from '../qr'
import { Banner, PageHead, Portrait, Star } from '../Shell'

export default function Serving() {
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const inputRef = useRef(null)

  async function searchCode(value) {
    const next = idFromMealQr(value) || String(value || '').trim()
    setCode(next)
    setError('')
    setNote('')
    setResult(null)
    if (next.length < 2) {
      setError('Enter an ID to search.')
      return
    }
    try {
      const data = await api.get(`/api/serving?code=${encodeURIComponent(next)}`)
      setResult(data)
    } catch (err) {
      setError(err.message)
    }
  }

  function search(event) {
    event.preventDefault()
    searchCode(code)
  }

  function acceptScan(id) {
    searchCode(id)
    inputRef.current?.focus()
  }

  async function mark(meal) {
    setBusy(meal)
    setError('')
    try {
      const data = await api.post('/api/serving', { code: result.person.studentCode, meal })
      setNote(data.message)
      const fresh = await api.get(`/api/serving?code=${encodeURIComponent(result.person.studentCode)}`)
      setResult(fresh)
    } catch (err) {
      setNote('')
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <PageHead eyebrow="Mess desk" title="Meal taken" lede="Search today's diner by ID, or scan the QR code on their profile. A scan writes that ID into the search field. Their profile photo is shown so you can confirm who is at the counter, then mark the meal taken once." />
      <Banner message={note} />
      <Banner message={error} kind="error" />
      <form className="panel form-grid narrow" onSubmit={search}>
        <label>ID <Star />
          <input ref={inputRef} className="form-control" value={code} onChange={(event) => setCode(event.target.value)} placeholder="24549010021" required />
        </label>
        <div className="scan-actions">
          <button className="btn btn-primary" type="submit">Search</button>
          <QrScan onCode={acceptScan} />
        </div>
      </form>
      {result ? (
        <section className="panel serving-card">
          <p className="eyebrow">{result.dateLabel}</p>
          <div className="serving-person">
            <Portrait className="portrait is-serving" user={result.person} />
            <div>
              <h2>{result.person.fullName}</h2>
              <p className="stat-hint">{result.person.studentCode}{result.person.roomNo ? ` · Room ${result.person.roomNo}` : ''} · {result.person.role}</p>
            </div>
          </div>
          <div className="meal-grid">
            {result.meals.map((meal) => {
              const waiting = busy === meal.key
              let state = 'Not on today\'s list'
              if (meal.taken) state = meal.takenAt ? `Taken · ${meal.takenAt}` : 'Taken'
              else if (meal.on) state = 'On the list'
              return (
                <button
                  key={meal.key}
                  type="button"
                  className={`meal-card ${meal.on ? 'is-on' : 'is-off'} ${meal.taken || !meal.on ? 'is-locked' : ''}`}
                  disabled={!meal.on || meal.taken || Boolean(busy)}
                  onClick={() => mark(meal.key)}
                >
                  <span className="meal-name">{meal.label}</span>
                  <span className="meal-state">{waiting ? 'Saving…' : state}</span>
                  <span className="meal-lock">{meal.taken ? 'Already served' : meal.on ? 'Mark taken' : 'Add them on the meal sheet first'}</span>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}
    </>
  )
}
