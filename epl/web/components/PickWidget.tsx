'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { PICKS_CHANGED, useSession } from '@/lib/auth'
import { callPicks, keyFor } from '@/lib/player'
import { outcomeOfScore, type Outcome } from '@/lib/picks'

type Saved = { pick: Outcome; home_goals: number | null; away_goals: number | null; updated_at?: string }

/** The visitor's own prediction for one match. Shown apart from the model's numbers. */
export default function PickWidget({ matchId, home, away, open }: { matchId: string; home: string; away: string; open: boolean }) {
  const [saved, setSaved] = useState<Saved | null>(null)
  const [pick, setPick] = useState<Outcome | null>(null)
  const [hg, setHg] = useState('')
  const [ag, setAg] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const [loaded, setLoaded] = useState(false)

  const session = useSession()
  const signedIn = !!session

  useEffect(() => {
    if (session === undefined) return
    const load = () => {
      const key = keyFor(!!session, false)
      if (!session && !key) { setSaved(null); setLoaded(true); return }
      callPicks<{ picks: (Saved & { match_id: string })[] }>({ action: 'list', ...(key ? { key } : {}) }).then(r => {
        const mine = r.ok ? r.data.picks.find(p => p.match_id === matchId) : undefined
        setSaved(mine ?? null)
        setPick(mine?.pick ?? null)
        setHg(mine?.home_goals?.toString() ?? ''); setAg(mine?.away_goals?.toString() ?? '')
        setLoaded(true)
      }).catch(() => setLoaded(true))
    }
    load()
    window.addEventListener(PICKS_CHANGED, load)
    return () => window.removeEventListener(PICKS_CHANGED, load)
  }, [matchId, session])

  const label = (o: Outcome) => (o === 'H' ? `${home} win` : o === 'A' ? `${away} win` : 'Draw')

  async function save() {
    if (!pick) return
    const key = keyFor(signedIn, true)
    if (!signedIn && !key) { setMsg({ text: 'This browser is blocking storage. Sign in with Google to keep a pick.', bad: true }); return }
    const body: Record<string, unknown> = { action: 'save', ...(key ? { key } : {}), match_id: matchId, pick }
    if (hg !== '' || ag !== '') {
      const h = Number(hg), a = Number(ag)
      if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h > 20 || a > 20) {
        setMsg({ text: 'Enter both scores as whole numbers, or leave both empty.', bad: true }); return
      }
      if (outcomeOfScore(h, a) !== pick) { setMsg({ text: `A ${h}–${a} score is not a "${label(pick)}". Change the score or the result.`, bad: true }); return }
      body.home_goals = h; body.away_goals = a
    }
    setBusy(true); setMsg(null)
    const r = await callPicks<{ saved: Saved }>(body)
    setBusy(false)
    if (!r.ok) { setMsg({ text: r.data.error ?? 'Could not save.', bad: true }); return }
    setSaved(r.data.saved)
    setMsg({ text: signedIn ? 'Saved to your account. You can change it until kickoff.' : 'Saved in this browser. You can change it until kickoff.' })
  }

  async function clear() {
    const key = keyFor(signedIn, false)
    if (!signedIn && !key) return
    setBusy(true); setMsg(null)
    const r = await callPicks({ action: 'clear', ...(key ? { key } : {}), match_id: matchId })
    setBusy(false)
    if (!r.ok) { setMsg({ text: r.data.error ?? 'Could not remove.', bad: true }); return }
    setSaved(null); setPick(null); setHg(''); setAg('')
    setMsg({ text: 'Pick removed.' })
  }

  if (!open) {
    return (
      <section className="card pick">
        <h2 className="pick-title">Your prediction</h2>
        {!loaded ? <p className="muted small">Loading…</p> : saved ? (
          <p>You picked <strong>{label(saved.pick)}</strong>{saved.home_goals != null ? ` (${saved.home_goals}–${saved.away_goals})` : ''}. Picks closed at kickoff. <Link href="/my-picks">See how you scored</Link>.</p>
        ) : <p className="muted">Picks for this match closed at kickoff.</p>}
      </section>
    )
  }

  return (
    <section className="card pick">
      <h2 className="pick-title">Your prediction</h2>
      <p className="small muted">Separate from the model. Pick what you think will happen; it is scored automatically after the match.</p>
      <div className="choice" role="radiogroup" aria-label="Your result">
        {(['H', 'D', 'A'] as Outcome[]).map(o => (
          <button key={o} type="button" role="radio" aria-checked={pick === o} className={`choice-btn${pick === o ? ' on' : ''}`} onClick={() => setPick(o)}>
            {label(o)}
          </button>
        ))}
      </div>
      <div className="score-row">
        <span className="small muted">Exact score (optional, +2 points):</span>
        <label className="score-in"><span className="sr">{home} goals</span><input inputMode="numeric" value={hg} onChange={e => setHg(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="–" aria-label={`${home} goals`} /></label>
        <span>–</span>
        <label className="score-in"><span className="sr">{away} goals</span><input inputMode="numeric" value={ag} onChange={e => setAg(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="–" aria-label={`${away} goals`} /></label>
      </div>
      <div className="pick-actions">
        <button className="btn" type="button" disabled={!pick || busy} onClick={save}>{busy ? 'Saving…' : saved ? 'Update my pick' : 'Save my pick'}</button>
        {saved && <button className="btn ghost" type="button" disabled={busy} onClick={clear}>Remove</button>}
        <Link href="/my-picks" className="small">My picks</Link>
      </div>
      {msg && <p className={`small ${msg.bad ? 'neg' : 'pos'}`} role="status">{msg.text}</p>}
      <p className="note">
        Scoring: 1 point for the right result, 2 more for the exact score.{' '}
        {session ? <>Saved to your account ({session.user.email}).</> : null}
      </p>
    </section>
  )
}
