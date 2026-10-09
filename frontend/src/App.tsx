import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { ThemeProvider } from './lib/theme'
import { api } from './lib/api'
import type { User } from '@supabase/supabase-js'
import type React from 'react'
import Navbar from './components/Navbar'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ForYou from './pages/ForYou'
import Explore from './pages/Explore'
import LeaderboardPage from './pages/LeaderboardPage'
import Notifications from './pages/Notifications'
import ProfilePage from './pages/Profile'
import Admin from './pages/Admin'

// Logged-out visitors go to the login page, then come back to where they were headed
function RequireAuth({ user, children }: { user: User | null; children: React.ReactElement }) {
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return children
}

function AuthOnly({ user, children }: { user: User | null; children: React.ReactElement }) {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  if (user) return <Navigate to={from && from !== '/' ? from : '/home'} replace />
  return children
}

export default function App() {
  const [user, setUser]             = useState<User | null>(null)
  const [username, setUsername]     = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) { setUsername(null); return }
    api.getMe().then(p => setUsername(p?.username ?? null)).catch(() => {})
  }, [user?.id])

  // Poll unread notification count
  useEffect(() => {
    if (!user) { setNotifCount(0); return }
    const poll = () => api.getNotificationCount().then(d => setNotifCount(d.count ?? 0)).catch(() => {})
    poll()
    const id = setInterval(poll, 60000)
    return () => clearInterval(id)
  }, [user?.id])

  if (loading) return null

  return (
    <ThemeProvider>
      <BrowserRouter>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Navbar user={user} username={username} />
          <div style={{ flex: 1 }}>
            <Routes>
              {/* Public front */}
              <Route path="/"              element={user ? <Navigate to="/home" replace /> : <Home />} />
              <Route path="/login"         element={<AuthOnly user={user}><Login mode="signin" /></AuthOnly>} />
              <Route path="/signup"        element={<AuthOnly user={user}><Login mode="signup" /></AuthOnly>} />
              <Route path="/register"      element={<Navigate to="/signup" replace />} />
              <Route path="/landing"       element={<Navigate to="/" replace />} />
              <Route path="/x7k2-admin"    element={<Admin />} />

              {/* The app itself — signed-in only */}
              <Route path="/home"          element={<RequireAuth user={user}><ForYou /></RequireAuth>} />
              <Route path="/explore"       element={<RequireAuth user={user}><Explore /></RequireAuth>} />
              <Route path="/leaderboard"   element={<RequireAuth user={user}><LeaderboardPage /></RequireAuth>} />
              <Route path="/notifications" element={<RequireAuth user={user}><Notifications /></RequireAuth>} />
              <Route path="/dashboard"     element={<RequireAuth user={user}><Dashboard /></RequireAuth>} />
              <Route path="/u/:username"   element={<RequireAuth user={user}><ProfilePage /></RequireAuth>} />
              <Route path="/profile"       element={<Navigate to="/dashboard" replace />} />
              <Route path="/feed"          element={<Navigate to="/home" replace />} />
              <Route path="*"              element={<Navigate to={user ? '/home' : '/'} replace />} />
            </Routes>
          </div>
          <BottomNav user={user} notifCount={notifCount} />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  )
}
