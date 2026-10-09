import Link from 'next/link'
import { notFound } from 'next/navigation'
import LocalTime from '@/components/LocalTime'
import PickWidget from '@/components/PickWidget'
import { ProbBar } from '@/components/viz'
import { latestSelection, select, type CountValue, type PredictionRow, type Selection } from '@/lib/db'
import { drivers, effect, factValue, headline, type Explanation } from '@/lib/explain'
import { outcomeOfScore } from '@/lib/picks'

export const dynamic = 'force-dynamic'

const MATCH = /^[0-9]{4}-[0-9]{2}_[a-z0-9-]+_[a-z0-9-]+$/
const pct = (x: number | undefined | null) => (x == null ? '—' : `${Math.round(x * 100)}%`)

type Match = {
  match_id: string; season: string; home_team: string; away_team: string; kickoff_utc: string | null; match_date: string
  status: string; fthg: number | null; ftag: number | null
}

export default async function MatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  if (!MATCH.test(matchId)) notFound()
  const [m] = await select<Match>('epl_matches', {
    select: 'match_id,season,home_team,away_team,kickoff_utc,match_date,status,fthg,ftag', match_id: `eq.${matchId}`, limit: 1,
  })
  if (!m) notFound()
  const preds = await select<PredictionRow>('epl_predictions', {
    select: 'prediction_id,match_id,created_at,data_cutoff,values,target_models,pipeline_run,model_version,generated_before_kickoff',
    mode: 'eq.live', model_name: 'eq.selected', match_id: `eq.${matchId}`, order: 'created_at.desc', limit: 20,
  })
  // The prediction shown is the latest one published before kickoff.
  const p = preds.find(r => r.generated_before_kickoff !== false)
  const [expl, selection] = await Promise.all([
    p ? select<{ explanation: Explanation }>('epl_prediction_explanations', {
      select: 'explanation', pipeline_run: `eq.${p.pipeline_run}`, match_id: `eq.${matchId}`, limit: 1,
    }) : Promise.resolve([]),
    latestSelection(),
  ])
  const sel = Object.fromEntries(selection.map(s => [s.target, s])) as Record<string, Selection>
  const started = !!m.kickoff_utc && new Date(m.kickoff_utc).getTime() <= Date.now()
  const open = m.status === 'scheduled' && !started
  const done = m.status === 'completed' && m.fthg != null && m.ftag != null
  const H = m.home_team, A = m.away_team

  const v = p?.values
  const outcome = v?.outcome as number[] | undefined
  const top = (v?.top_scorelines as number[][] | undefined) ?? []
  const tm = (p?.target_models ?? {}) as Record<string, string>
  const e = expl[0]?.explanation
  // Use the explanation only if it explains the model that produced the result probabilities shown.
  const explains = !!(e && outcome && e.model_name === tm.outcome && e.outcome &&
    e.outcome.every((x, i) => Math.abs(x - outcome[i]) < 0.002))
  const fav = outcome ? (['H', 'D', 'A'] as const)[outcome.indexOf(Math.max(...outcome))] : null
  const actualIdx = done ? (m.fthg! > m.ftag! ? 0 : m.fthg === m.ftag ? 1 : 2) : null

  return (
    <>
      <p className="small"><Link href="/">← Upcoming matches</Link></p>
      <h1 className="match-h1">{H} <span className="muted">vs</span> {A}</h1>
      <p className="lede">
        {m.kickoff_utc ? <>Kick-off <LocalTime iso={m.kickoff_utc} /></> : `Match date ${m.match_date}`} · Premier League {m.season.replace('-', '/')}
        {done ? <> · <strong>Final score {m.fthg}–{m.ftag}</strong></> : started ? ' · kicked off, result not yet in our data' : ''}
      </p>

      <section className="card model-box">
        <h2 className="box-title">The model&apos;s prediction</h2>
        {!p || !outcome ? (
          <p className="muted">
            No prediction has been published for this match yet. Predictions are made for fixtures in the next three weeks,
            after each daily update.
          </p>
        ) : (
          <>
            <p className="headline">{headline(outcome, H, A)}</p>
            <div className="hda big">
              <div><span className="hda-n">{pct(outcome[0])}</span><span className="hda-l">{H} win</span></div>
              <div><span className="hda-n">{pct(outcome[1])}</span><span className="hda-l">Draw</span></div>
              <div><span className="hda-n">{pct(outcome[2])}</span><span className="hda-l">{A} win</span></div>
            </div>
            <ProbBar p={outcome} />
            {done && actualIdx != null && (
              <p className="small" style={{ marginTop: 8 }}>
                Result: <strong>{['home win', 'draw', 'away win'][actualIdx]}</strong>. The model gave it {pct(outcome[actualIdx])}
                {actualIdx === outcome.indexOf(Math.max(...outcome)) ? ', its most likely outcome.' : '.'}
              </p>
            )}
            <div className="grid two" style={{ marginTop: 16 }}>
              <div>
                <h3>Most likely scores</h3>
                <ol className="scores">
                  {top.slice(0, 3).map(([h, a, pr]) => <li key={`${h}-${a}`}><span className="mono">{h}–{a}</span> <span className="muted small">{pct(pr)}</span></li>)}
                </ol>
                {top[0] && fav && outcomeOfScore(top[0][0], top[0][1]) !== fav && (
                  <p className="note">
                    Any single exact score is unlikely. The likeliest exact score can be a draw even when one team is favoured,
                    because that team&apos;s winning chance is spread over many scores (1–0, 2–0, 2–1, …).
                  </p>
                )}
              </div>
              <div>
                <h3>Expected goals</h3>
                <p className="mono" style={{ fontSize: 20 }}>
                  {(v!.goals_home as CountValue | undefined)?.mean.toFixed(2) ?? '—'} – {(v!.goals_away as CountValue | undefined)?.mean.toFixed(2) ?? '—'}
                </p>
                <p className="note">The average number of goals the model expects each side to score, if this match were played many times.</p>
              </div>
            </div>
            <p className="note">
              Published <LocalTime iso={p.created_at} />, using results up to {p.data_cutoff.slice(0, 10)}. Stored predictions are never edited.
            </p>
          </>
        )}
      </section>

      {p && outcome && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2 className="box-title">Why the model thinks this</h2>
          {explains && e ? (
            <>
              <p>
                The result chances come from how many goals the model expects each side to score. It starts from what an
                average team in its training data would score (<span className="mono">{e.baseline_expected.toFixed(2)}</span> goals),
                then each group of inputs moves that number up or down:
              </p>
              <div className="grid two" style={{ marginTop: 12 }}>
                {(['home', 'away'] as const).map(side => {
                  const d = drivers(e, side, H, A)
                  return (
                    <div key={side}>
                      <h3>{side === 'home' ? H : A}: <span className="mono">{e.sides[side].expected.toFixed(2)}</span> expected goals</h3>
                      <ul className="drivers">
                        {d.big.map(x => (
                          <li key={x.key}><span className={x.pct > 0 ? 'pos' : 'neg'}>{x.pct > 0 ? '▲' : '▼'}</span> {x.text} <span className="muted">{effect(x.pct)}</span></li>
                        ))}
                        {d.small > 0 && <li className="muted small">{d.small} other input group{d.small > 1 ? 's' : ''} changed it by less than 3%.</li>}
                      </ul>
                    </div>
                  )
                })}
              </div>
              <h3 style={{ marginTop: 16 }}>The inputs it used</h3>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Going into the match</th><th className="num">{H}</th><th className="num">{A}</th></tr></thead>
                  <tbody>
                    {Object.entries(e.fact_labels).map(([k, label]) => (
                      <tr key={k}><td>{label}</td><td className="num">{factValue(k, e.facts.home[k])}</td><td className="num">{factValue(k, e.facts.away[k])}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="note">
                &ldquo;Recent, weighted&rdquo; averages count the last few games most. Early in a season, league position and
                points per game rest on few matches. These percentages show how this model splits its own calculation; related
                inputs (such as goals and shots) share credit, so they are not proof of cause. The model knows nothing about
                injuries, line-ups or transfers.
              </p>
            </>
          ) : (
            <p className="muted">
              A detailed explanation is not stored for this prediction: it was published before explanations were added. It
              will appear with the next daily update.
            </p>
          )}
        </section>
      )}

      <div style={{ marginTop: 16 }}>
        <PickWidget matchId={m.match_id} home={H} away={A} open={open} />
      </div>

      {p && v && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2 className="box-title">Other numbers</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Expected</th><th className="num">{H}</th><th className="num">{A}</th><th></th></tr></thead>
              <tbody>
                {[['shots', 'Shots'], ['sot', 'Shots on target'], ['corners', 'Corners'], ['yellows', 'Yellow cards']].map(([s, label]) => {
                  const h = v[`${s}_home`] as CountValue | undefined, a = v[`${s}_away`] as CountValue | undefined
                  const weak = sel[`${s}_home`]?.reliable === false || sel[`${s}_away`]?.reliable === false
                  return (
                    <tr key={s}>
                      <td>{label}</td>
                      <td className="num">{h ? `${h.mean.toFixed(1)} (${h.pi80[0]}–${h.pi80[1]})` : '—'}</td>
                      <td className="num">{a ? `${a.mean.toFixed(1)} (${a.pi80[0]}–${a.pi80[1]})` : '—'}</td>
                      <td>{weak ? <span className="tag warn">less reliable</span> : null}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="note">Ranges in brackets: the model expects the actual number to land in this range about 8 times in 10.</p>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>Chance of…</th><th className="num">Model</th><th></th></tr></thead>
              <tbody>
                {[['goals_over_2_5', '3 or more goals'], ['btts', 'Both teams score'], ['corners_over_9_5', '10 or more corners'], ['yellows_at_least_4', '4 or more yellow cards']].map(([k, label]) => (
                  <tr key={k}>
                    <td>{label}</td>
                    <td className="num">{pct(v[k] as number | undefined)}</td>
                    <td>
                      {tm[k] === 'baseline'
                        ? <span className="tag warn">league average: same for every match</span>
                        : sel[k]?.reliable === false ? <span className="tag warn">not clearly better than average in testing</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            Where a figure says &ldquo;league average&rdquo;, no model beat the plain league-wide rate when tested, so the site shows that rate
            for every match rather than a less accurate guess.{' '}
            {!started && <Link href={`/predictions?match=${encodeURIComponent(m.match_id)}`}>All numbers, with the model behind each one</Link>}
          </p>
        </section>
      )}
    </>
  )
}
