/**
 * AI-powered leg resolver
 *
 * For legs where fixture_id=null (league not covered by football-data.org or api-sports),
 * we ask a Groq LLM to look up the match result using DuckDuckGo search.
 * No extra API keys needed beyond GROQ_API_KEY.
 *
 * Required env vars:
 *   GROQ_API_KEY — Groq API key
 */

import Groq from 'groq-sdk'
import * as cheerio from 'cheerio'
import type { PredictionLeg } from './apisports'

async function webSearch(query: string): Promise<string> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const res  = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })

  if (!res.ok) return `Search failed: ${res.status}`

  const html = await res.text()
  const $    = cheerio.load(html)

  const snippets: string[] = []
  $('.result__snippet').each((_, el) => {
    const text = $(el).text().trim()
    if (text) snippets.push(text)
  })
  $('.result__title').each((_, el) => {
    const text = $(el).text().trim()
    if (text) snippets.unshift(text)
  })

  return snippets.slice(0, 10).join('\n\n') || 'No results found'
}

type LegOutcome = 'WON' | 'LOST' | 'PENDING' | 'UNKNOWN'

interface LegResolution {
  home_team:    string
  away_team:    string
  market_type:  string
  market_value: string
  outcome:      LegOutcome
  reasoning:    string
}

/**
 * Uses Groq + web search to resolve legs that have no fixture_id.
 * Returns per-leg outcomes. Returns null if Groq is not configured.
 */
export async function resolveLegsViaAI(
  legs: PredictionLeg[],
): Promise<LegResolution[] | null> {
  if (!process.env.GROQ_API_KEY) return null

  const unresolvable = legs.filter(l => !l.fixture_id && l.home_team && l.away_team)
  if (!unresolvable.length) return null

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const legsDescription = unresolvable.map((l, i) => {
    const date = l.kickoff_at ? l.kickoff_at.split('T')[0] : 'recent'
    return `Leg ${i + 1}: ${l.home_team} vs ${l.away_team} on ${date} | tournament: ${l.tournament ?? 'unknown'} | market: ${l.market_type} | selection: ${l.market_value}`
  }).join('\n')

  const tools: Groq.Chat.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name:        'web_search',
        description: 'Search the web for a football match result',
        parameters:  {
          type:       'object',
          properties: {
            query: { type: 'string', description: 'Search query e.g. "Arsenal vs Bournemouth April 11 2026 result"' },
          },
          required: ['query'],
        },
      },
    },
  ]

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    {
      role:    'system',
      content: `You are a football match result resolver. For each leg given, search the web to find the final score, then determine if the selection WON or LOST.

Market types:
- 1X2: "1" = home win, "X" = draw, "2" = away win
- BTTS: "Yes" = both teams scored, "No" = at least one team scored 0
- OVER_UNDER: "OVER_2.5" = total goals > 2.5, "UNDER_2.5" = total goals < 2.5 (adjust for other lines)
- DOUBLE_CHANCE: "1X" = home win or draw, "X2" = away win or draw, "12" = either team wins
- DNB: Draw No Bet — "1" = home, "2" = away, draw = void

If the match hasn't finished yet, return PENDING. If you cannot find the result after searching, return UNKNOWN.

Respond ONLY with a JSON array — one object per leg — with keys: home_team, away_team, market_type, market_value, outcome (WON/LOST/PENDING/UNKNOWN), reasoning.`,
    },
    {
      role:    'user',
      content: `Resolve these legs:\n${legsDescription}`,
    },
  ]

  // Agentic loop — let Groq call web_search as many times as needed
  for (let i = 0; i < 10; i++) {
    const response = await groq.chat.completions.create({
      model:       'llama-3.3-70b-versatile',
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0,
    })

    const msg = response.choices[0].message
    messages.push(msg as any)

    if (!msg.tool_calls?.length) {
      // Final answer
      const raw = msg.content?.trim() ?? ''
      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return null
      try {
        return JSON.parse(jsonMatch[0]) as LegResolution[]
      } catch {
        return null
      }
    }

    // Execute tool calls
    for (const call of msg.tool_calls) {
      if (call.function.name === 'web_search') {
        const { query } = JSON.parse(call.function.arguments)
        console.log(`[ai-resolver] searching: ${query}`)
        const result = await webSearch(query)
        messages.push({
          role:         'tool',
          tool_call_id: call.id,
          content:      result,
        })
      }
    }
  }

  return null
}
