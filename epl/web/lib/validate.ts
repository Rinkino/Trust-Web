// Input validation for the public API routes. Kept free of framework imports so it
// can be unit-tested with node --test.
export type DemoMode = 'auto' | 'live' | 'historical'

export function parseDemoRequest(body: unknown): { ok: true; mode: DemoMode } | { ok: false; error: string } {
  if (body === null || body === undefined || body === '') return { ok: true, mode: 'auto' }
  if (typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'body must be a JSON object' }
  const keys = Object.keys(body as object)
  if (keys.some(k => k !== 'mode')) return { ok: false, error: 'only "mode" is accepted' }
  const mode = (body as { mode?: unknown }).mode ?? 'auto'
  if (mode !== 'auto' && mode !== 'live' && mode !== 'historical') return { ok: false, error: 'mode must be auto, live or historical' }
  return { ok: true, mode }
}

const SEASON = /^\d{4}-\d{2}$/
const SAFE = /^[A-Za-z0-9 '&._-]{1,40}$/
const MODELS = new Set(['baseline', 'team_avg', 'poisson_strength', 'glm', 'hgb', 'logit_outcome', 'hgb_outcome', 'market', 'selected'])

export type HistoryFilter = { season?: string; team?: string; model: string; target?: string; page: number }

export function parseHistoryFilter(p: Record<string, string | string[] | undefined>, targets: string[]): HistoryFilter {
  const one = (k: string) => { const v = p[k]; return Array.isArray(v) ? v[0] : v }
  const season = one('season'); const team = one('team'); const model = one('model'); const target = one('target')
  const page = Math.max(1, Math.min(500, Number.parseInt(one('page') ?? '1', 10) || 1))
  return {
    season: season && SEASON.test(season) ? season : undefined,
    team: team && SAFE.test(team) ? team : undefined,
    model: model && MODELS.has(model) ? model : 'selected',
    target: target && targets.includes(target) ? target : undefined,
    page,
  }
}

/** CSV cell escaping (RFC 4180) and formula-injection guard. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  if (/^[=+\-@]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
