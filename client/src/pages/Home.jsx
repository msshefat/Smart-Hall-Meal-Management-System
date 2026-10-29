import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../App'
import { Banner, PageHead } from '../Shell'

export default function Home() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api.get('/api/dashboard').then(setData).catch((err) => setError(err.message))
  }, [])
  if (error) return <Banner message={error} kind="error" />
  if (!data) return <p className="empty">Loading the desk…</p>
  if (user.role === 'student') return <StudentHome data={data} name={user.fullName} />
  if (user.role === 'staff') return <StaffHome data={data} name={user.fullName} />
  return <AdminHome data={data} name={user.fullName} />
}

function StudentHome({ data, name }) {
  return (
    <>
      <PageHead eyebrow={data.todayLabel} title={`${data.greeting}, ${name.split(' ')[0]}.`} lede="Today's meals, this month's spending, and anything still open with the office." />
      <StudentStats data={data} />
      <section className="panel">
        <div className="section-title"><h2>Today</h2><Link to="/app/orders">Change meals</Link></div>
        <div className="meal-grid">
          {data.meals.map((meal) => (
            <article className={`meal-card ${meal.on ? 'is-on' : 'is-off'} ${meal.lock.open ? '' : 'is-locked'}`} key={meal.key}>
              <span className="meal-name">{meal.label}</span>
              <span className="meal-menu">{meal.items}</span>
              <span className="meal-lock">{meal.lock.label}</span>
              <span className="meal-state">{meal.on ? 'On your list' : 'Off'}</span>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}

function StudentStats({ data }) {
  return (
    <section className="stat-grid">
      <article className="stat">
        <p className="stat-label">This month</p>
        <p className="stat-value">{data.mealCount}</p>
        <p className="stat-hint">{data.monthLabel} meals on</p>
      </article>
      <article className="stat">
        <p className="stat-label">Spent</p>
        <p className="stat-value">{data.monthSpent}</p>
        <p className="stat-hint"><Link to="/app/billing">Expenses and deposits</Link></p>
      </article>
      <article className="stat">
        <p className="stat-label">Open complaints</p>
        <p className="stat-value">{data.openComplaints}</p>
        <p className="stat-hint"><Link to="/app/complaints">Write to the office</Link></p>
      </article>
      <article className="stat">
        <p className="stat-label">Notices</p>
        <p className="stat-value">Board</p>
        <p className="stat-hint"><Link to="/app/notices">Read the hall notices</Link></p>
      </article>
    </section>
  )
}

function StaffHome({ data, name }) {
  return (
    <>
      <PageHead eyebrow={data.todayLabel} title={`${data.greeting}, ${name.split(' ')[0]}.`} lede="Headcount, posted bazar, and whether each meal is still open.">
        <Link className="btn btn-primary" to="/app/costs">Enter bazar</Link>
      </PageHead>
      <div className="cost-grid">
        {data.meals.map((meal) => (
          <article className="panel" key={meal.key}>
            <p className="eyebrow">{meal.label}</p>
            <p className="stat-value">{meal.count}</p>
            <p className="stat-hint">students on</p>
            <p>{meal.costLabel ? `Bazar ${meal.costLabel}` : 'Bazar not posted'}</p>
            <p className="stat-hint">{meal.rateLabel ? `Rate ${meal.rateLabel}` : meal.lock.label}</p>
          </article>
        ))}
      </div>
    </>
  )
}

function AdminHome({ data, name }) {
  return (
    <>
      <PageHead eyebrow={data.todayLabel} title={`${data.greeting}, ${name.split(' ')[0]}.`} lede="Accounts, today's headcount, and the lock times currently in force.">
        <Link className="btn btn-primary" to="/app/settings">Change lock times</Link>
      </PageHead>
      {data.users.pending ? <p className="callout"><strong>{data.users.pending}</strong> student signup {data.users.pending === 1 ? 'request is' : 'requests are'} waiting. <Link to="/app/users">Review and approve</Link></p> : null}
      {data.depositRequests ? <p className="callout"><strong>{data.depositRequests}</strong> add-money {data.depositRequests === 1 ? 'request is' : 'requests are'} waiting. <Link to="/app/balances">Review and approve</Link></p> : null}
      <section className="stat-grid">
        <article className="stat"><p className="stat-label">Active students</p><p className="stat-value">{data.users.students}</p><p className="stat-hint">{data.users.pending} waiting · {data.users.inactive} inactive · {data.users.staff} staff</p></article>
        <article className="stat"><p className="stat-label">Breakfast on</p><p className="stat-value">{data.counts.breakfast}</p><p className="stat-hint">Lunch {data.counts.lunch} · Dinner {data.counts.dinner}</p></article>
        <article className="stat"><p className="stat-label">Complaints waiting</p><p className="stat-value">{data.openComplaints}</p><p className="stat-hint"><Link to="/app/complaints">Review the queue</Link></p></article>
        <article className="stat"><p className="stat-label">Low balances</p><p className="stat-value">{data.lowCount}</p><p className="stat-hint"><Link to="/app/balances">Record a deposit</Link></p></article>
      </section>
      <section className="split">
        <article className="panel">
          <div className="section-title"><h2>Current lock times</h2><Link to="/app/settings">Edit</Link></div>
          <ul className="kv">
            {data.locks.map((lock) => <li key={lock.label}><span>{lock.label}</span><strong>{lock.text}</strong></li>)}
          </ul>
        </article>
        <article className="panel">
          <div className="section-title"><h2>Balances under ৳300</h2><Link to="/app/balances">All balances</Link></div>
          {!data.low.length ? <p className="empty">No active student is under ৳300.</p> : null}
          <ul className="people-list">
            {data.low.map((person) => (
              <li key={person.fullName}><span>{person.fullName}<small>{person.roomNo}</small></span><strong className={person.due ? 'is-due-text' : ''}>{person.balanceLabel}</strong></li>
            ))}
          </ul>
        </article>
      </section>
      <section className="panel plain-panel">
        <div className="section-title"><h2>Recent activity</h2><Link to="/app/activity">History</Link></div>
        <ul className="activity">
          {data.activity.map((item, index) => (
            <li key={`${item.action}-${index}`}><div><strong>{item.action}</strong><p>{item.details}</p></div><span>{item.who} · {item.when}</span></li>
          ))}
        </ul>
      </section>
    </>
  )
}
