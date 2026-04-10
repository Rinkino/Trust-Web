import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import predictionsRouter from './routes/predictions'
import usersRouter from './routes/users'
import adminRouter from './routes/admin'
import { startResolutionCron } from './services/resolver'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: true }))
app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'Trust-Web API' }))

app.use('/api/predictions', predictionsRouter)
app.use('/api/users', usersRouter)
app.use('/api/x7k2-internal', adminRouter)

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Trust-Web API running on http://0.0.0.0:${PORT}`)
  startResolutionCron()
})
