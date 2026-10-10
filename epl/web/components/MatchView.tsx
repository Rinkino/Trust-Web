'use client'
import { useEffect, useMemo, useState } from 'react'
import { PICKS_CHANGED, useSession } from '@/lib/auth'
import { callPicks } from '@/lib/player'
import {
  STATS, STAT_INFO, buildProps, compare, convolve, mean, over, settle, suggestions, type Prop, type Sides, type Stat,
} from '@/lib/props'

export type MatchData = {
  matchId: string; home: string; away: string; open: boolean
  outcome: number[] | null
  btts: number | null
  topScore: [number, number, number] | null
  sides: Partial<Record<Stat, Sides>>
  reliableTargets: string[]
  actual: Record<string, number | null> | null   // final statistics once the match is over
}

const pct = (x: number) => `${Math.round(x * 100)}%`

export default function MatchView({ d }: { d: MatchData }) {
  const reliable = useMemo(() => new Set(d.reliableTargets), [d.reliableTargets])
  const props = useMemo(() => buildProps({
    home: d.home, away: d.away, sides: d.sides, outcome: d.outcome, btts: d.btts, reliable: t => reliable.has(t),
  }), [d, reliable])
  const top = useMemo(() => suggestions(props), [props])
  const statsAvailable = STATS.filter(s => d.sides[s])
  const [tab, setTab] = useState<Stat>(statsAvailable[0] ?? 'goals')
  const saved = useSaved(d.matchId)

  return (
    <>
      {d.outcome && <ResultBlock d={d} />}

      {statsAvailable.length > 0 && <ExpectedTable d={d} stats={statsAvailable} />}

      <section className="block">
        <div className="block-head">
          <h2>Top picks for this match</h2>
          <span className="small muted">The model&apos;s most likely calls</span>
        </div>
        {top.length ? (
          <div className="pick-cards">
            {top.map(p => <PropCard key={p.key} p={p} d={d} saved={saved} big />)}
          </div>
        ) : <p className="muted">Picks appear after the next daily update.</p>}
        <p className="hint">
          A percentage is how often the model expects this to happen. Even a 70% pick misses about 3 times in 10.
          {top.some(p => !p.reliable) && ' Picks marked "close to average" are barely better than a league-wide guess.'}
        </p>
      </section>

      {statsAvailable.length > 0 && (
        <section className="block">
          <div className="tabs" role="tablist" aria-label="Statistic">
            {statsAvailable.map(s => (
              <button key={s} role="tab" aria-selected={tab === s} className={`tab${tab === s ? ' on' : ''}`} onClick={() => setTab(s)}>
                {STAT_INFO[s].name}
              </button>
            ))}
          </div>
          <StatPanel stat={tab} d={d} props={props} saved={saved} />
        </section>
      )}

      {saved.error && <p className="small neg" role="status">{saved.error}</p>}
    </>
  )
}

function ResultBlock({ d }: { d: MatchData }) {
  const [h, dr, a] = d.outcome!
  const best = Math.max(h, dr, a)
  const actual = d.actual?.fthg != null && d.actual?.ftag != null
    ? (d.actual.fthg! > d.actual.ftag! ? 0 : d.actual.fthg === d.actual.ftag ? 1 : 2) : null
  const tiles: [string, number][] = [[`${d.home} win`, h], ['Draw', dr], [`${d.away} win`, a]]
  return (
    <section className="block">
      <div className="result-tiles">
        {tiles.map(([label, p], i) => (
          <div key={label} className={`result-tile${p === best ? ' fav' : ''}${actual === i ? ' hit' : ''}`}>
            <span className="rt-p">{pct(p)}</span>
            <span className="rt-l">{label}</span>
          </div>
        ))}
      </div>
      <div className="split-bar" aria-hidden="true">
        <span style={{ width: `${h * 100}%`, background: 'var(--bar-h)' }} />
        <span style={{ width: `${dr * 100}%`, background: 'var(--bar-d)' }} />
        <span style={{ width: `${a * 100}%`, background: 'var(--bar-a)' }} />
      </div>
      {d.topScore && (
        <p className="center small">Most likely score <strong className="mono">{d.home} {d.topScore[0]}–{d.topScore[1]} {d.away}</strong> <span className="muted">({pct(d.topScore[2])})</span></p>
      )}
    </section>
  )
}

const ACTUAL_KEYS: Record<Stat, [string, string]> = {
  goals: ['fthg', 'ftag'], shots: ['hs', 'as'], sot: ['hst', 'ast'], corners: ['hc', 'ac'], yellows: ['hy', 'ay'],
}

/** Every statistic at a glance: each team's expected number, then the match total. */
function ExpectedTable({ d, stats }: { d: MatchData; stats: Stat[] }) {
  const actual = (s: Stat, i: 0 | 1) => d.actual?.[ACTUAL_KEYS[s][i]] ?? null
  const cell = (e: number, a: number | null) => (
    <td className="num">
      <strong>{e.toFixed(1)}</strong>
      {a != null && <span className="exp-act"> · {a}</span>}
    </td>
  )
  return (
    <section className="block">
      <div className="block-head">
        <h2>Expected numbers</h2>
        <span className="small muted">{d.actual ? 'Expected · actual' : 'Average the model expects'}</span>
      </div>
      <div className="table-wrap">
        <table className="exp-table">
          <thead>
            <tr><th /><th className="num">{d.home}</th><th className="num">{d.away}</th><th className="num">Total</th></tr>
          </thead>
          <tbody>
            {stats.map(s => {
              const sd = d.sides[s]!
              const eh = mean(sd.home), ea = mean(sd.away)
              const ah = actual(s, 0), aa = actual(s, 1)
              return (
                <tr key={s}>
                  <th scope="row">{STAT_INFO[s].name}</th>
                  {cell(eh, ah)}
                  {cell(ea, aa)}
                  {cell(eh + ea, ah != null && aa != null ? ah + aa : null)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function StatPanel({ stat, d, props, saved }: { stat: Stat; d: MatchData; props: Prop[]; saved: Saved }) {
  const sd = d.sides[stat]!
  const info = STAT_INFO[stat]
  const eh = mean(sd.home), ea = mean(sd.away)
  const max = Math.max(eh, ea, 0.01)
  const c = compare(sd.home, sd.away)
  const total = convolve(sd.home, sd.away)
  const by = (k: string) => props.find(p => p.key === k)
  // Lines worth showing: neither near-certain nor near-impossible.
  const lines = (dist: number[], all: number[]) => all.filter(l => { const p = over(dist, l); return p > 0.12 && p < 0.88 }).slice(0, 4)
  const actualH = d.actual ? d.actual[{ goals: 'fthg', corners: 'hc', yellows: 'hy', shots: 'hs', sot: 'hst' }[stat]] : null
  const actualA = d.actual ? d.actual[{ goals: 'ftag', corners: 'ac', yellows: 'ay', shots: 'as', sot: 'ast' }[stat]] : null

  return (
    <div className="panel">
      <div className="teams-vs">
        {([['home', d.home, eh, actualH], ['away', d.away, ea, actualA]] as const).map(([side, name, e, act]) => (
          <div key={side} className={`team-col ${side}`}>
            <span className="tc-name">{name}</span>
            <span className="tc-n">{e.toFixed(1)}</span>
            <span className="tc-l">expected {info.many}{act != null ? <> · actual <strong>{act}</strong></> : null}</span>
            <span className="tc-bar"><span style={{ width: `${(e / max) * 100}%` }} /></span>
          </div>
        ))}
      </div>

      {stat !== 'goals' && (
        <div className="who-more">
          <span className="small muted">Who gets more {info.many}?</span>
          <div className="split-bar tall">
            <span style={{ width: `${c.home * 100}%`, background: 'var(--bar-h)' }}>{c.home > 0.12 ? pct(c.home) : ''}</span>
            <span style={{ width: `${c.level * 100}%`, background: 'var(--bar-d)' }}>{c.level > 0.12 ? pct(c.level) : ''}</span>
            <span style={{ width: `${c.away * 100}%`, background: 'var(--bar-a)' }}>{c.away > 0.12 ? pct(c.away) : ''}</span>
          </div>
          <div className="who-legend small"><span>{d.home}</span><span>Same</span><span>{d.away}</span></div>
          <div className="chip-row">
            {(['home', 'away'] as const).map(side => { const p = by(`cmp:${stat}:${side}`); return p ? <PropChip key={p.key} p={p} d={d} saved={saved} /> : null })}
          </div>
        </div>
      )}

      <h3 className="panel-h">Match total · expected {mean(total).toFixed(1)}</h3>
      <div className="chip-row">
        {lines(total, info.total).flatMap(l => [by(`tot:${stat}:over:${l}`), by(`tot:${stat}:under:${l}`)])
          .filter((p): p is Prop => !!p).map(p => <PropChip key={p.key} p={p} d={d} saved={saved} />)}
      </div>

      {(['home', 'away'] as const).map(side => (
        <div key={side}>
          <h3 className="panel-h">{side === 'home' ? d.home : d.away}</h3>
          <div className="chip-row">
            {lines(sd[side], info.team).flatMap(l => [by(`team:${side}:${stat}:over:${l}`), by(`team:${side}:${stat}:under:${l}`)])
              .filter((p): p is Prop => !!p).map(p => <PropChip key={p.key} p={p} d={d} saved={saved} />)}
          </div>
        </div>
      ))}
      {!(d.reliableTargets.includes(`${stat}_home`) && d.reliableTargets.includes(`${stat}_away`)) && (
        <p className="hint">For {info.many}, this model was only slightly better than the league average in testing: treat these as rough.</p>
      )}
    </div>
  )
}

function Outcome({ p, d }: { p: Prop; d: MatchData }) {
  if (!d.actual) return null
  const r = settle(p.key, d.actual)
  if (r === null) return null
  return <span className={`tag ${r ? 'good' : 'bad'}`}>{r ? 'Happened' : 'Missed'}</span>
}

function PropCard({ p, d, saved, big }: { p: Prop; d: MatchData; saved: Saved; big?: boolean }) {
  return (
    <div className={`prop-card${big ? ' big' : ''}`}>
      <div className="pc-top">
        <span className="pc-p">{pct(p.p)}</span>
        <SaveButton p={p} d={d} saved={saved} />
      </div>
      <span className="pc-l">{p.label}</span>
      <span className="pc-bar"><span style={{ width: `${p.p * 100}%` }} /></span>
      <span className="pc-foot">
        {!p.reliable && <span className="tag warn">close to average</span>}
        <Outcome p={p} d={d} />
      </span>
    </div>
  )
}

function PropChip({ p, d, saved }: { p: Prop; d: MatchData; saved: Saved }) {
  const on = saved.keys.has(p.key)
  const r = d.actual ? settle(p.key, d.actual) : null
  return (
    <button type="button" className={`chip${on ? ' on' : ''}${r === true ? ' hit' : r === false ? ' miss' : ''}`}
      disabled={!d.open || saved.busy === p.key} onClick={() => saved.toggle(p, d)}
      title={d.open ? (on ? 'Saved. Tap to remove.' : 'Tap to save to My picks') : undefined}>
      <span className="chip-l">{chipLabel(p, d)}</span>
      <span className="chip-p">{pct(p.p)}</span>
      {on && <Check />}
    </button>
  )
}

/** Under a team heading the team name is implied; comparisons keep both names. */
function chipLabel(p: Prop, d: MatchData): string {
  if (!p.key.startsWith('team:')) return p.label
  const t = p.label.replace(`${d.home} `, '').replace(`${d.away} `, '')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function SaveButton({ p, d, saved }: { p: Prop; d: MatchData; saved: Saved }) {
  if (!d.open) return null
  const on = saved.keys.has(p.key)
  return (
    <button type="button" className={`save-btn${on ? ' on' : ''}`} disabled={saved.busy === p.key} onClick={() => saved.toggle(p, d)}>
      {on ? <><Check /> Saved</> : '+ Save'}
    </button>
  )
}

function Check() {
  return <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

type Saved = { keys: Set<string>; busy: string | null; error: string; toggle: (p: Prop, d: MatchData) => void }

/** The signed-in user's saved predictions for this match, with one-tap save and remove. */
function useSaved(matchId: string): Saved {
  const session = useSession()
  const [keys, setKeys] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) return
    const load = () => callPicks<{ props: { match_id: string; prop_key: string }[] }>({ action: 'list_props' }).then(r => {
      if (r.ok) setKeys(new Set(r.data.props.filter(x => x.match_id === matchId).map(x => x.prop_key)))
    }).catch(() => undefined)
    load()
    window.addEventListener(PICKS_CHANGED, load)
    return () => window.removeEventListener(PICKS_CHANGED, load)
  }, [session, matchId])

  async function toggle(p: Prop, d: MatchData) {
    if (!session) { setError('Sign in to save predictions.'); return }
    const on = keys.has(p.key)
    setBusy(p.key); setError('')
    const r = await callPicks(on
      ? { action: 'remove_prop', match_id: d.matchId, prop_key: p.key }
      : { action: 'save_prop', match_id: d.matchId, prop_key: p.key, label: p.label.slice(0, 120), model_prob: Math.round(p.p * 10000) / 10000 })
    setBusy(null)
    if (!r.ok) { setError(r.data.error ?? 'Could not save.'); return }
    const next = new Set(keys)
    if (on) next.delete(p.key); else next.add(p.key)
    setKeys(next)
  }
  return { keys, busy, error, toggle }
}
