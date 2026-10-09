'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function DemoButton({ mode = 'auto', label = 'Predict 3 Random Matches' }: { mode?: 'auto' | 'live' | 'historical'; label?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) })
      const body = await res.json()
      if (!res.ok || body.error) {
        setError(body.error ?? `Request failed (${res.status})`)
      } else {
        router.push(`/demo/${body.run_id}`)
      }
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 6 }}>
      <button className="btn" onClick={run} disabled={busy}>{busy ? 'Selecting…' : label}</button>
      {error && <span className="small neg" role="alert">{error}</span>}
    </span>
  )
}
