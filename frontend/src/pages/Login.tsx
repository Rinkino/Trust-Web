import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Lock, ShieldCheck, TrendingUp, Mail, Eye, EyeOff } from 'lucide-react'

function DragonLogo({ size = 20, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 260 260" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M199.02,231.09c-13.25-57.48-90.49-86.23-108.58-107.12c-9.3-10.74-6.97-22.15-1.16-28.29c6.24-6.58,18.13-7.88,27-2.09c7.76,5.05,22.86,19.06,26.25,24.23c3.39,5.16,3.35,9.43,5.17,12.9c2.07,3.9,6.75,5.98,13.53,3.95c6.28-1.87,9.75-4.35,9.75-4.35s-6.56-0.25-9.16-3.94c0,0-9.1-19.95-12.36-28.11c10.43,2.77,17.05,5.97,21.68,8.89c0.57,4.44-1.32,12.09-1.4,12.43c0.21-0.12,3.58-2.11,8.59-7.1c0.25,0.21,0.5,0.41,0.74,0.6c1.77,1.41-1.49,12.56-1.49,12.56s6.12-4.11,10.8-9.67c4.05-4.79,7.46-10.87,7.46-10.87s-13.25-5.6-19.36-15.3c-6.13-9.69-0.79-20.21-0.79-20.21s-10.22-3.28-18.78-15.62c-9-12.98-5.52-28.93-5.52-28.93c-7.32,2.94-13.74,17.5-13.74,17.5s-18.49-9.87-42.51-6.8C73.47,35.69,53.33,22.55,44.97,1.8c0,0-6.47,28.39,18.04,46.26c-1.33,0.9-2.66,1.85-3.99,2.87c-11.96,6.81-27.15,6.41-38.85-1.79c0,0,0.62,4.26,2.9,9.38c2.28,5.11,6.21,11.09,12.84,14.53c0.71,0.37,1.41,0.67,2.1,0.93c-1.38,2.2-2.66,4.48-3.81,6.82C27.67,91.76,14.56,97.3,2,94.02c0,0,6.59,12.03,18.41,13.5c2.73,0.34,5.11-0.07,7.15-0.88c-0.1,4.98,0.15,9.64,0.71,14.06c-0.3,9.68-6.83,18.27-16.35,20.99h-0.01c0,0,9.18,5.46,17.68,1.78c1.66-0.72,2.94-1.7,3.93-2.79c6.98,16.86,19.64,30.46,35.78,45.97c4.33,4.17,9.19,8.63,14.12,13.28c48.5,2.8,85.22,24.51,116.32,57.87C200.72,250.56,201.44,241.58,199.02,231.09z" />
      <path d="M147.91,70.11l13.72,13.65l-21.9-7.9L147.91,70.11z" />
      <path d="M181.003,133.297c0,0,6.706,6.836,16.005,8.195c-0.628,3.718-1.577,5.572-1.577,5.572s15.96,12.85,35.508,4.572c-0.902,10.276-13.643,14.81-13.643,14.81S230.983,183.407,258,173c-14.657,19.075-36.539,13.759-49.848,6.944C196.19,173.819,180.788,155.727,181.003,133.297z" />
    </svg>
  )
}

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
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      })
      if (error) { setError(error.message); setLoading(false); return }
      // If session returned immediately (email confirmation disabled) set username
      if (data.session && data.user) {
        await supabase.from('profiles').update({ username: username.toLowerCase().replace(/\s/g, '') }).eq('id', data.user.id)
        // onAuthStateChange in App.tsx will redirect — nothing to do here
      } else {
        setSuccess('Account created! Check your inbox to confirm your email, then sign in.')
      }
      setLoading(false)
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
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{
              width: '64px', height: '64px', margin: '0 auto 16px',
              background: 'var(--accent)',
              borderRadius: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 24px rgba(var(--accent-rgb),0.4)',
            }}>
              <DragonLogo size={38} color="#fff" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>TrustWeb</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
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
                  ? <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid #ddd', borderTopColor: '#333', animation: 'spin 0.7s linear infinite' }} />
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
                    ? <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
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
