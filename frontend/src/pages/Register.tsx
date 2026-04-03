import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Update username — profile was auto-created by DB trigger
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ username })
        .eq('id', data.user.id)

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }

      navigate('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>
          Join TrustWeb
        </h1>
        <p style={{ color: '#888', marginBottom: '32px', fontSize: '14px' }}>
          Build your prediction credibility
        </p>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
              placeholder="yourname"
              minLength={3}
              required
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
              style={inputStyle}
            />
          </div>

          {error && <p style={{ color: '#ff4466', fontSize: '13px' }}>{error}</p>}

          <button type="submit" disabled={loading} style={submitStyle}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ marginTop: '24px', fontSize: '13px', color: '#888', textAlign: 'center' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#6c63ff', textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
}

const cardStyle: React.CSSProperties = {
  background: '#111120',
  border: '1px solid #1a1a2e',
  borderRadius: '20px',
  padding: '40px',
  width: '100%',
  maxWidth: '400px',
}

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
}

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#aaa',
}

const inputStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: '10px',
  border: '1px solid #222',
  background: '#0d0d1a',
  color: '#e8e8f0',
  fontSize: '14px',
  outline: 'none',
}

const submitStyle: React.CSSProperties = {
  padding: '12px',
  borderRadius: '10px',
  background: '#6c63ff',
  color: '#fff',
  fontWeight: 700,
  fontSize: '15px',
  border: 'none',
  cursor: 'pointer',
  marginTop: '8px',
}
