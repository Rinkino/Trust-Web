/**
 * Test script — run with:
 *   npx tsx src/scripts/test-sportybet.ts P5BAH9
 *
 * Dumps raw page text so we can understand the HTML structure and fix parsing.
 */

import puppeteer from 'puppeteer-core'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config()

const CHROME_PATH =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const shareCode = process.argv[2] || 'P5BAH9'

;(async () => {
  console.log(`Testing share code: ${shareCode}`)
  console.log(`Chrome: ${CHROME_PATH}\n`)

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME_PATH,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  })

  const page = await browser.newPage()

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
  })

  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
  )

  // Intercept all network requests to find the underlying API
  const apiCalls: string[] = []
  await page.setRequestInterception(true)
  page.on('request', req => {
    const url = req.url()
    if (url.includes('api') || url.includes('bet') || url.includes('slip') || url.includes('share')) {
      apiCalls.push(`${req.method()} ${url}`)
    }
    req.continue()
  })
  page.on('response', async res => {
    const url = res.url()
    if ((url.includes('api') || url.includes('slip') || url.includes('share')) && res.status() < 400) {
      try {
        const body = await res.text()
        if (body.length < 5000 && (body.includes(shareCode) || body.includes('status') || body.includes('won') || body.includes('lost'))) {
          console.log(`\n*** INTERESTING RESPONSE from ${url}`)
          console.log(body.slice(0, 1000))
        }
      } catch { /* ignore */ }
    }
  })

  const url = `https://www.sportybet.com/?shareCode=${shareCode}&c=ng`
  console.log(`Navigating to: ${url}`)

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

  // Wait a bit for JS to render
  await new Promise(r => setTimeout(r, 3000))

  console.log('\n--- ALL API CALLS INTERCEPTED ---')
  apiCalls.forEach(c => console.log(c))

  const pageText = await page.evaluate(() => document.body.innerText)
  const pageHTML = await page.content()

  // Write outputs
  const outDir = path.join(process.cwd(), 'src/scripts')
  fs.writeFileSync(path.join(outDir, 'sportybet-page-text.txt'), pageText)
  fs.writeFileSync(path.join(outDir, 'sportybet-page.html'), pageHTML)

  console.log('--- PAGE TEXT (first 3000 chars) ---')
  console.log(pageText.slice(0, 3000))
  console.log('\n--- END ---')
  console.log(`\nFull output saved to:`)
  console.log(`  src/scripts/sportybet-page-text.txt`)
  console.log(`  src/scripts/sportybet-page.html`)

  // Quick status check with current logic
  const lower = pageText.toLowerCase()
  console.log('\n--- KEYWORD MATCHES ---')
  console.log('Contains "won":', lower.includes('won'))
  console.log('Contains "win":', lower.includes('win'))
  console.log('Contains "lost":', lower.includes('lost'))
  console.log('Contains "lose":', lower.includes('lose'))
  console.log('Contains "void":', lower.includes('void'))
  console.log('Contains "cancel":', lower.includes('cancel'))
  console.log('Contains "pending":', lower.includes('pending'))
  console.log('Contains "login":', lower.includes('login'))
  console.log('Contains shareCode:', lower.includes(shareCode.toLowerCase()))

  await browser.close()
})().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
