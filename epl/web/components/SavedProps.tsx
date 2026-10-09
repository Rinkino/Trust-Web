'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import LocalTime from '@/components/LocalTime'
import { PICKS_CHANGED, useSession } from '@/lib/auth'
import { callPicks } from '@/lib/player'

type Row = {
  match_id: string; prop_key: string; label: string; model_prob: number | null; created_at: string
  home_team: string; away_team: string; kickoff_utc: string; match_status: string; fthg: number | null; ftag: number | null
  won: boolean | null
}

const pct = (x: number) => `${Math.round(x * 100)}%`

/** Predictions the user saved from match pages, grouped by match, settled automatically. */
export default function SavedProps() {
  const session = useSession()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (session === undefined) return
    if (!session) { setRows([]); return }
    const load = () => callPicks<{ props: Row[] }>({ action: 'list_props' }).then(r => {
      if (!r.ok) { setError(r.data.error ?? 'Could not load saved predictions.'); setRows([]); return }
      setError(''); setRows(r.data.props)
    }).catch(() => setRows([]))
    load()
    window.addEventListener(PICKS_CHANGED, load)
    return () => window.removeEventListener(PICKS_CHANGED, load)
  }, [session])

  async function remove(r: Row) {
    setBusy(r.match_id + r.prop_key)
    const res = await callPicks({ action: 'remove_prop', match_id: r.match_id, prop_key: r.prop_key })
    setBusy(null)
    if (!res.ok) { setError(res.data.error ?? 'Could not remove.'); return }
    setRows(rows => (rows ?? []).filter(x => !(x.match_id === r.match_id && x.prop_key === r.prop_key)))
  }

  if (rows === null) return <p className="muted">Loading…</p>
  const settled = rows.filter(r => r.won !== null)
  const hits = settled.filter(r => r.won).length
  const expected = settled.reduce((s, r) => s + (r.model_prob ?? 0), 0)
  const matches = [...new Set(rows.map(r => r.match_id))]

  return (
    <section className="block">
      <div className="block-head">
        <h2>Saved predictions</h2>
        {settled.length > 0 && (
          <span className="small"><strong>{hits} of {settled.length}</strong> came true <span className="muted">(the model expected about {expected.toFixed(1)})</span></span>
        )}
      </div>
      {error && <p className="small neg">{error}</p>}
      {rows.length === 0 ? (
        <div className="card">
          <p>Nothing saved yet.</p>
          <p className="small muted" style={{ marginTop: 6 }}>Open a match from the <Link href="/">fixtures</Link> and tap <strong>+ Save</strong> on any prediction.</p>
        </div>
      ) : (
        <div className="saved-list">
          {matches.map(mid => {
            const items = rows.filter(r => r.match_id === mid)
            const r0 = items[0]
            const open = r0.match_status === 'scheduled' && new Date(r0.kickoff_utc).getTime() > Date.now()
            return (
              <div key={mid} className="saved-match">
                <div className="sm-head">
                  <Link href={`/match/${mid}`}><strong>{r0.home_team} v {r0.away_team}</strong></Link>
                  <span className="small muted">
                    {r0.fthg != null ? <>Final {r0.fthg}–{r0.ftag}</> : <LocalTime iso={r0.kickoff_utc} />}
                  </span>
                </div>
                {items.map(r => (
                  <div key={r.prop_key} className="saved-row">
                    <span>{r.label}</span>
                    <span className="mono small muted">{r.model_prob != null ? pct(r.model_prob) : ''}</span>
                    {r.won === true ? <span className="tag good">Happened</span>
                      : r.won === false ? <span className="tag bad">Missed</span>
                      : open ? <button type="button" className="link-btn small" disabled={busy === r.match_id + r.prop_key} onClick={() => remove(r)}>Remove</button>
                      : <span className="tag">Waiting</span>}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
      <p className="hint">
        Saved predictions lock at kick-off and are checked automatically against the final statistics, usually within a few days.
        The percentage is the model&apos;s chance when you saved it.
      </p>
    </section>
  )
}
