'use client'
// Who owns a pick: the signed-in account if there is one, otherwise this browser.
// The browser key is 32 random bytes kept in localStorage; the server stores only its
// SHA-256, so the key is the only way to see or change picks made while signed out.
import { accessToken } from '@/lib/auth'

const STORAGE = 'epl-pick-key'
const KEY = /^[0-9a-f]{64}$/

export function readKey(): string | null {
  try {
    const k = window.localStorage.getItem(STORAGE)
    return k && KEY.test(k) ? k : null
  } catch {
    return null
  }
}

export function getOrCreateKey(): string | null {
  const existing = readKey()
  if (existing) return existing
  try {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    const k = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
    window.localStorage.setItem(STORAGE, k)
    return readKey()
  } catch {
    return null // storage blocked: picks cannot be kept without signing in
  }
}

export function setKey(k: string): boolean {
  if (!KEY.test(k)) return false
  try {
    window.localStorage.setItem(STORAGE, k)
    return true
  } catch {
    return false
  }
}

/** Calls /api/picks as the signed-in user when there is a session, else with the browser key. */
export async function callPicks<T = any>(body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const token = await accessToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch('/api/picks', { method: 'POST', headers, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({ error: `Request failed (${res.status})` }))
  return { ok: res.ok && !data.error, status: res.status, data }
}

/** Key to send with a request: none when signed in (the account owns the pick). */
export function keyFor(signedIn: boolean, create: boolean): string | null | undefined {
  if (signedIn) return undefined
  return create ? getOrCreateKey() : readKey()
}
