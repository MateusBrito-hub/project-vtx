import express from 'express'
import cors from 'cors'
import routes from './routes'

export const app = express()

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];

app.use(cors({
    origin: (origin, callback) => {
        // Permite requisições sem origem (como ferramentas de linha de comando) ou origens listadas
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json())

app.use(routes)

app.get('/health', (req, res) => {
    return res.json({ status: 'running' })
})
