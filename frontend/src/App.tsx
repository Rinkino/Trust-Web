import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { ThemeProvider } from './lib/theme'
import { api } from './lib/api'
import type { User } from '@supabase/supabase-js'
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
              <Route path="/"              element={user ? <Navigate to="/home" replace /> : <Home />} />
              <Route path="/home"          element={user ? <ForYou /> : <Navigate to="/login" replace />} />
              <Route path="/explore"       element={user ? <Explore /> : <Navigate to="/login" replace />} />
              <Route path="/leaderboard"   element={user ? <LeaderboardPage /> : <Navigate to="/login" replace />} />
              <Route path="/notifications" element={user ? <Notifications /> : <Navigate to="/login" />} />
              <Route path="/profile"       element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
              <Route path="/login"         element={!user ? <Login /> : <Navigate to="/home" />} />
              <Route path="/register"      element={<Navigate to="/login" />} />
              <Route path="/feed"          element={<Navigate to="/home" replace />} />
              <Route path="/landing"       element={<Home />} />
              <Route path="/dashboard"     element={user ? <Dashboard /> : <Navigate to="/login" />} />
              <Route path="/u/:username"   element={<ProfilePage />} />
              <Route path="/x7k2-admin"    element={<Admin />} />
            </Routes>
          </div>
          <BottomNav user={user} notifCount={notifCount} />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  )
}
