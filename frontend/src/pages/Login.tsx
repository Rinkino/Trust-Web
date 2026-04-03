import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Lock, ShieldCheck, TrendingUp, Shield } from 'lucide-react'
import Aurora from '../components/Aurora'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogle() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  return (
    <div style={{ position: 'relative' }}>
      <Aurora />
      <div style={{
        position: 'relative', zIndex: 1,
        minHeight: 'calc(100vh - 60px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}>
        <div className="animate-scale-in" style={{ width: '100%', maxWidth: '400px' }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div className="animate-float" style={{
              width: '68px', height: '68px', margin: '0 auto 18px',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
              borderRadius: '20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 40px var(--accent-glow)',
            }}>
              <Shield size={30} strokeWidth={1.5} color="#fff" />
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '6px' }}>Welcome to TrustWeb</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6 }}>
              Sign in to build your prediction credibility
            </p>
          </div>

          {/* Card */}
          <div className="glass-glow" style={{ padding: '32px', marginBottom: '20px' }}>
            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: 'var(--danger)', fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            <button
              onClick={handleGoogle}
              disabled={loading}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: '10px',
                border: '1px solid #e2e8f0', background: '#fff',
                color: '#1a1a1a', fontWeight: 600, fontSize: '15px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                transition: 'opacity 0.15s, transform 0.15s, box-shadow 0.2s',
                opacity: loading ? 0.6 : 1,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
              onMouseEnter={e => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
              }}
            >
              {loading ? (
                <div style={{
                  width: '18px', height: '18px', borderRadius: '50%',
                  border: '2px solid #ddd', borderTopColor: '#333',
                  animation: 'spin 0.7s linear infinite',
                }} />
              ) : <GoogleIcon />}
              {loading ? 'Redirecting...' : 'Continue with Google'}
            </button>

            <p style={{
              textAlign: 'center', marginTop: '20px', fontSize: '12px',
              color: 'var(--text-muted)', lineHeight: 1.6,
            }}>
              By signing in, you agree to our terms. Your predictions are permanent once locked.
            </p>
          </div>

          {/* Feature pills */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {[
              { icon: <Lock size={14} strokeWidth={1.5} />, text: 'Predictions locked on-chain' },
              { icon: <ShieldCheck size={14} strokeWidth={1.5} />, text: 'Cryptographically verified' },
              { icon: <TrendingUp size={14} strokeWidth={1.5} />, text: 'Scored by math' },
            ].map((f, i) => (
              <div
                key={f.text}
                className={`animate-fade-in-up delay-${i + 2}`}
                style={{
                  flex: 1, minWidth: '110px',
                  padding: '12px 10px', borderRadius: '12px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                  lineHeight: 1.4,
                }}
              >
                <span style={{ color: 'var(--accent-light)' }}>{f.icon}</span>
                {f.text}
              </div>
            ))}
          </div>

          <p className="animate-fade-in-up delay-5" style={{
            textAlign: 'center', marginTop: '24px', fontSize: '12px',
            color: 'var(--text-subtle)', letterSpacing: '0.02em',
          }}>
            trusted by predictors worldwide
          </p>
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
