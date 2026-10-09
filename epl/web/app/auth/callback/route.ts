import { NextResponse } from 'next/server'
import { safeNext, serverSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// Google sends the visitor back here with a one-time code; exchanging it sets the
// session cookies, then the visitor continues to the page they wanted.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))
  if (code) {
    const supabase = await serverSupabase()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
  }
  return NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(next)}`, url.origin))
}
