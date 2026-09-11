import express from 'express'
import helmet from 'helmet'
import { corsMiddleware } from './shared/config/cors'
import routes from './routes'

export const app = express()

app.set('trust proxy', 1)

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: {
        policy: "cross-origin"
    }
}))
app.use(corsMiddleware);
app.use(express.json())

app.get('/health', (req, res) => {
    return res.json({ status: 'running' })
})

app.use(routes)

