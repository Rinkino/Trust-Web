import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SUPABASE_URL } from '@/lib/db'

/** Supabase client for server components and route handlers; the session lives in cookies. */
export async function serverSupabase() {
  const store = await cookies()
  return createServerClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
    cookies: {
      getAll: () => store.getAll(),
      setAll: list => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options))
        } catch {
          // Server components cannot set cookies; the middleware refreshes them instead.
        }
      },
    },
  })
}

/** Only for showing or hiding UI. Access control is the middleware's job (it verifies the user). */
export async function hasSessionCookie(): Promise<boolean> {
  const store = await cookies()
  return store.getAll().some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token') && c.value)
}

/** A same-site path to return to after sign-in; anything else becomes "/". */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/'
}
