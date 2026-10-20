import { useEffect, useState } from 'react'
import { api } from '../api'
import { Banner, PageHead, Star } from '../Shell'

export default function Settings() {
  const [form, setForm] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    api.get('/api/settings').then((data) => setForm({
      hallName: data.hallName,
      orderWindowDays: data.orderWindowDays,
      meals: data.meals
    })).catch((err) => setError(err.message))
  }, [])

  function updateMeal(key, field, value) {
    setForm((current) => ({
      ...current,
      meals: current.meals.map((meal) => meal.key === key ? { ...meal, [field]: value } : meal)
    }))
  }

  async function save(event) {
    event.preventDefault()
    const body = {
      hallName: form.hallName,
      orderWindowDays: Number(form.orderWindowDays)
    }
    form.meals.forEach((meal) => {
      body[meal.key] = { offsetDays: Number(meal.offsetDays), time: meal.time }
    })
    try {
      const result = await api.post('/api/settings', body)
      setNote(result.message)
      setError('')
    } catch (err) {
      setNote('')
      setError(err.message)
    }
  }

  if (!form) return error ? <Banner message={error} kind="error" /> : <p className="empty">Loading lock times…</p>
  return (
    <>
      <PageHead eyebrow="Hall office" title="Lock times" lede="These cutoffs are not permanent. Saving a new day and clock replaces them immediately, and open meals follow the new rule." />
      <Banner message={note} />
      <Banner message={error} kind="error" />
      <form className="panel form-grid" onSubmit={save}>
        <div className="pair">
          <label>Hall name <Star /><input className="form-control" value={form.hallName} onChange={(event) => setForm({ ...form, hallName: event.target.value })} required /></label>
          <label>Days students can book ahead <Star />
            <input className="form-control" type="number" min="1" max="14" value={form.orderWindowDays} onChange={(event) => setForm({ ...form, orderWindowDays: event.target.value })} />
          </label>
        </div>
        {form.meals.map((meal) => (
          <fieldset className="lock-card" key={meal.key}>
            <legend>{meal.label}</legend>
            <div className="pair">
              <label>Days before the meal <Star />
                <input className="form-control" type="number" min="0" max="3" value={meal.offsetDays} onChange={(event) => updateMeal(meal.key, 'offsetDays', event.target.value)} />
              </label>
              <label>Clock time <Star />
                <input className="form-control" type="time" value={meal.time} onChange={(event) => updateMeal(meal.key, 'time', event.target.value)} />
              </label>
            </div>
            <p className="stat-hint">Currently {meal.phrase}</p>
          </fieldset>
        ))}
        <button className="btn btn-primary" type="submit">Save lock times</button>
      </form>
    </>
  )
}
