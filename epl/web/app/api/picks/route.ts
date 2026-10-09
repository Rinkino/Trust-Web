import { NextResponse } from 'next/server'
import { SUPABASE_URL } from '@/lib/db'
import { parsePicksRequest } from '@/lib/picks'

export const dynamic = 'force-dynamic'

// Saves, clears, lists and claims a visitor's picks through the epl-picks edge function, which
// holds the service role. This route only validates input and forwards it.
export async function POST(req: Request) {
  const text = await req.text()
  if (text.length > 400) return NextResponse.json({ error: 'request too large' }, { status: 413 })
  let body: unknown
  try { body = JSON.parse(text) } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }
  // Picks need a signed-in user: the browser sends its Supabase session token and
  // epl-picks verifies it. (A browser key is only sent once, to move earlier picks in.)
  const auth = req.headers.get('authorization') ?? ''
  const userToken = /^Bearer [A-Za-z0-9._-]{20,4096}$/.test(auth) ? auth.slice(7) : null
  if (!userToken) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const parsed = parsePicksRequest(body, true)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const res = await fetch(`${SUPABASE_URL}/functions/v1/epl-picks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}`,
      ...(userToken ? { 'X-User-Token': userToken } : {}),
    },
    body: JSON.stringify(parsed.req),
    cache: 'no-store',
  })
  const out = await res.json().catch(() => ({ error: `picks service returned ${res.status}` }))
  return NextResponse.json(out, { status: res.status })
}
