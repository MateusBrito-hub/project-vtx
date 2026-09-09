// test/error-handling.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// Mock do Prisma para simular erro bruto de banco
vi.mock('../src/shared/database/prisma', () => ({
    prisma: {
        subscription: {
            findMany: vi.fn(),
        },
        plan: {
            findMany: vi.fn(),
        },
    },
}))

import { getSubscriptions } from '../src/modules/subscription/subscription.controller'
import { getPlans } from '../src/modules/plan/plan.controller'
import { prisma } from '../src/shared/database/prisma'

describe('Error Handling & Information Leakage Protection (TASK 02 - Sprint 2)', () => {
    let app: express.Express

    beforeEach(() => {
        vi.clearAllMocks()
        // Suprime logs de erro no console durante os testes
        vi.spyOn(console, 'error').mockImplementation(() => {})

        app = express()
        app.use(express.json())
        app.get('/subscriptions', getSubscriptions)
        app.get('/plans', getPlans)
    })

    it('não deve vazar mensagem técnica do banco em GET /subscriptions (retornar 500 genérico)', async () => {
        const sensitiveDbError = new Error('P2002: Unique constraint failed on table "subscriptions"')
        vi.mocked(prisma.subscription.findMany).mockRejectedValueOnce(sensitiveDbError)

        const res = await request(app).get('/subscriptions')

        expect(res.status).toBe(500)
        expect(res.body.error).toBe('Erro interno do servidor')
        // Garante que o texto técnico do Prisma NÃO está na resposta
        expect(JSON.stringify(res.body)).not.toContain('P2002')
        expect(JSON.stringify(res.body)).not.toContain('subscriptions')
    })

    it('não deve vazar mensagem técnica do banco em GET /plans (retornar 500 genérico)', async () => {
        const sensitiveDbError = new Error('Connection lost to postgres:5432')
        vi.mocked(prisma.plan.findMany).mockRejectedValueOnce(sensitiveDbError)

        const res = await request(app).get('/plans')

        expect(res.status).toBe(500)
        expect(res.body.error).toBe('Erro interno do servidor')
        expect(JSON.stringify(res.body)).not.toContain('postgres:5432')
    })
})