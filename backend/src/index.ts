import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import predictionsRouter from './routes/predictions'
import usersRouter from './routes/users'
import adminRouter from './routes/admin'
import followsRouter from './routes/follows'
import { startResolutionCron, runResolutionCycle } from './services/resolver'

dotenv.config()

export const app = express()
const PORT = process.env.PORT || 3001

app.set('trust proxy', 1)
app.use(cors({ origin: process.env.ALLOWED_ORIGIN ?? false }))
app.use(express.json())

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

// General API — 120 req/min per IP (covers all authenticated browsing)
const general = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' },
})

// Predictions POST — calls ConvertBetCodes + API-Sports at lock time.
// 10 per 10 minutes per IP is generous for real usage.
const lockPrediction = rateLimit({
  windowMs: 10 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many predictions submitted. Try again in a few minutes.' },
})

// Preview endpoint — hits external APIs, keep it tight
const preview = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many preview requests.' },
})

// Search — debounced on the frontend but still limit server-side
const search = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many search requests.' },
})

app.use('/api', general)
app.post('/api/predictions', lockPrediction)
app.use('/api/predictions/preview', preview)
app.use('/api/users/search', search)

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'Trust-Web API' }))

// Called by Vercel Cron or cron-job.org — runs the resolution cycle once
app.post('/api/resolve', async (req, res) => {
  const cronSecret = process.env.CRON_SECRET
  const auth       = req.headers['authorization']
  const xSecret    = req.headers['x-cron-secret']
  if (cronSecret && auth !== `Bearer ${cronSecret}` && xSecret !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    await runResolutionCycle()
    res.json({ ok: true, ran_at: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

app.use('/api/predictions', predictionsRouter)
app.use('/api/users', usersRouter)
app.use('/api/follows', followsRouter)
app.use('/api/x7k2-internal', adminRouter)

if (!process.env.VERCEL) {
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Trust-Web API running on http://0.0.0.0:${PORT}`)
    startResolutionCron()
  })
}
