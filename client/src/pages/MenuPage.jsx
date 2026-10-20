import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../App'
import { Banner, PageHead } from '../Shell'

export default function MenuPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const date = params.get('date') || ''
  const [data, setData] = useState(null)
  const [draft, setDraft] = useState({})
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const query = date ? `?date=${date}` : ''
    api.get(`/api/menu${query}`).then((next) => {
      setData(next)
      setDraft(Object.fromEntries(next.meals.map((meal) => [meal.key, meal.items])))
    }).catch((err) => setError(err.message))
  }, [date])

  async function save(event) {
    event.preventDefault()
    setError('')
    try {
      const result = await api.post('/api/menu', { date: data.date, ...draft })
      setNote(result.message)
    } catch (err) {
      setNote('')
      setError(err.message)
    }
  }

  if (!data) return error ? <Banner message={error} kind="error" /> : <p className="empty">Loading the menu…</p>
  const editing = user.role === 'admin'
  return (
    <>
      <PageHead eyebrow={data.dateLabel} title={editing ? 'Menus' : 'Menu board'} lede={editing ? 'Write what the kitchen will serve. Students see this on the order board.' : 'What the kitchen has posted for this day.'}>
        <div className="datebar">
          <button className="btn btn-quiet" type="button" onClick={() => setParams({ date: data.prev })}>Previous</button>
          <button className="btn btn-quiet" type="button" onClick={() => setParams({ date: data.next })}>Next</button>
        </div>
      </PageHead>
      <Banner message={note} />
      <Banner message={error} kind="error" />
      <form className="cost-grid" onSubmit={save}>
        {data.meals.map((meal) => (
          <article className="panel" key={meal.key}>
            <h2>{meal.label}</h2>
            {editing ? (
              <textarea className="form-control" rows={4} value={draft[meal.key] || ''} onChange={(event) => setDraft((current) => ({ ...current, [meal.key]: event.target.value }))} />
            ) : (
              <p>{meal.items || 'Not posted yet'}</p>
            )}
          </article>
        ))}
        {editing ? <button className="btn btn-primary" type="submit">Save menu</button> : null}
      </form>
    </>
  )
}
