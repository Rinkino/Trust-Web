/**
 * AI-powered leg resolver
 *
 * For legs where fixture_id=null (league not covered by football-data.org or api-sports),
 * we ask a Groq LLM with web search to look up the match result directly.
 *
 * Required env vars:
 *   GROQ_API_KEY   — Groq API key
 *   TAVILY_API_KEY — Tavily search API key (free tier: 1000 req/month)
 */

import Groq from 'groq-sdk'
import type { PredictionLeg } from './apisports'

async function webSearch(query: string): Promise<string> {
  if (!process.env.TAVILY_API_KEY) return 'Search unavailable — no TAVILY_API_KEY'

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:        process.env.TAVILY_API_KEY,
      query,
      search_depth:   'basic',
      max_results:    5,
      include_answer: true,
    }),
  })

  if (!res.ok) return `Search failed: ${res.status}`
  const data = await res.json() as any
  const snippets = (data.results || []).map((r: any) => `${r.title}: ${r.content}`).join('\n\n')
  return data.answer ? `${data.answer}\n\n${snippets}` : snippets
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

  const unresolvable = legs.filter(l => !l.fixture_id && l.home_team && l.away_team && l.kickoff_at)
  if (!unresolvable.length) return null

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const legsDescription = unresolvable.map((l, i) =>
    `Leg ${i + 1}: ${l.home_team} vs ${l.away_team} on ${l.kickoff_at?.split('T')[0]} | market: ${l.market_type} | selection: ${l.market_value}`
  ).join('\n')

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
