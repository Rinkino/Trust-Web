import Link from 'next/link'
import FixturePrediction from '@/components/FixturePrediction'
import { ProbBar } from '@/components/viz'
import { select, type CountValue, type PredictionRow } from '@/lib/db'
import { loadEvidence } from '@/lib/evidence'
import { num, pct, when } from '@/lib/format'
import { GROUPS } from '@/lib/targets'
import LeagueTabs from '@/components/LeagueTabs'
import { leagueOf } from '@/lib/leagues'

// Rendered per request; the underlying fetches are cached for 5 minutes (lib/db.ts).
export const dynamic = 'force-dynamic'

type SP = Promise<Record<string, string | undefined>>
const DATE = /^\d{4}-\d{2}-\d{2}$/

export default async function PredictionsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const league = leagueOf(sp.league)
  const now = new Date().toISOString()
  const rows = await select<PredictionRow>('epl_predictions', {
    select: '*', competition: `eq.${league}`, mode: 'eq.live', model_name: 'eq.selected', kickoff_utc: `gt.${now}`, order: 'kickoff_utc.asc,created_at.desc',
  })
  // Latest prediction per fixture
  const latest = new Map<string, PredictionRow>()
  for (const r of rows) if (!latest.has(r.match_id)) latest.set(r.match_id, r)
  let list = [...latest.values()]
  const teams = [...new Set(list.flatMap(r => [r.home_team, r.away_team]))].sort()
  const team = sp.team && teams.includes(sp.team) ? sp.team : ''
  const from = sp.from && DATE.test(sp.from) ? sp.from : ''
  const to = sp.to && DATE.test(sp.to) ? sp.to : ''
  const group = sp.group && GROUPS.includes(sp.group) ? sp.group : ''
  if (team) list = list.filter(r => r.home_team === team || r.away_team === team)
  if (from) list = list.filter(r => r.match_date >= from)
  if (to) list = list.filter(r => r.match_date <= to)
  const focus = sp.match ? list.find(r => r.match_id === sp.match) : undefined
  const evidence = focus ? await loadEvidence(league) : {}

  return (
    <>
      <LeagueTabs path="/predictions" current={league} />
      <h1 style={{ marginTop: 14 }}>Upcoming predictions</h1>
      <p className="lede">
        Verified fixtures from the published 2026/27 schedule that have not kicked off, within the next three weeks. Each
        prediction was generated before kickoff by the scheduled pipeline and is never edited afterwards.
      </p>
      <form className="filters" method="get">
        <label>Team
          <select name="team" defaultValue={team}>
            <option value="">All teams</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>From<input type="date" name="from" defaultValue={from} /></label>
        <label>To<input type="date" name="to" defaultValue={to} /></label>
        <label>Show
          <select name="group" defaultValue={group}>
            <option value="">Overview</option>
            {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <button className="btn ghost" type="submit">Filter</button>
      </form>

      {focus ? (
        <>
          <p><Link href="/predictions">← All fixtures</Link></p>
          <FixturePrediction p={focus} evidence={evidence} fixtureSource="fixturedownload.com schedule, cross-checked with football-data.co.uk results" />
        </>
      ) : list.length === 0 ? (
        <p className="muted">No eligible upcoming fixtures right now.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kick-off</th><th>Fixture</th>
                {(!group || group === 'Goals') && <><th>Result (H/D/A)</th><th className="num">Goals H</th><th className="num">Goals A</th><th className="num">Over 2.5</th><th className="num">BTTS</th></>}
                {group === 'Shots' && <><th className="num">Shots H</th><th className="num">Shots A</th><th className="num">On target H</th><th className="num">On target A</th></>}
                {(!group || group === 'Corners') && <><th className="num">Corners</th><th className="num">Over 9.5</th></>}
                {(!group || group === 'Cards') && <><th className="num">Yellows</th><th className="num">4+ yellows</th>{group === 'Cards' && <><th className="num">Red H</th><th className="num">Red A</th></>}</>}
                <th>Predicted</th>
              </tr>
            </thead>
            <tbody>
              {list.map(r => {
                const v = r.values
                const c = (k: string) => num((v[k] as CountValue | undefined)?.mean, 2)
                const q = (k: string) => pct(v[k] as number | undefined)
                return (
                  <tr key={r.match_id}>
                    <td className="small">{when(r.kickoff_utc)}</td>
                    <td><Link href={`/predictions?match=${encodeURIComponent(r.match_id)}`}>{r.home_team} v {r.away_team}</Link></td>
                    {(!group || group === 'Goals') && <>
                      <td style={{ minWidth: 150 }}>{v.outcome ? <ProbBar p={v.outcome as number[]} /> : '—'}</td>
                      <td className="num">{c('goals_home')}</td><td className="num">{c('goals_away')}</td>
                      <td className="num">{q('goals_over_2_5')}</td><td className="num">{q('btts')}</td>
                    </>}
                    {group === 'Shots' && <><td className="num">{c('shots_home')}</td><td className="num">{c('shots_away')}</td><td className="num">{c('sot_home')}</td><td className="num">{c('sot_away')}</td></>}
                    {(!group || group === 'Corners') && <><td className="num">{c('corners_total')}</td><td className="num">{q('corners_over_9_5')}</td></>}
                    {(!group || group === 'Cards') && <><td className="num">{c('yellows_total')}</td><td className="num">{q('yellows_at_least_4')}</td>{group === 'Cards' && <><td className="num">{q('red_home')}</td><td className="num">{q('red_away')}</td></>}</>}
                    <td className="small muted">{when(r.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="note">
        Numbers are expected values; open a fixture for 80% ranges, the model behind each figure and its historical error.
        Fixtures further than three weeks ahead are not predicted yet, because their inputs would be stale by kickoff.
      </p>
    </>
  )
}
