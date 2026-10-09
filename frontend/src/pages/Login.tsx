import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, Check } from 'lucide-react'
import LogoOrbit from '../components/LogoOrbit'
import DragonSpinner from '../components/DragonSpinner'

type Props = { mode: 'signin' | 'signup' }

export default function Login({ mode: initialMode }: Props) {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const [mode, setMode]         = useState<'signin' | 'signup' | 'forgot'>(initialMode)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  // /login and /signup share this component; follow the URL when it changes
  useEffect(() => { setMode(initialMode); setError(''); setSuccess('') }, [initialMode])

  async function handleGoogle() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${from ?? '/home'}` },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess('')

    if (mode === 'forgot') {
      setLoading(true)
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/dashboard`,
      })
      setLoading(false)
      if (error) setError(error.message)
      else setSuccess('Check your email for a reset link.')
      return
    }

    if (password.length < 8) {
      setError('Password needs at least 8 characters.'); return
    }

    setLoading(true)

    if (mode === 'signup') {
      if (username.length < 3) {
        setError('Username needs at least 3 characters.'); setLoading(false); return
      }
      // Backend creates the user with email already confirmed, so no verification email
      const apiUrl = import.meta.env.VITE_API_URL || ''
      try {
        const res = await fetch(`${apiUrl}/api/users/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, username }),
        })
        const json = await res.json()
        if (!res.ok) { setError(json.error || 'Sign up failed.'); setLoading(false); return }
      } catch {
        setError('Could not reach the server. Try again in a minute.'); setLoading(false); return
      }
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
    // On success, App's auth listener sends the user on to the app
  }

  const heading = mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Log in to TrustWeb'
  const sub = mode === 'signup'
    ? 'Free. Takes under a minute.'
    : mode === 'forgot'
      ? "We'll email you a link to set a new one."
      : 'Welcome back.'

  return (
    <div className="auth-shell">

      {/* Brand panel */}
      <aside className="auth-brand">
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'var(--text)' }}>
          <span style={{ fontWeight: 600, fontSize: '16px' }}>TrustWeb</span>
        </Link>

        <div style={{ textAlign: 'center' }}>
          <LogoOrbit />
        </div>

        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.25, marginBottom: '20px' }}>
            A track record nobody can fake, including you.
          </h2>
          <ul style={{ listStyle: 'none', display: 'grid', gap: '10px' }}>
            {[
              'Picks are locked before the event starts',
              'Results come from the bookmaker, not from you',
              'Your score follows you from slip to slip',
            ].map(t => (
              <li key={t} style={{ display: 'flex', gap: '10px', fontSize: '14px', color: 'var(--text-muted)' }}>
                <Check size={16} strokeWidth={2} style={{ color: 'var(--accent-light)', flexShrink: 0, marginTop: '2px' }} />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Form */}
      <main className="auth-main">
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <Link to="/" className="auth-mobile-brand" style={{ textDecoration: 'none', color: 'var(--text-muted)', fontSize: '14px' }}>
            &larr; TrustWeb
          </Link>

          <h1 style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: '6px' }}>{heading}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '28px' }}>{sub}</p>

          {error && (
            <p role="alert" style={{
              padding: '10px 12px', borderRadius: 'var(--radius)', marginBottom: '16px',
              border: '1px solid rgba(239,68,68,0.35)', color: 'var(--danger)', fontSize: '14px',
            }}>{error}</p>
          )}
          {success && (
            <p role="status" style={{
              padding: '10px 12px', borderRadius: 'var(--radius)', marginBottom: '16px',
              border: '1px solid rgba(16,185,129,0.35)', color: 'var(--success)', fontSize: '14px',
            }}>{success}</p>
          )}

          {mode !== 'forgot' && (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                style={{
                  width: '100%', padding: '11px 16px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text)', fontWeight: 500, fontSize: '15px', fontFamily: 'inherit',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                }}
              >
                <GoogleIcon />
                Continue with Google
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                or with email
                <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>
            </>
          )}

          <form onSubmit={handleEmail} style={{ display: 'grid', gap: '14px' }}>
            {mode === 'signup' && (
              <div>
                <label className="label" htmlFor="username" style={{ display: 'block', marginBottom: '6px' }}>Username</label>
                <input
                  id="username"
                  className="input"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  minLength={3}
                  required
                  autoComplete="username"
                />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Lowercase letters, numbers and underscores. Shown on your public record.
                </p>
              </div>
            )}

            <div>
              <label className="label" htmlFor="email" style={{ display: 'block', marginBottom: '6px' }}>Email</label>
              <input
                id="email"
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                inputMode="email"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label className="label" htmlFor="password">Password</label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--accent-light)', fontFamily: 'inherit', minHeight: 0, padding: 0 }}
                    >
                      Forgot it?
                    </button>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    className="input"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'At least 8 characters' : undefined}
                    required
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    style={{ paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', padding: '4px',
                    }}
                  >
                    {showPw ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                  </button>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-accent" style={{ padding: '12px', fontSize: '15px', marginTop: '4px' }}>
              {loading
                ? <DragonSpinner size={16} color="currentColor" />
                : mode === 'forgot' ? 'Send reset link' : mode === 'signup' ? 'Create account' : 'Log in'}
            </button>
          </form>

          <p style={{ marginTop: '24px', fontSize: '14px', color: 'var(--text-muted)' }}>
            {mode === 'signup' && <>Already have an account? <Link to="/login" state={location.state} style={{ color: 'var(--text)' }}>Log in</Link></>}
            {mode === 'signin' && <>New to TrustWeb? <Link to="/signup" state={location.state} style={{ color: 'var(--text)' }}>Create an account</Link></>}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(''); setSuccess('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--text)', fontFamily: 'inherit', padding: 0 }}
              >
                Back to log in
              </button>
            )}
          </p>

          {mode === 'signup' && (
            <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              By creating an account you agree that your locked picks and results are shown publicly
              on your profile.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 6.294C4.672 4.169 6.656 3.58 9 3.58z"/>
    </svg>
  )
}
