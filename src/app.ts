import express from 'express'
import cors from 'cors'
import clientRoutes from './router/client'
import planRoutes from './router/plam'

export const app = express()

app.use(cors())
app.use(express.json())

app.use('/plan', planRoutes)
app.use('/client', clientRoutes)

app.get('/health', (req, res) => {
    return res.json({ status: 'running' })
})
