import express from 'express'
import { corsMiddleware } from './shared/config/cors'
import routes from './routes'

export const app = express()

app.use(corsMiddleware)
app.use(express.json())

app.get('/health', (req, res) => {
    return res.json({ status: 'running' })
})

app.use(routes)

