import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { api } from './api'
import Shell from './Shell'
import { Landing, Login, Signup } from './pages/Public'
import Home from './pages/Home'
import Orders from './pages/Orders'
import MenuPage from './pages/MenuPage'
import Billing from './pages/Billing'
import Stats from './pages/Stats'
import Complaints from './pages/Complaints'
import Notices from './pages/Notices'
import Profile from './pages/Profile'
import Serving from './pages/Serving'
import Records from './pages/Records'
import Costs from './pages/Costs'
import Reports from './pages/Reports'
import Users from './pages/Users'
import UserForm from './pages/UserForm'
import Settings from './pages/Settings'
import Balances from './pages/Balances'
import Activity from './pages/Activity'

const AuthContext = createContext(null)
export function useAuth() {
  return useContext(AuthContext)
}

function AuthProvider({ children }) {
  const [state, setState] = useState({
    loading: true,
    user: null,
    hallName: 'Residential Hall',
    hallNow: '',
    pendingSignups: 0,
    pendingDeposits: 0
  })
  const refresh = useCallback(async () => {
    const data = await api.get('/api/me')
    setState({ loading: false, ...data })
    return data
  }, [])
  useEffect(() => {
    refresh().catch(() => setState((current) => ({ ...current, loading: false, user: null })))
  }, [refresh])
  return <AuthContext.Provider value={{ ...state, refresh }}>{children}</AuthContext.Provider>
}

function Guest({ children }) {
  const { loading, user } = useAuth()
  if (loading) return <p className="empty public-wait">Opening the hall book…</p>
  if (user) return <Navigate to="/app" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Guest><Landing /></Guest>} />
        <Route path="/login" element={<Guest><Login /></Guest>} />
        <Route path="/signup" element={<Guest><Signup /></Guest>} />
        <Route path="/app" element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="orders" element={<Orders />} />
          <Route path="menu" element={<MenuPage />} />
          <Route path="billing" element={<Billing />} />
          <Route path="stats" element={<Stats />} />
          <Route path="complaints" element={<Complaints />} />
          <Route path="notices" element={<Notices />} />
          <Route path="password" element={<Navigate to="/app/profile" replace />} />
          <Route path="profile" element={<Profile />} />
          <Route path="serving" element={<Serving />} />
          <Route path="records" element={<Records />} />
          <Route path="costs" element={<Costs />} />
          <Route path="reports" element={<Reports />} />
          <Route path="users" element={<Users />} />
          <Route path="users/new" element={<UserForm />} />
          <Route path="users/:id" element={<UserForm />} />
          <Route path="settings" element={<Settings />} />
          <Route path="balances" element={<Balances />} />
          <Route path="activity" element={<Activity />} />
        </Route>
        <Route path="*" element={<Missing />} />
      </Routes>
    </AuthProvider>
  )
}

function Missing() {
  const { pathname } = useLocation()
  return (
    <main className="public-wrap" id="content">
      <h1>That page is not part of the hall system.</h1>
      <p className="lede">{pathname}</p>
      <a className="btn btn-primary" href="/">Back to the board</a>
    </main>
  )
}
