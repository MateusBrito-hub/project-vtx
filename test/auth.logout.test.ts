// test/auth.logout.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-project-vtx-2026'

vi.mock('../src/shared/database/prisma', () => ({ prisma: {} }))

import authRoutes from '../src/modules/auth/auth.routes'
import { authMiddleware } from '../src/shared/auth/auth.middleware'
import { generateAccessToken } from '../src/shared/auth/jwt'
import { clearTokenBlacklist } from '../src/shared/auth/token-blacklist'

describe('Revogação de Tokens e Logout Server-Side (TASK 03 - Sprint 3)', () => {
    let app: express.Express

    beforeEach(() => {
        clearTokenBlacklist()

        app = express()
        app.use(express.json())
        app.use('/auth', authRoutes)

        // Rota protegida de teste para simular uso pós-logout
        app.get('/protected-resource', authMiddleware, (_req, res) => {
            res.status(200).json({ status: 'allowed' })
        })
    })

    it('deve rejeitar POST /auth/logout se nenhum token for informado (401)', async () => {
        const res = await request(app).post('/auth/logout')

        expect(res.status).toBe(401)
        expect(res.body).toEqual({ error: 'Token não informado' })
    })

    it('deve rejeitar POST /auth/logout com cabeçalho malformado (401)', async () => {
        const res = await request(app)
            .post('/auth/logout')
            .set('Authorization', 'TokenInvalido')

        expect(res.status).toBe(401)
        expect(res.body).toEqual({ error: 'Formato de autorização inválido' })
    })

    it('deve realizar logout com sucesso quando informado token válido (200)', async () => {
        const token = generateAccessToken({ sub: 1, role: 'ADMIN' })

        const res = await request(app)
            .post('/auth/logout')
            .set('Authorization', `Bearer ${token}`)

        expect(res.status).toBe(200)
        expect(res.body).toEqual({ message: 'Logout realizado com sucesso' })
    })

    it('deve revogar o token e impedir acessos subsequentes a rotas protegidas (401)', async () => {
        const token = generateAccessToken({ sub: 1, role: 'ADMIN' })

        // 1. Acesso antes do logout deve funcionar
        const resAllowed = await request(app)
            .get('/protected-resource')
            .set('Authorization', `Bearer ${token}`)
        expect(resAllowed.status).toBe(200)

        // 2. Realiza o logout
        const resLogout = await request(app)
            .post('/auth/logout')
            .set('Authorization', `Bearer ${token}`)
        expect(resLogout.status).toBe(200)

        // 3. Tentativa de reuso do mesmo token deve ser rejeitada com "Token revogado"
        const resBlocked = await request(app)
            .get('/protected-resource')
            .set('Authorization', `Bearer ${token}`)
        expect(resBlocked.status).toBe(401)
        expect(resBlocked.body).toEqual({ error: 'Token revogado' })
    })

    it('deve rejeitar logout duplicado com token já revogado (401)', async () => {
        const token = generateAccessToken({ sub: 1, role: 'ADMIN' })

        // Primeiro logout
        await request(app)
            .post('/auth/logout')
            .set('Authorization', `Bearer ${token}`)

        // Segundo logout com o mesmo token
        const resDuplicate = await request(app)
            .post('/auth/logout')
            .set('Authorization', `Bearer ${token}`)

        expect(resDuplicate.status).toBe(401)
        expect(resDuplicate.body).toEqual({ error: 'Token revogado' })
    })
})