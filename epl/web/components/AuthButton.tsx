'use client'
import { useEffect, useRef, useState } from 'react'
import { PICKS_CHANGED, signInWithGoogle, signOut, supabase, useSession } from '@/lib/auth'
import { callPicks, readKey } from '@/lib/player'

/** "Sign in with Google" in the header. After sign-in, picks made in this browser move into the account. */
export default function AuthButton() {
  const session = useSession()
  const [busy, setBusy] = useState(false)
  const claimed = useRef(false)

  useEffect(() => {
    const { data } = supabase().auth.onAuthStateChange(async (event, s) => {
      if (s && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && !claimed.current) {
        claimed.current = true
        const key = readKey()
        if (key) await callPicks({ action: 'claim', key }).catch(() => undefined)
      }
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') window.dispatchEvent(new Event(PICKS_CHANGED))
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <span className="auth" aria-hidden="true" />
  if (!session) {
    return (
      <button className="auth-btn" type="button" disabled={busy} onClick={() => { setBusy(true); signInWithGoogle().catch(() => setBusy(false)) }}>
        <GoogleMark /> Sign in
      </button>
    )
  }
  const name = (session.user.user_metadata?.full_name as string | undefined) ?? session.user.email ?? 'Signed in'
  return (
    <span className="auth">
      <span className="auth-name small" title={session.user.email ?? ''}>{name.split(' ')[0]}</span>
      <button className="auth-link small" type="button" onClick={() => signOut()}>Sign out</button>
    </span>
  )
}

function GoogleMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.6 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  )
}
