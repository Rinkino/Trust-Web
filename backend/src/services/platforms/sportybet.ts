import puppeteer, { type Browser } from 'puppeteer-core'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const SPORTYBET_URL = 'https://www.sportybet.com'

// Path to system Chrome — set CHROME_PATH in .env to override
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
      ],
    })
  }
  return browser
}

async function loginToSportybet(page: Awaited<ReturnType<Browser['newPage']>>): Promise<void> {
  const email    = process.env.SPORTYBET_EMAIL
  const password = process.env.SPORTYBET_PASSWORD

  if (!email || !password) {
    throw new Error('SPORTYBET_EMAIL and SPORTYBET_PASSWORD must be set in .env')
  }

  await page.goto(`${SPORTYBET_URL}/ng`, { waitUntil: 'networkidle2', timeout: 30000 })
  await sleep(2000)

  // Click login button
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, a'))
    const loginBtn = buttons.find(el =>
      el.textContent?.toLowerCase().includes('login') ||
      el.textContent?.toLowerCase().includes('sign in')
    ) as HTMLElement | undefined
    loginBtn?.click()
  })

  await sleep(2000)

  // Fill in credentials
  await page.evaluate((e: string, p: string) => {
    const inputs = Array.from(document.querySelectorAll('input'))
    const emailInput    = inputs.find(i => i.type === 'email' || i.name?.toLowerCase().includes('email') || i.placeholder?.toLowerCase().includes('email'))
    const passwordInput = inputs.find(i => i.type === 'password')
    if (emailInput) {
      emailInput.value = e
      emailInput.dispatchEvent(new Event('input', { bubbles: true }))
    }
    if (passwordInput) {
      passwordInput.value = p
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }, email, password)

  await sleep(500)

  // Submit
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const submitBtn = buttons.find(el =>
      el.textContent?.toLowerCase().includes('login') ||
      el.textContent?.toLowerCase().includes('sign in') ||
      el.type === 'submit'
    ) as HTMLElement | undefined
    submitBtn?.click()
  })

  await sleep(3000)
}

export type SportybetSlip = {
  shareCode: string
  teams:     string[]
  selection: string
  odds:      number
  status:    'PENDING' | 'WON' | 'LOST' | 'VOID'
}

export async function fetchSporbetSlip(shareCode: string): Promise<SportybetSlip> {
  const b    = await getBrowser()
  const page = await b.newPage()

  try {
    // Mask automation fingerprint
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
    })

    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
    )

    const shareUrl = `${SPORTYBET_URL}/?shareCode=${shareCode}&c=ng`
    await page.goto(shareUrl, { waitUntil: 'networkidle2', timeout: 30000 })

    // If page suggests login is required, authenticate first
    const needsLogin = await page.evaluate(() =>
      document.body.innerText.toLowerCase().includes('login') ||
      document.body.innerText.toLowerCase().includes('sign in')
    )

    if (needsLogin) {
      await loginToSportybet(page)
      await page.goto(shareUrl, { waitUntil: 'networkidle2', timeout: 30000 })
    }

    await sleep(3000)

    const slip = await page.evaluate((code: string) => {
      const bodyText = document.body.innerText.toLowerCase()

      // Determine status from page text
      let status: 'PENDING' | 'WON' | 'LOST' | 'VOID' = 'PENDING'
      if (bodyText.includes('won') || bodyText.includes('win'))           status = 'WON'
      else if (bodyText.includes('lost') || bodyText.includes('lose'))    status = 'LOST'
      else if (bodyText.includes('void') || bodyText.includes('cancel'))  status = 'VOID'

      // Extract decimal odds (e.g. 2.50, 1.85)
      const oddsMatch = document.body.innerText.match(/\b(\d+\.\d{2})\b/)
      const odds = oddsMatch ? parseFloat(oddsMatch[1]) : 2.0

      // Extract lines containing team names (vs / v / -)
      const lines     = document.body.innerText.split('\n').map((l: string) => l.trim()).filter(Boolean)
      const teamLines = lines.filter((l: string) =>
        l.includes(' vs ') || l.includes(' v ') || l.includes(' - ')
      )
      const teams = teamLines.length > 0 ? teamLines : [lines[0] || 'Unknown']

      // Best guess at user's selection
      const selectionLine = lines.find((l: string) =>
        l.toLowerCase().includes('home') ||
        l.toLowerCase().includes('away') ||
        l.toLowerCase().includes('draw') ||
        l.toLowerCase().includes('pick') ||
        l.toLowerCase().includes('selection')
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
    browser = null
  }
}
