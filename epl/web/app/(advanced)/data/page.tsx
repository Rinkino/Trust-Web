import { count, latestRun, select, type PipelineRun } from '@/lib/db'
import { pct, when } from '@/lib/format'

// Rendered per request; the underlying fetches are cached for 5 minutes (lib/db.ts).
export const dynamic = 'force-dynamic'

type Audit = {
  source: string; source_url: string; retrieved_at: string; http_status: number | null; bytes: number | null; sha256: string | null
  records_retrieved: number; records_accepted: number; records_rejected: number; validation_errors: any[]
}

const COVERAGE_COLS: [string, string][] = [['hs', 'Shots'], ['hst', 'On target'], ['hc', 'Corners'], ['hf', 'Fouls'], ['hy', 'Yellows'], ['hr', 'Reds'], ['hxg', 'xG'], ['odds_avg_h', 'Odds'], ['kickoff_time', 'Kick-off time']]

export default async function DataPage() {
  const run = await latestRun()
  const [runs, audit, scheduled] = await Promise.all([
    select<PipelineRun>('epl_pipeline_runs', { select: 'run_key,started_at,finished_at,status,error,workflow_url,stages', order: 'started_at.desc', limit: 10 }),
    run ? select<Audit>('epl_data_source_audit', { select: '*', pipeline_run: `eq.${run.run_key}`, order: 'source_url.asc' }) : Promise.resolve([] as Audit[]),
    count('epl_matches', { status: 'eq.scheduled', kickoff_utc: `gt.${new Date().toISOString()}` }),
  ])
  const coverage: Record<string, Record<string, number>> = run?.summary?.data?.coverage ?? {}
  const fixtures = audit.filter(a => a.source === 'fixturedownload.com')
  const results = audit.filter(a => a.source === 'football-data.co.uk')
  const other = audit.filter(a => a.source !== 'fixturedownload.com' && a.source !== 'football-data.co.uk')
  const lastOk = runs.find(r => r.status === 'succeeded')

  return (
    <>
      <h1>Data status</h1>
      <p className="lede">
        Where the data comes from, what was rejected and why, and which statistics exist for which seasons. Raw files are
        downloaded fresh on every pipeline run; their checksums are recorded here.
      </p>

      <div className="grid stats">
        <div className="card stat"><div className="label">Last successful run</div><div className="value" style={{ fontSize: 16 }}>{lastOk ? when(lastOk.finished_at) : '—'}</div><div className="sub mono">{lastOk?.run_key}</div></div>
        <div className="card stat"><div className="label">Results files</div><div className="value">{results.length}</div><div className="sub">{results.reduce((s, a) => s + a.records_accepted, 0).toLocaleString()} matches accepted, {results.reduce((s, a) => s + a.records_rejected, 0)} rejected</div></div>
        <div className="card stat"><div className="label">Fixture source</div><div className="value" style={{ fontSize: 16 }}>{fixtures[0]?.http_status === 200 ? 'healthy' : fixtures.length ? `HTTP ${fixtures[0].http_status}` : '—'}</div><div className="sub">{fixtures[0] ? `${fixtures[0].records_accepted} fixtures, ${scheduled} still to play` : ''}</div></div>
      </div>

      <h2>Pipeline runs</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Run</th><th>Status</th><th>Started</th><th>Finished</th><th>Stages</th><th>Logs</th></tr></thead>
          <tbody>
            {runs.map(r => (
              <tr key={r.run_key}>
                <td className="mono small">{r.run_key}</td>
                <td><span className={`tag ${r.status === 'succeeded' ? 'good' : r.status === 'failed' ? 'bad' : 'warn'}`}>{r.status}</span>{r.error ? <div className="small neg" style={{ maxWidth: 360 }}>{r.error.split('\n')[0]}</div> : null}</td>
                <td className="small">{when(r.started_at)}</td>
                <td className="small">{when(r.finished_at)}</td>
                <td className="small">{Object.entries(r.stages ?? {}).map(([k, v]) => `${k} ${v.seconds ?? ''}s`).join(' · ')}</td>
                <td className="small">{r.workflow_url ? <a href={r.workflow_url}>GitHub Actions</a> : 'local'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Sources in the latest run</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Source</th><th>File</th><th className="num">HTTP</th><th className="num">Retrieved</th><th className="num">Accepted</th><th className="num">Rejected</th><th>Notes</th><th>SHA-256</th></tr></thead>
          <tbody>
            {[...fixtures, ...results, ...other].map((a, i) => {
              const rejects = a.validation_errors.filter(e => e.reason || e.conflict || e.unverified_result)
              const warns = a.validation_errors.filter(e => e.warning)
              return (
                <tr key={i}>
                  <td className="small">{a.source}</td>
                  <td className="small mono">{a.source_url.replace('https://www.football-data.co.uk/mmz4281/', '').replace('https://', '')}</td>
                  <td className="num">{a.http_status ?? '—'}</td>
                  <td className="num">{a.records_retrieved}</td>
                  <td className="num">{a.records_accepted}</td>
                  <td className={`num ${a.records_rejected ? 'neg' : ''}`}>{a.records_rejected}</td>
                  <td className="small">
                    {rejects.slice(0, 3).map((e, j) => <div key={j} className="neg">{e.reason ?? JSON.stringify(e.conflict ?? e.unverified_result)}</div>)}
                    {warns.length ? <div className="muted">{warns.length} warning(s): {String(warns[0].warning).slice(0, 80)}</div> : null}
                  </td>
                  <td className="mono small muted">{a.sha256?.slice(0, 10)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h2>Statistic coverage by season</h2>
      <p className="note">Share of completed matches with each field present. Missing statistics are stored as empty, never as zero, and those matches are left out of that statistic&apos;s training and evaluation.</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Season</th><th className="num">Matches</th>{COVERAGE_COLS.map(([, l]) => <th key={l} className="num">{l}</th>)}</tr></thead>
          <tbody>
            {Object.entries(coverage).sort(([a], [b]) => (a < b ? 1 : -1)).map(([season, c]) => (
              <tr key={season}>
                <td>{season}</td>
                <td className="num">{c.matches}</td>
                {COVERAGE_COLS.map(([k]) => <td key={k} className={`num ${c[k] === 0 ? 'muted' : c[k] < 1 ? 'warn' : ''}`}>{pct(c[k] ?? null)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="note" style={{ paddingLeft: 18, display: 'grid', gap: 6, marginTop: 14 }}>
        <li>Results and match statistics: football-data.co.uk season files (E0). Their redistribution terms are not stated, so raw files are not kept in the repository.</li>
        <li>Schedule: fixturedownload.com season feed. A fixture is eligible only if it is in the schedule, not in the results file, and its kick-off is in the future.</li>
        <li>Referee, attendance and odds are stored but never used as model inputs; average odds appear only as an evaluation reference.</li>
        <li>Kick-off times exist from 2019/20; earlier matches have dates only.</li>
      </ul>
    </>
  )
}
