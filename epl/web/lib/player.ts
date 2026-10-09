'use client'
// The visitor's pick key: 32 random bytes kept in this browser. The server stores only
// its SHA-256, so the key is the only way to see or change these picks.
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
    return null // storage blocked: picks cannot be kept
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

export async function callPicks<T = any>(body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const res = await fetch('/api/picks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({ error: `Request failed (${res.status})` }))
  return { ok: res.ok && !data.error, status: res.status, data }
}
