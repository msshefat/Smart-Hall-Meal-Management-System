import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../App'
import { Banner, PageHead } from '../Shell'

export default function Orders() {
  const auth = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  function load() {
    return api.get('/api/orders').then(setData)
  }
  useEffect(() => { load().catch((err) => setError(err.message)) }, [])

  async function toggle(day, meal) {
    setError('')
    try {
      const result = await api.post('/api/orders/toggle', { date: day.iso, meal: meal.key, turn: meal.on ? 'off' : 'on' })
      setNote(result.message)
      await auth.refresh()
      await load()
    } catch (err) {
      setNote('')
      setError(err.message)
    }
  }

  if (!data && !error) return <p className="empty">Loading the meal board…</p>
  return (
    <>
      <PageHead eyebrow={data ? `Next ${data.windowDays} days` : 'Meals'} title="Order meals" lede="A meal stays editable until its lock time. The hall office can move that time, and the board follows at once." />
      <Banner message={note} />
      <Banner message={error} kind="error" />
      {data ? <ul className="rule-list">{data.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul> : null}
      <div className="day-board">
        {data ? data.days.map((day) => (
          <article className="day-card" key={day.iso}>
            <header className="day-card-head">
              <div>
                <p className="eyebrow">{day.isToday ? 'Today' : day.weekday}</p>
                <h2>{day.label}</h2>
              </div>
              <p className="day-count"><span>{day.onCount}</span> of 3 on</p>
            </header>
            <div className="meal-grid">
              {day.meals.map((meal) => (
                <button
                  key={meal.key}
                  type="button"
                  className={`meal-card ${meal.on ? 'is-on' : 'is-off'} ${meal.locked || meal.taken || (data.orderingBlocked && !meal.on) ? 'is-locked' : ''}`}
                  disabled={meal.locked || meal.taken || (data.orderingBlocked && !meal.on)}
                  onClick={() => toggle(day, meal)}
                >
                  <span className="meal-name">{meal.label}</span>
                  <span className="meal-menu">{meal.items}</span>
                  <span className="meal-lock">{meal.taken ? 'Already served at the mess' : data.orderingBlocked && !meal.on ? 'Past −৳500' : meal.lockLabel}</span>
                  <span className="meal-state">{meal.taken ? 'Taken' : meal.locked ? 'Locked' : data.orderingBlocked && !meal.on ? 'Balance limit' : meal.on ? 'On your list' : 'Off'}</span>
                </button>
              ))}
            </div>
          </article>
        )) : null}
      </div>
    </>
  )
}
