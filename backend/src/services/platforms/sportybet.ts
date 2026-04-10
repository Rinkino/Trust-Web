import puppeteer, { type Browser, type Page } from 'puppeteer-core'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const CHROME_PATH =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const SPORTYBET_EMAIL    = process.env.SPORTYBET_EMAIL    || ''
const SPORTYBET_PASSWORD = process.env.SPORTYBET_PASSWORD || ''

let browser: Browser | null = null
let loggedIn = false

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    browser  = await puppeteer.launch({
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
    loggedIn = false
  }
  return browser
}

async function setPageDefaults(page: Page) {
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3] })
    Object.defineProperty(navigator, 'languages', { get: () => ['en-NG', 'en'] })
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
}

/**
 * Log in to Sportybet using the service account credentials.
 * Called once per browser session; result is cached in `loggedIn`.
 */
async function ensureLoggedIn(): Promise<void> {
  if (loggedIn || !SPORTYBET_EMAIL || !SPORTYBET_PASSWORD) return

  const b    = await getBrowser()
  const page = await b.newPage()
  try {
    await setPageDefaults(page)
    await page.goto('https://www.sportybet.com/ng/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(2000)

    // Click login / sign-in button — try several selectors
    const loginSelectors = [
      'a[href*="login"]',
      'button[class*="login"]',
      '[class*="loginBtn"]',
      '[data-testid*="login"]',
      'a[class*="login"]',
    ]
    let clicked = false
    for (const sel of loginSelectors) {
      try {
        await page.click(sel)
        clicked = true
        break
      } catch {}
    }
    if (!clicked) {
      // Try clicking text "Login" or "Sign In"
      await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('a, button'))
        const el = els.find(e => /^(login|sign in)$/i.test(e.textContent?.trim() ?? ''))
        if (el) (el as HTMLElement).click()
      })
    }
    await sleep(2000)

    // Fill in email / phone field
    const emailSelectors = ['input[type="email"]', 'input[name*="phone"]', 'input[name*="email"]', 'input[placeholder*="email"]', 'input[placeholder*="phone"]']
    for (const sel of emailSelectors) {
      try {
        await page.type(sel, SPORTYBET_EMAIL, { delay: 80 })
        break
      } catch {}
    }

    // Fill in password
    const pwSelectors = ['input[type="password"]', 'input[name*="password"]', 'input[placeholder*="password"]']
    for (const sel of pwSelectors) {
      try {
        await page.type(sel, SPORTYBET_PASSWORD, { delay: 80 })
        break
      } catch {}
    }

    // Submit
    await page.keyboard.press('Enter')
    await sleep(3000)

    // Verify login succeeded — page should no longer show "Join Now"
    const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase())
    if (!bodyText.includes('join now') && !bodyText.includes('register now')) {
      loggedIn = true
    }
  } finally {
    await page.close()
  }
}

export type SportybetSlip = {
  shareCode: string
  teams:     string[]
  selection: string
  odds:      number
  status:    'PENDING' | 'WON' | 'LOST' | 'VOID'
}

/**
 * Share code pages on Sportybet are publicly accessible but may require login
 * depending on region/geo. We try without login first; if a login wall is hit
 * and credentials are configured, we log in and retry once.
 */
export async function fetchSporbetSlip(shareCode: string): Promise<SportybetSlip> {
  const result = await _fetchSlip(shareCode)
  return result
}

async function _fetchSlip(shareCode: string, retryAfterLogin = true): Promise<SportybetSlip> {
  const b    = await getBrowser()
  const page = await b.newPage()

  try {
    await setPageDefaults(page)

    const shareUrl = `https://www.sportybet.com/?shareCode=${shareCode}&c=ng`
    await page.goto(shareUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(4000)

    const pageText = await page.evaluate(() => document.body.innerText.toLowerCase())
    const loginWallPhrases = ['join now', 'register now', 'sign up', 'create account']
    const isLoginWall = loginWallPhrases.some(phrase => pageText.includes(phrase)) &&
                        !pageText.includes('total odds') && !pageText.includes('booking code')

    if (isLoginWall) {
      if (retryAfterLogin && SPORTYBET_EMAIL && SPORTYBET_PASSWORD) {
        // Reset login state and try to log in, then retry
        loggedIn = false
        await page.close()
        await ensureLoggedIn()
        return _fetchSlip(shareCode, false)
      }
      throw new Error(`Login wall detected for ${shareCode} — cannot read slip`)
    }

    const slip = await page.evaluate((code: string) => {
      // ── STATUS DETECTION ────────────────────────────────────────────────────
      let status: 'PENDING' | 'WON' | 'LOST' | 'VOID' = 'PENDING'

      // Strategy 1: look for an element that contains ONLY a status word
      const allElements = Array.from(document.querySelectorAll('*'))
      const statusEl = allElements.find(el => {
        const t = el.textContent?.trim().toUpperCase() ?? ''
        return (t === 'WON' || t === 'LOST' || t === 'VOID' || t === 'WIN' || t === 'LOSE') &&
               (el as HTMLElement).offsetParent !== null
      })

      if (statusEl) {
        const t = statusEl.textContent!.trim().toUpperCase()
        if (t === 'WON' || t === 'WIN')               status = 'WON'
        else if (t === 'LOST' || t === 'LOSE')         status = 'LOST'
        else if (t === 'VOID')                         status = 'VOID'
      }

      // Strategy 2: class names
      if (status === 'PENDING') {
        const wonEl  = document.querySelector('[class*="won"],[class*="win"],[class*="Won"],[class*="Win"]')
        const lostEl = document.querySelector('[class*="lost"],[class*="lose"],[class*="Lost"],[class*="Lose"]')
        const voidEl = document.querySelector('[class*="void"],[class*="Void"],[class*="cancel"],[class*="Cancel"]')
        if (wonEl)       status = 'WON'
        else if (lostEl) status = 'LOST'
        else if (voidEl) status = 'VOID'
      }

      // Strategy 3: data attributes
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

      // Strategy 4: short status lines (last resort)
      if (status === 'PENDING') {
        const lines = document.body.innerText.split('\n').map(l => l.trim()).filter(Boolean)
        for (const line of lines) {
          const upper = line.toUpperCase()
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
      const allText     = document.body.innerText
      const oddsMatches = [...allText.matchAll(/\b(\d+\.\d{2})\b/g)]
        .map(m => parseFloat(m[1]))
        .filter(n => n >= 1.01 && n <= 1000)
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

      return { shareCode: code, teams, selection: selectionLine || teams[0] || 'Unknown', odds, status }
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
    browser  = null
    loggedIn = false
  }
}
