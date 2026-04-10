import puppeteer, { type Browser } from 'puppeteer-core'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const CHROME_PATH =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: CHROME_PATH,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    })
  }
  return browser
}

export type SportybetSlip = {
  shareCode: string
  teams:     string[]
  selection: string
  odds:      number
  status:    'PENDING' | 'WON' | 'LOST' | 'VOID'
}

/**
 * Share code pages on Sportybet are publicly accessible — no login needed.
 * We navigate directly to the share URL and read the result.
 */
export async function fetchSporbetSlip(shareCode: string): Promise<SportybetSlip> {
  const b    = await getBrowser()
  const page = await b.newPage()

  try {
    // Mask automation fingerprint
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver',          { get: () => false })
      Object.defineProperty(navigator, 'plugins',            { get: () => [1, 2, 3] })
      Object.defineProperty(navigator, 'languages',          { get: () => ['en-NG', 'en'] })
      // @ts-ignore
      window.chrome = { runtime: {} }
    })

    await page.setUserAgent(
      'Mozilla/5.0 (Linux; Android 12; SM-A325F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36'
    )

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-NG,en;q=0.9',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    })

    const shareUrl = `https://www.sportybet.com/?shareCode=${shareCode}&c=ng`
    await page.goto(shareUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

    // Give JS time to render the betslip content
    await sleep(4000)

    const slip = await page.evaluate((code: string) => {
      // ── STATUS DETECTION ────────────────────────────────────────────────────
      // Look for explicit status elements before falling back to text scanning.
      // Sportybet renders a result badge/label with a specific class or attribute.

      let status: 'PENDING' | 'WON' | 'LOST' | 'VOID' = 'PENDING'

      // Strategy 1: look for an element that contains ONLY a status word
      const allElements = Array.from(document.querySelectorAll('*'))
      const statusEl = allElements.find(el => {
        const t = el.textContent?.trim().toUpperCase() ?? ''
        return (t === 'WON' || t === 'LOST' || t === 'VOID' || t === 'WIN' || t === 'LOSE') &&
               (el as HTMLElement).offsetParent !== null // visible
      })

      if (statusEl) {
        const t = statusEl.textContent!.trim().toUpperCase()
        if (t === 'WON' || t === 'WIN')               status = 'WON'
        else if (t === 'LOST' || t === 'LOSE')         status = 'LOST'
        else if (t === 'VOID')                         status = 'VOID'
      }

      // Strategy 2: look for class names that indicate the result
      if (status === 'PENDING') {
        const wonEl  = document.querySelector('[class*="won"],[class*="win"],[class*="Won"],[class*="Win"]')
        const lostEl = document.querySelector('[class*="lost"],[class*="lose"],[class*="Lost"],[class*="Lose"]')
        const voidEl = document.querySelector('[class*="void"],[class*="Void"],[class*="cancel"],[class*="Cancel"]')
        if (wonEl)       status = 'WON'
        else if (lostEl) status = 'LOST'
        else if (voidEl) status = 'VOID'
      }

      // Strategy 3: look for data attributes
      if (status === 'PENDING') {
        const dataEl = document.querySelector('[data-status],[data-result],[data-outcome]')
        if (dataEl) {
          const val = (
            dataEl.getAttribute('data-status') ||
            dataEl.getAttribute('data-result') ||
            dataEl.getAttribute('data-outcome') ||
            ''
          ).toUpperCase()
          if (val.includes('WON') || val.includes('WIN'))          status = 'WON'
          else if (val.includes('LOST') || val.includes('LOSE'))   status = 'LOST'
          else if (val.includes('VOID') || val.includes('CANCEL')) status = 'VOID'
        }
      }

      // Strategy 4: scan text lines for standalone status words (last resort)
      // We only match lines that are short and consist mainly of the status word
      // to avoid matching "login to win big" style phrases.
      if (status === 'PENDING') {
        const lines = document.body.innerText.split('\n').map(l => l.trim()).filter(Boolean)
        for (const line of lines) {
          const upper = line.toUpperCase()
          // Only match if the line is a short status label (≤20 chars)
          if (upper.length <= 20) {
            if (upper === 'WON' || upper === 'WIN' || upper.startsWith('BET WON') || upper.startsWith('TICKET WON')) {
              status = 'WON'; break
            }
            if (upper === 'LOST' || upper === 'LOSE' || upper.startsWith('BET LOST') || upper.startsWith('TICKET LOST')) {
              status = 'LOST'; break
            }
            if (upper === 'VOID' || upper.startsWith('BET VOID') || upper.startsWith('CANCELLED')) {
              status = 'VOID'; break
            }
          }
        }
      }

      // ── ODDS ────────────────────────────────────────────────────────────────
      // Find the total odds display — usually the largest decimal number on the page
      const allText = document.body.innerText
      const oddsMatches = [...allText.matchAll(/\b(\d+\.\d{2})\b/g)]
        .map(m => parseFloat(m[1]))
        .filter(n => n >= 1.01 && n <= 1000)
      // Take the largest — that's typically the total/accumulator odds
      const odds = oddsMatches.length > 0 ? Math.max(...oddsMatches) : 2.0

      // ── TEAMS ────────────────────────────────────────────────────────────────
      const lines = document.body.innerText.split('\n').map((l: string) => l.trim()).filter(Boolean)
      const teamLines = lines.filter((l: string) =>
        l.includes(' vs ') || l.includes(' v ') || (l.includes(' - ') && l.length < 80)
      )
      const teams = teamLines.length > 0 ? teamLines.slice(0, 5) : [lines[0] || 'Unknown']

      // ── SELECTION ───────────────────────────────────────────────────────────
      const selectionLine = lines.find((l: string) =>
        l.toLowerCase().includes('home') ||
        l.toLowerCase().includes('away') ||
        l.toLowerCase().includes('draw') ||
        l.toLowerCase().includes('over') ||
        l.toLowerCase().includes('under') ||
        l.toLowerCase().includes('1x2')
      )

      return {
        shareCode: code,
        teams,
        selection: selectionLine || teams[0] || 'Unknown',
        odds,
        status,
      }
    }, shareCode)

    return slip
  } finally {
    await page.close()
  }
}

export async function checkSporbetSlipStatus(shareCode: string): Promise<'PENDING' | 'WON' | 'LOST' | 'VOID'> {
  const slip = await fetchSporbetSlip(shareCode)
  return slip.status
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close()
    browser = null
  }
}
