import { NextResponse } from 'next/server'
import { SUPABASE_URL } from '@/lib/db'
import { parseDemoRequest } from '@/lib/validate'

export const dynamic = 'force-dynamic'

// Creates a demo run through the epl-demo edge function, which selects the matches
// with a fresh seed and records the run with the service role. This route only
// validates input and forwards it.
export async function POST(req: Request) {
  let body: unknown = undefined
  const text = await req.text()
  if (text.length > 200) return NextResponse.json({ error: 'request too large' }, { status: 413 })
  if (text) {
    try { body = JSON.parse(text) } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }
  }
  const parsed = parseDemoRequest(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const res = await fetch(`${SUPABASE_URL}/functions/v1/epl-demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ mode: parsed.mode }),
    cache: 'no-store',
  })
  const out = await res.json().catch(() => ({ error: `demo service returned ${res.status}` }))
  return NextResponse.json(out, { status: res.ok ? 200 : res.status })
}
