/**
 * ConvertBetCodes scraper
 *
 * Uses the bet-viewer web endpoint — no API key required.
 * Maintains a session (cookies + CSRF) per request cycle.
 *
 * Supported origin_bookie identifiers (examples):
 *   sportybet:ng, sportybet:gh, bet9ja, betking, 1xbet, msport, 22bet
 */

import * as cheerio from 'cheerio'

const BASE = 'https://convertbetcodes.com'
const BET_VIEWER_URL = `${BASE}/bet-viewer/`
const RETRIEVE_URL   = `${BASE}/bet-viewer/retrieve_bet_code`

export type SlipLeg = {
  index:      number
  tournament: string
  match:      string
  market:     string
  selection:  string
  odds:       number
  kickoff:    string   // raw string e.g. "Apr 10, 00:00.utc"
}

export type ConvertBetCodesSlip = {
  code:        string
  platform:    string
  totalOdds:   number
  legCount:    number
  legs:        SlipLeg[]
  matchesLeft: number  // 0 = all resolved, > 0 = still pending legs
  viewerLink:  string
}

async function fetchWithSession(
  code: string,
  originBookie: string
): Promise<{ view: string; link: string }> {
  // Step 1: GET the page to establish session + grab CSRF token
  const pageRes = await fetch(BET_VIEWER_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!pageRes.ok) throw new Error(`Failed to load bet-viewer page: ${pageRes.status}`)

  const cookies = pageRes.headers.get('set-cookie') || ''
  const html    = await pageRes.text()

  // Extract CSRF field name + value
  const csrfMatch = html.match(/name="(csrf_[^"]+)"\s+value="([^"]+)"/)
  if (!csrfMatch) throw new Error('Could not extract CSRF token from bet-viewer page')

  const [, csrfName, csrfValue] = csrfMatch

  // Step 2: POST to retrieve endpoint with session cookie + CSRF
  const body = new URLSearchParams({
    [csrfName]:    csrfValue,
    code:          code.trim().toUpperCase(),
    origin_bookie: originBookie,
  })

  const postRes = await fetch(RETRIEVE_URL, {
    method:  'POST',
    headers: {
      'Content-Type':     'application/x-www-form-urlencoded',
      'Referer':          BET_VIEWER_URL,
      'Origin':           BASE,
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie':           cookies,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: body.toString(),
  })

  if (!postRes.ok) throw new Error(`Retrieve request failed: ${postRes.status}`)

  const json = await postRes.json() as { view?: string; link?: string; error?: string }

  if (!json.view) throw new Error(json.error || 'Empty response from bet-viewer')

  return { view: json.view, link: json.link || '' }
}

function parseSlipHtml(
  view: string,
  link: string,
  code: string,
  originBookie: string
): ConvertBetCodesSlip {
  const $ = cheerio.load(view)

  // Total odds + leg count — "3events @10.14 odds"
  const summaryText = $('.tx-color-03 span').first().text().trim()
  const totalOddsMatch = summaryText.match(/@([\d.]+)\s+odds/)
  const legCountMatch  = summaryText.match(/^(\d+)/)
  const totalOdds = totalOddsMatch ? parseFloat(totalOddsMatch[1]) : 0
  const legCount  = legCountMatch  ? parseInt(legCountMatch[1])    : 0

  // Matches left — "0/3 matches left"
  const matchesLeftText = $('.list-label').first().text().trim()
  const matchesLeftMatch = matchesLeftText.match(/^(\d+)\//)
  const matchesLeft = matchesLeftMatch ? parseInt(matchesLeftMatch[1]) : legCount

  // Parse each leg
  const legs: SlipLeg[] = []

  $('.list-item').each((i, el) => {
    const $el = $(el)

    const tournament = $el.find('.tx-12.tx-color-03').first().text()
      .replace(/^\d+\./, '').trim()

    const match = $el.find('.tx-medium').first().text().trim()

    const marketEl  = $el.find('.tx-12.tx-color-03').last()
    const marketText = marketEl.clone().children('b').remove().end().text().trim()
    const selection  = marketEl.find('.badg').text().trim()

    const oddsText  = $el.find('.badge-pill').first().text().trim()
    const oddsMatch = oddsText.match(/@([\d.]+)/)
    const odds = oddsMatch ? parseFloat(oddsMatch[1]) : 0

    const kickoff = $el.find('.tx-danger').first().text().trim()

    legs.push({
      index:      i + 1,
      tournament,
      match,
      market:     marketText,
      selection,
      odds,
      kickoff,
    })
  })

  return {
    code:         code.toUpperCase(),
    platform:     originBookie,
    totalOdds,
    legCount,
    legs,
    matchesLeft,
    viewerLink: link,
  }
}

/**
 * Retrieve structured slip data for any supported bookmaker code.
 *
 * @param code         - The betslip share code e.g. "HRNXX6"
 * @param originBookie - Bookmaker identifier e.g. "sportybet:ng", "bet9ja"
 */
export async function retrieveSlip(
  code: string,
  originBookie: string
): Promise<ConvertBetCodesSlip> {
  const { view, link } = await fetchWithSession(code, originBookie)
  return parseSlipHtml(view, link, code, originBookie)
}

/**
 * Convenience wrapper for Sportybet Nigeria slips.
 */
export async function retrieveSportybetSlip(code: string): Promise<ConvertBetCodesSlip> {
  return retrieveSlip(code, 'sportybet:ng')
}
