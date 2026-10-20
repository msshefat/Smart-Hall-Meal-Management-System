import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Banner, PageHead } from '../Shell'

export default function Records() {
  const [params, setParams] = useSearchParams()
  const date = params.get('date') || ''
  const [data, setData] = useState(null)
  const [sheet, setSheet] = useState([])
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const query = date ? `?date=${date}` : ''
    api.get(`/api/records${query}`).then((next) => {
      setData(next)
      setSheet(next.students)
    }).catch((err) => setError(err.message))
  }, [date])

  function toggle(id, meal) {
    setSheet((rows) => rows.map((row) => {
      if (row.id !== id || row[`${meal}Taken`]) return row
      return { ...row, [meal]: !row[meal] }
    }))
  }

  async function save(event) {
    event.preventDefault()
    const body = { date: data.date, breakfast: [], lunch: [], dinner: [] }
    sheet.forEach((row) => {
      if (row.breakfast) body.breakfast.push(row.id)
      if (row.lunch) body.lunch.push(row.id)
      if (row.dinner) body.dinner.push(row.id)
    })
    try {
      const result = await api.post('/api/records', body)
      setNote(result.message)
    } catch (err) {
      setError(err.message)
    }
  }

  if (!data) return error ? <Banner message={error} kind="error" /> : <p className="empty">Loading the meal sheet…</p>
  return (
    <>
      <PageHead eyebrow={data.dateLabel} title="Meal records" lede="Correct who was on a meal. If a bazar cost exists, saving recalculates that rate.">
        <div className="datebar">
          <button className="btn btn-quiet" type="button" onClick={() => setParams({ date: data.prev })}>Previous</button>
          <button className="btn btn-quiet" type="button" onClick={() => setParams({ date: data.next })}>Next</button>
        </div>
      </PageHead>
      <Banner message={note} />
      <Banner message={error} kind="error" />
      <form onSubmit={save}>
        <div className="table-wrap panel plain-panel">
          <table className="sheet">
            <thead>
              <tr><th>Student</th><th>Breakfast</th><th>Lunch</th><th>Dinner</th></tr>
            </thead>
            <tbody>
              {sheet.map((student) => (
                <tr key={student.id} className={student.status === 'inactive' ? 'is-muted' : ''}>
                  <td>
                    <strong>{student.fullName}</strong>
                    <small>{student.roomNo}{student.studentCode ? ` · ${student.studentCode}` : ''}{student.status === 'inactive' ? ' · inactive' : ''}</small>
                  </td>
                  {['breakfast', 'lunch', 'dinner'].map((meal) => (
                    <td key={meal}>
                      <label className={`tick ${student[meal] ? 'is-on' : ''} ${student[`${meal}Taken`] ? 'is-taken' : ''}`}>
                        <input type="checkbox" checked={student[meal]} disabled={student[`${meal}Taken`]} onChange={() => toggle(student.id, meal)} />
                        {student[`${meal}Taken`] ? 'Taken' : student[meal] ? 'On' : 'Off'}
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn btn-primary" type="submit">Save meal sheet</button>
      </form>
    </>
  )
}
