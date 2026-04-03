const GAMMA_API = 'https://gamma-api.polymarket.com'

export function extractPolymarketSlug(url: string): string {
  // Expected format: https://polymarket.com/event/{slug}
  const match = url.match(/polymarket\.com\/event\/([^/?#]+)/)
  if (!match) {
    throw new Error('Invalid Polymarket URL — expected format: https://polymarket.com/event/{slug}')
  }
  return match[1]
}

function deriveWinner(market: {
  winner: string | null
  outcomePrices: string
  outcomes: string
}): 'YES' | 'NO' | null {
  if (market.winner) {
    const w = market.winner.toUpperCase()
    if (w === 'YES' || w === 'NO') return w as 'YES' | 'NO'
  }

  try {
    const prices: string[] = JSON.parse(market.outcomePrices)
    const outcomes: string[] = JSON.parse(market.outcomes)

    const yesIndex = outcomes.findIndex(o => o.toUpperCase() === 'YES')
    const noIndex  = outcomes.findIndex(o => o.toUpperCase() === 'NO')

    if (yesIndex !== -1 && Math.round(parseFloat(prices[yesIndex])) === 1) return 'YES'
    if (noIndex  !== -1 && Math.round(parseFloat(prices[noIndex]))  === 1) return 'NO'
  } catch {
    // malformed data — return null
  }

  return null
}

export async function fetchPolymarketMarket(url: string): Promise<{
  conditionId: string
  title: string
  endDate: string
  yesOdds: number
  noOdds: number
  closed: boolean
  winner: 'YES' | 'NO' | null
}> {
  const slug = extractPolymarketSlug(url)

  const response = await fetch(`${GAMMA_API}/events?slug=${encodeURIComponent(slug)}`)
  if (!response.ok) {
    throw new Error(`Gamma API returned ${response.status}`)
  }

  const events: any[] = await response.json()
  if (!events || events.length === 0) {
    throw new Error('No event found for this Polymarket URL')
  }

  const event = events[0]
  const markets: any[] = event.markets || []

  if (markets.length === 0) {
    throw new Error('Event has no markets')
  }

  // Use the first market with YES/NO outcomes
  const market = markets.find((m: any) => {
    try {
      const outcomes: string[] = JSON.parse(m.outcomes)
      return (
        outcomes.some((o: string) => o.toUpperCase() === 'YES') &&
        outcomes.some((o: string) => o.toUpperCase() === 'NO')
      )
    } catch {
      return false
    }
  }) || markets[0]

  const outcomes: string[] = JSON.parse(market.outcomes)
  const prices: string[] = JSON.parse(market.outcomePrices)

  const yesIndex = outcomes.findIndex(o => o.toUpperCase() === 'YES')
  const noIndex  = outcomes.findIndex(o => o.toUpperCase() === 'NO')

  const yesPrice = yesIndex !== -1 ? parseFloat(prices[yesIndex]) : parseFloat(prices[0])
  const noPrice  = noIndex  !== -1 ? parseFloat(prices[noIndex])  : parseFloat(prices[1])

  const yesOdds = yesPrice > 0 ? parseFloat((1 / yesPrice).toFixed(2)) : 0
  const noOdds  = noPrice  > 0 ? parseFloat((1 / noPrice).toFixed(2))  : 0

  return {
    conditionId: market.conditionId,
    title:       event.title || market.question,
    endDate:     event.endDate || '',
    yesOdds,
    noOdds,
    closed:      !!market.closed,
    winner:      deriveWinner(market),
  }
}

export async function fetchPolymarketMarketById(conditionId: string): Promise<{
  closed: boolean
  winner: 'YES' | 'NO' | null
}> {
  const response = await fetch(
    `${GAMMA_API}/markets?conditionId=${encodeURIComponent(conditionId)}`
  )
  if (!response.ok) {
    throw new Error(`Gamma API returned ${response.status}`)
  }

  const data: any = await response.json()

  // The endpoint may return an array or a single object
  const market = Array.isArray(data) ? data[0] : data

  if (!market) {
    throw new Error(`No market found for conditionId: ${conditionId}`)
  }

  return {
    closed: !!market.closed,
    winner: deriveWinner(market),
  }
}
