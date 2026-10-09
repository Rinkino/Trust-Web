'use client'
// Google sign-in, the same Supabase Auth that TrustWeb uses. The session is kept in
// cookies (not only in the browser) so the middleware can require it for every page.
import { createBrowserClient } from '@supabase/ssr'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { SUPABASE_URL } from '@/lib/db'

let client: ReturnType<typeof createBrowserClient> | null = null

export function supabase() {
  if (!client) client = createBrowserClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '')
  return client
}

/** Google sign-in; afterwards the visitor lands on `next` (a path on this site). */
export async function signInWithGoogle(next = '/') {
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
  await supabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
}

export async function signOut() {
  await supabase().auth.signOut()
  window.location.assign('/login')
}

export async function accessToken(): Promise<string | null> {
  const { data } = await supabase().auth.getSession()
  return data.session?.access_token ?? null
}

/** Current session; `undefined` while it is still being read. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    supabase().auth.getSession().then(({ data }: { data: { session: Session | null } }) => setSession(data.session))
    const { data } = supabase().auth.onAuthStateChange((_e: AuthChangeEvent, s: Session | null) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}

/** Fired after sign-in, sign-out or a claim, so pick widgets reload. */
export const PICKS_CHANGED = 'epl-picks-changed'
