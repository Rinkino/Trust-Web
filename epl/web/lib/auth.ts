'use client'
// Optional Google sign-in, the same Supabase Auth that TrustWeb uses. Signing in only
// keeps picks with an account so they survive across browsers and devices.
import { createClient, type Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { SUPABASE_URL } from '@/lib/db'

let client: ReturnType<typeof createClient> | null = null

export function supabase() {
  if (!client) client = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '')
  return client
}

export async function signInWithGoogle() {
  // Come back to the page the visitor was on.
  await supabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href.split('#')[0] } })
}

export async function signOut() {
  await supabase().auth.signOut()
}

export async function accessToken(): Promise<string | null> {
  const { data } = await supabase().auth.getSession()
  return data.session?.access_token ?? null
}

/** Current session; `undefined` while it is still being read. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    supabase().auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase().auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}

/** Fired after sign-in, sign-out or a claim, so pick widgets reload. */
export const PICKS_CHANGED = 'epl-picks-changed'
