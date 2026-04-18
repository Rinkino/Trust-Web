/**
 * AI-powered leg resolver
 *
 * For legs where fixture_id=null, attempts to find the match via
 * football-data.org / api-sports using team names + date.
 * Falls back to Groq LLM web search if the direct API lookup fails.
 */

import Groq from 'groq-sdk'
import * as cheerio from 'cheerio'
import type { PredictionLeg } from './apisports'
import { searchFixture, getFixtureResult, determineOutcome } from './apisports'

// ---------------------------------------------------------------------------
// Direct API lookup (no LLM needed)
// ---------------------------------------------------------------------------

async function resolveViaAPI(
  leg: PredictionLeg,
  eventStartDate: string,
): Promise<{ outcome: 'WON' | 'LOST' | 'PENDING' | 'UNKNOWN'; score: string; reasoning: string }> {
  if (!leg.home_team || !leg.away_team) return { outcome: 'UNKNOWN', score: '?', reasoning: 'No team names' }

  const sport = leg.sport ?? 'football'

  // Try the leg's own date first, then fall back to event_start_time date
  const dates = Array.from(new Set([
    leg.kickoff_at ? leg.kickoff_at.split('T')[0] : null,
    eventStartDate,
    // Also try day before and after in case of timezone drift
    new Date(new Date(eventStartDate).getTime() - 86_400_000).toISOString().split('T')[0],
    new Date(new Date(eventStartDate).getTime() + 86_400_000).toISOString().split('T')[0],
  ].filter(Boolean) as string[]))

  for (const date of dates) {
    const fixture = await searchFixture(leg.home_team, leg.away_team, date, sport)
    if (!fixture) continue

    const result = await getFixtureResult(fixture.fixtureId, sport, fixture.source)
    if (!result) continue

    if (!result.finished) {
      return { outcome: 'PENDING', score: '?', reasoning: `Match found (${result.homeTeam} vs ${result.awayTeam}) but not finished yet` }
    }

    const score = `${result.homeScore}-${result.awayScore}`
    const outcome = determineOutcome(result, leg.market_type ?? '', leg.market_value ?? '') as 'WON' | 'LOST' | 'PENDING' | 'UNKNOWN'
    return { outcome, score, reasoning: `${result.homeTeam} ${result.homeScore}–${result.awayScore} ${result.awayTeam}` }
  }

  return { outcome: 'UNKNOWN', score: '?', reasoning: 'Not found in football-data.org or api-sports' }
}

// ---------------------------------------------------------------------------
// Groq fallback (web search via DuckDuckGo)
// ---------------------------------------------------------------------------

async function webSearch(query: string): Promise<string> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) return `Search failed: ${res.status}`
  const html = await res.text()
  const $ = cheerio.load(html)
  const snippets: string[] = []
  $('.result__snippet').each((_, el) => { const t = $(el).text().trim(); if (t) snippets.push(t) })
  $('.result__title').each((_, el) => { const t = $(el).text().trim(); if (t) snippets.unshift(t) })
  return snippets.slice(0, 10).join('\n\n') || 'No results found'
}

async function resolveViaGroq(
  legs: PredictionLeg[],
  eventStartDate: string,
): Promise<LegResolution[] | null> {
  if (!process.env.GROQ_API_KEY) return null

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const legsDescription = legs.map((l, i) => {
    const date = l.kickoff_at ? l.kickoff_at.split('T')[0] : eventStartDate
    return `Leg ${i + 1}: ${l.home_team} vs ${l.away_team} on ${date} | tournament: ${l.tournament ?? 'unknown'} | market: ${l.market_type} | selection: ${l.market_value}`
  }).join('\n')

  const tools: Groq.Chat.ChatCompletionTool[] = [{
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for a football match result',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'e.g. "PSG vs Lyon result April 18 2026"' } },
        required: ['query'],
      },
    },
  }]

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `You are a football match result resolver. For each leg, search the web to find the final score, then determine if the selection WON or LOST.

Market types:
- 1x2 / 1X2: "1"/"home" = home win, "X"/"draw" = draw, "2"/"away" = away win
- BTTS: "Yes" = both teams scored, "No" = at least one team scored 0
- over_under / OVER_UNDER: "over_2.5" = total goals > 2.5, "under_2.5" < 2.5
- DOUBLE_CHANCE: "1X" = home or draw, "X2" = away or draw, "12" = either team wins
- DNB: "1" = home, "2" = away, draw = void

Search for each match individually. If not finished return PENDING. If you truly cannot find it return UNKNOWN.
Respond ONLY with a JSON array with keys: home_team, away_team, market_type, market_value, outcome (WON/LOST/PENDING/UNKNOWN), reasoning.`,
    },
    { role: 'user', content: `Resolve these legs:\n${legsDescription}` },
  ]

  for (let i = 0; i < 10; i++) {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0,
    })

    const msg = response.choices[0].message
    messages.push(msg as any)

    if (!msg.tool_calls?.length) {
      const raw = msg.content?.trim() ?? ''
      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return null
      try { return JSON.parse(jsonMatch[0]) as LegResolution[] } catch { return null }
    }

    for (const call of msg.tool_calls) {
      if (call.function.name === 'web_search') {
        const { query } = JSON.parse(call.function.arguments)
        console.log(`[ai-resolver] groq search: ${query}`)
        const result = await webSearch(query)
        messages.push({ role: 'tool', tool_call_id: call.id, content: result })
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

type LegOutcome = 'WON' | 'LOST' | 'PENDING' | 'UNKNOWN'

export interface LegResolution {
  home_team:   string
  away_team:   string
  market_type: string
  market_value: string
  outcome:     LegOutcome
  reasoning:   string
}

/**
 * Resolves legs with no fixture_id.
 * First tries direct API lookup (football-data.org / api-sports).
 * Falls back to Groq LLM web search for anything still UNKNOWN.
 * Returns null if no unresolvable legs exist.
 */
export async function resolveLegsViaAI(
  legs: PredictionLeg[],
  eventStartTime?: string,
): Promise<LegResolution[] | null> {
  const unresolvable = legs.filter(l => !l.fixture_id && l.home_team && l.away_team)
  if (!unresolvable.length) return null

  const eventStartDate = eventStartTime
    ? eventStartTime.split('T')[0]
    : new Date().toISOString().split('T')[0]

  const results: LegResolution[] = []

  // Step 1 — direct API lookup per leg
  for (const leg of unresolvable) {
    const r = await resolveViaAPI(leg, eventStartDate)
    results.push({
      home_team:    leg.home_team!,
      away_team:    leg.away_team!,
      market_type:  leg.market_type ?? '',
      market_value: leg.market_value ?? '',
      outcome:      r.outcome,
      reasoning:    r.reasoning,
    })
    console.log(`[ai-resolver] API lookup: ${leg.home_team} vs ${leg.away_team} → ${r.outcome} (${r.reasoning})`)
  }

  // Groq fallback disabled — DuckDuckGo is blocked on Railway and burns token quota for nothing

  return results
}
