import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

vi.mock('../src/shared/database/prisma', () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
        },
    },
}))

import authRoutes from '../src/modules/auth/auth.routes'
import * as authService from '../src/modules/auth/auth.service'

describe('Auth Rate Limiter (POST /auth/login)', () => {
    let app: express.Express

    beforeEach(() => {
        vi.clearAllMocks()

        app = express()
        app.use(express.json())
        app.use('/auth', authRoutes)
        app.get('/health', (req, res) => res.json({ status: 'ok' }))
    })

    it('deve permitir requisições com credenciais válidas sem bloquear', async () => {
        vi.spyOn(authService, 'authenticate').mockResolvedValue({
            accessToken: 'valid-token',
            user: {
                id: 1,
                name: 'Test User',
                email: 'test@example.com',
                role: 'admin',
            },
        })

        const response = await request(app)
            .post('/auth/login')
            .send({ email: 'test@example.com', password: 'correct_password' })

        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty('accessToken')
    })

    it('deve bloquear após exceder 5 tentativas falhas consecutivas retornando HTTP 429', async () => {
        vi.spyOn(authService, 'authenticate').mockRejectedValue(
            new Error('INVALID_CREDENTIALS')
        )

        // As primeiras 5 tentativas inválidas devem responder 401
        for (let i = 1; i <= 5; i++) {
            const res = await request(app)
                .post('/auth/login')
                .set('X-Forwarded-For', '192.168.1.100')
                .send({ email: 'attacker@example.com', password: 'wrong_password' })

            expect(res.status).toBe(401)
            expect(res.body).toEqual({ error: 'Credenciais inválidas' })
        }

        // A 6ª tentativa consecutiva do mesmo IP deve ser bloqueada pelo rate limit (429)
        const blockedRes = await request(app)
            .post('/auth/login')
            .set('X-Forwarded-For', '192.168.1.100')
            .send({ email: 'attacker@example.com', password: 'wrong_password' })

        expect(blockedRes.status).toBe(429)
        expect(blockedRes.body.error).toContain('Muitas tentativas de login')
        expect(blockedRes.headers).toHaveProperty('retry-after')
    })

    it('não deve aplicar rate limit a outras rotas não relacionadas', async () => {
        const response = await request(app).get('/health')
        expect(response.status).toBe(200)
        expect(response.body).toEqual({ status: 'ok' })
    })
})
