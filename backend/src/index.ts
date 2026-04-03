import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import predictionsRouter from './routes/predictions'
import usersRouter from './routes/users'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'Trust-Web API' }))

app.use('/api/predictions', predictionsRouter)
app.use('/api/users', usersRouter)

app.listen(PORT, () => {
  console.log(`Trust-Web API running on http://localhost:${PORT}`)
})
