import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { ThemeProvider } from './lib/theme'
import type { User } from '@supabase/supabase-js'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Feed from './pages/Feed'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

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

  if (loading) return null

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Navbar user={user} />
        <Routes>
          <Route path="/"          element={<Home />} />
          <Route path="/login"     element={!user ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/register"  element={<Navigate to="/login" />} />
          <Route path="/feed"      element={<Feed />} />
          <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
