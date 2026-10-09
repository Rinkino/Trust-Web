'use client'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { useEffect, useRef } from 'react'
import { PICKS_CHANGED, signOut, supabase, useSession } from '@/lib/auth'
import { callPicks, readKey } from '@/lib/player'

/** The signed-in user and Sign out, in the header. After sign-in, picks made earlier in this browser move into the account. */
export default function AuthButton() {
  const session = useSession()
  const claimed = useRef(false)

  useEffect(() => {
    const { data } = supabase().auth.onAuthStateChange(async (event: AuthChangeEvent, s: Session | null) => {
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
  if (!session) return null // signed-out visitors only see the login page
  const name = (session.user.user_metadata?.full_name as string | undefined) ?? session.user.email ?? 'Signed in'
  return (
    <span className="auth">
      <span className="auth-name small" title={session.user.email ?? ''}>{name.split(' ')[0]}</span>
      <button className="auth-link small" type="button" onClick={() => signOut()}>Sign out</button>
    </span>
  )
}
