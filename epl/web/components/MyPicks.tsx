'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import LocalTime from '@/components/LocalTime'
import { modelPick, points, type Outcome } from '@/lib/picks'
import { PICKS_CHANGED, useSession } from '@/lib/auth'
import { callPicks } from '@/lib/player'

type Row = {
  match_id: string; home_team: string; away_team: string; kickoff_utc: string
  pick: Outcome; home_goals: number | null; away_goals: number | null; updated_at: string
  match_status: string; fthg: number | null; ftag: number | null; ftr: string | null; points: number | null
  prediction: { prediction_id: string; created_at: string; outcome: number[] | null; top_scorelines: number[][] | null } | null
}

const name = (r: Row, o: Outcome) => (o === 'H' ? r.home_team : o === 'A' ? r.away_team : 'Draw')
const pct = (x: number) => `${Math.round(x * 100)}%`

export default function MyPicks() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')

  const session = useSession()

  async function load() {
    if (!session) { setRows([]); return }
    const r = await callPicks<{ picks: Row[] }>({ action: 'list' })
    if (!r.ok) { setError(r.data.error ?? 'Could not load your picks.'); setRows([]); return }
    setError('')
    setRows(r.data.picks)
  }

  useEffect(() => {
    if (session === undefined) return
    load()
    const reload = () => { load() }
    window.addEventListener(PICKS_CHANGED, reload)
    return () => window.removeEventListener(PICKS_CHANGED, reload)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])


  if (rows === null || session === undefined) return <p className="muted">Loading your picks…</p>

  const settled = rows.filter(r => r.match_status === 'completed' && r.fthg != null && r.ftag != null)
  const you = settled.reduce((s, r) => s + (r.points ?? 0), 0)
  const youRight = settled.filter(r => r.pick === r.ftr).length
  const model = settled.map(r => {
    const m = modelPick(r.prediction?.outcome, r.prediction?.top_scorelines)
    return m ? points(m.pick, m.score, [r.fthg!, r.ftag!]) : null
  })
  const modelScored = model.filter((x): x is number => x !== null)
  const modelPts = modelScored.reduce((s, x) => s + x, 0)
  const modelRight = settled.filter(r => { const m = modelPick(r.prediction?.outcome); return m && m.pick === r.ftr }).length

  return (
    <>
      {session && <p className="small muted" style={{ marginBottom: 12 }}>Signed in as {session.user.email}.</p>}
      {error && <p className="neg">{error}</p>}
      {rows.length === 0 ? (
        <div className="card">
          <p>You have not made any picks yet.</p>
          <p className="small muted" style={{ marginTop: 6 }}>Open a match from the <Link href="/">upcoming fixtures</Link> and choose a result.</p>
        </div>
      ) : (
        <>
          <div className="grid stats">
            <div className="card stat"><div className="label">Picks made</div><div className="value">{rows.length}</div><div className="sub">{rows.length - settled.length} waiting for a result</div></div>
            <div className="card stat"><div className="label">Your points</div><div className="value">{you}</div><div className="sub">{settled.length ? `${youRight} of ${settled.length} results right` : 'no finished matches yet'}</div></div>
            <div className="card stat model"><div className="label">The model on the same matches</div><div className="value">{settled.length ? modelPts : '—'}</div><div className="sub">{settled.length ? `${modelRight} of ${modelScored.length} results right` : 'compared once matches finish'}</div></div>
          </div>
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
              <thead><tr><th>Match</th><th>Kick-off</th><th>Your pick</th><th>Model&apos;s pick</th><th>Result</th><th className="num">You</th><th className="num">Model</th></tr></thead>
              <tbody>
                {rows.map(r => {
                  const m = modelPick(r.prediction?.outcome, r.prediction?.top_scorelines)
                  const done = r.match_status === 'completed' && r.fthg != null
                  const mp = done && m ? points(m.pick, m.score, [r.fthg!, r.ftag!]) : null
                  return (
                    <tr key={r.match_id}>
                      <td><Link href={`/match/${r.match_id}`}>{r.home_team} v {r.away_team}</Link></td>
                      <td className="small"><LocalTime iso={r.kickoff_utc} /></td>
                      <td>{name(r, r.pick)}{r.home_goals != null ? <span className="muted small"> ({r.home_goals}–{r.away_goals})</span> : null}</td>
                      <td className="model-cell">{m ? <>{name(r, m.pick)} <span className="muted small">({pct(m.prob)}{m.score ? `, ${m.score[0]}–${m.score[1]}` : ''})</span></> : <span className="muted small">no prediction</span>}</td>
                      <td>{done ? <strong>{r.fthg}–{r.ftag}</strong> : <span className="muted small">{new Date(r.kickoff_utc) > new Date() ? 'not played' : 'awaiting result'}</span>}</td>
                      <td className="num">{done ? r.points : '—'}</td>
                      <td className="num">{mp ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="note">
            Points: 1 for the right result, 2 more for the exact score. The model is scored the same way. Its pick is its most
            likely result in the prediction that was on the site when you made your pick, and its score is the likeliest
            scoreline that agrees with that result. Results come from football-data.co.uk, usually within a few days of the match.
          </p>
        </>
      )}

    </>
  )
}
