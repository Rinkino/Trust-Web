import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Lock, ShieldCheck, TrendingUp, Mail, Eye, EyeOff } from 'lucide-react'
import LogoOrbit from '../components/LogoOrbit'
import DragonSpinner from '../components/DragonSpinner'

type AuthMode = 'signin' | 'signup' | 'forgot'

export default function Login() {
  const [tab, setTab]               = useState<'google' | 'email'>('google')
  const [mode, setMode]             = useState<AuthMode>('signin')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [username, setUsername]     = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')

  async function handleGoogle() {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
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

    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match'); return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters'); return
    }

    setLoading(true)

    if (mode === 'signup') {
      if (!username || username.length < 3) {
        setError('Username must be at least 3 characters'); setLoading(false); return
      }
      // Use backend endpoint — creates user with email auto-confirmed, no verification email
      const apiUrl = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${apiUrl}/api/users/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Signup failed'); setLoading(false); return }
      // Account created — sign in immediately (email is already confirmed)
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (signInErr) setError(signInErr.message)
      // on success, onAuthStateChange in App.tsx handles redirect
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (error) setError(error.message)
      // on success, onAuthStateChange in App.tsx handles redirect
    }
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 60px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div>
        <div className="animate-scale-in" style={{ width: '100%', maxWidth: '400px' }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <LogoOrbit />
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '12px' }}>
              Build your prediction credibility
            </p>
          </div>

          {/* Auth tabs */}
          <div style={{
            display: 'flex', gap: '4px', marginBottom: '16px',
            padding: '4px', borderRadius: '12px',
            background: 'var(--surface)', border: '1px solid var(--border)',
          }}>
            {(['google', 'email'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); setSuccess('') }}
                style={{
                  flex: 1, padding: '9px', borderRadius: '8px', fontSize: '13px',
                  fontWeight: tab === t ? 700 : 400, border: 'none', cursor: 'pointer',
                  background: tab === t ? 'var(--accent)' : 'transparent',
                  color: tab === t ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                }}
              >
                {t === 'google' ? 'Google' : 'Email'}
              </button>
            ))}
          </div>

          {/* Card */}
          <div className="glass-glow" style={{ padding: '28px', marginBottom: '16px' }}>
            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: 'var(--danger)', fontSize: '13px',
              }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                color: 'var(--success)', fontSize: '13px',
              }}>
                {success}
              </div>
            )}

            {tab === 'google' && (
              <button
                onClick={handleGoogle}
                disabled={loading}
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: '10px',
                  border: '1px solid #e2e8f0', background: '#fff',
                  color: '#1a1a1a', fontWeight: 600, fontSize: '15px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading
                  ? <DragonSpinner size={18} color="#333" />
                  : <GoogleIcon />
                }
                {loading ? 'Redirecting...' : 'Continue with Google'}
              </button>
            )}

            {tab === 'email' && (
              <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {mode !== 'forgot' && (
                  <div style={{
                    display: 'flex', gap: '4px', marginBottom: '4px',
                    padding: '3px', borderRadius: '8px',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                  }}>
                    {(['signin', 'signup'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setMode(m); setError(''); setSuccess('') }}
                        style={{
                          flex: 1, padding: '7px', borderRadius: '6px', fontSize: '12px',
                          fontWeight: mode === m ? 700 : 400, border: 'none', cursor: 'pointer',
                          background: mode === m ? 'var(--surface)' : 'transparent',
                          color: mode === m ? 'var(--text)' : 'var(--text-muted)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {m === 'signin' ? 'Sign In' : 'Sign Up'}
                      </button>
                    ))}
                  </div>
                )}

                {mode === 'signup' && (
                  <div>
                    <label className="label" style={{ display: 'block', marginBottom: '8px' }}>Username</label>
                    <input
                      className="input"
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="yourname"
                      minLength={3}
                      required
                      autoComplete="username"
                    />
                  </div>
                )}

                <div>
                  <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <Mail size={12} strokeWidth={1.5} />
                    Email
                  </label>
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>

                {mode !== 'forgot' && (
                  <div>
                    <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="input"
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        required
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        style={{ paddingRight: '44px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(v => !v)}
                        style={{
                          position: 'absolute', right: '12px', top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', padding: '4px',
                        }}
                      >
                        {showPw ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'signup' && (
                  <div>
                    <label className="label" style={{ marginBottom: '8px', display: 'block' }}>
                      Confirm Password
                    </label>
                    <input
                      className="input"
                      type={showPw ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Repeat password"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-accent" style={{ padding: '13px', marginTop: '4px' }}>
                  {loading
                    ? <DragonSpinner size={14} color="#fff" />
                    : mode === 'forgot' ? 'Send Reset Link' : mode === 'signup' ? 'Create Account' : 'Sign In'
                  }
                </button>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {mode !== 'forgot' ? (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}
                    >
                      Forgot password?
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setMode('signin'); setError(''); setSuccess('') }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}
                    >
                      Back to sign in
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* Feature pills */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { icon: <Lock size={13} strokeWidth={1.5} />, text: 'Predictions locked on submit' },
              { icon: <ShieldCheck size={13} strokeWidth={1.5} />, text: 'Outcomes verified' },
              { icon: <TrendingUp size={13} strokeWidth={1.5} />, text: 'Scored by math' },
            ].map((f, i) => (
              <div
                key={f.text}
                className={`animate-fade-in-up delay-${i + 2}`}
                style={{
                  flex: 1, minWidth: '100px',
                  padding: '10px 8px', borderRadius: '10px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                  lineHeight: 1.4,
                }}
              >
                <span style={{ color: 'var(--accent-light)' }}>{f.icon}</span>
                {f.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 6.294C4.672 4.169 6.656 3.58 9 3.58z"/>
    </svg>
  )
}
