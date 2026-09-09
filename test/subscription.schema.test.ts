// test/subscription.schema.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// Mock do Prisma para execução desacoplada
const mockSubscription = {
    id: 1,
    clientId: 10,
    amount: 100.0,
    status: 'active',
    startDate: new Date(),
}

vi.mock('../src/shared/database/prisma', () => ({
    prisma: {
        subscription: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}))

import { updateSubscriptionById } from '../src/modules/subscription/subscription.controller'
import { prisma } from '../src/shared/database/prisma'

describe('Subscription Mass Assignment Protection (TASK 01 - Sprint 2)', () => {
    let app: express.Express

    beforeEach(() => {
        vi.clearAllMocks()
        app = express()
        app.use(express.json())
        app.patch('/subscriptions/:id', updateSubscriptionById)
    })

    it('deve permitir atualizar amount com valor positivo válido', async () => {
        vi.mocked(prisma.subscription.findUnique).mockResolvedValue(mockSubscription as any)
        vi.mocked(prisma.subscription.update).mockResolvedValue({
            ...mockSubscription,
            amount: 250.0,
        } as any)

        const res = await request(app)
            .patch('/subscriptions/1')
            .send({ amount: 250.0 })

        expect(res.status).toBe(200)
        expect(res.body.data.amount).toBe(250.0)
    })

    it('deve rejeitar tentativa de mass assignment com clientId (HTTP 400)', async () => {
        const res = await request(app)
            .patch('/subscriptions/1')
            .send({ amount: 250.0, clientId: 999 })

        expect(res.status).toBe(400)
        expect(res.body.error).toBe('Erro de validação')
        expect(prisma.subscription.update).not.toHaveBeenCalled()
    })

    it('deve rejeitar tentativa de mass assignment com status (HTTP 400)', async () => {
        const res = await request(app)
            .patch('/subscriptions/1')
            .send({ status: 'suspended' })

        expect(res.status).toBe(400)
        expect(prisma.subscription.update).not.toHaveBeenCalled()
    })

    it('deve rejeitar campos arbitrários inexistentes no modelo (HTTP 400)', async () => {
        const res = await request(app)
            .patch('/subscriptions/1')
            .send({ hackField: true })

        expect(res.status).toBe(400)
    })

    it('deve rejeitar payload vazio (HTTP 400)', async () => {
        const res = await request(app)
            .patch('/subscriptions/1')
            .send({})

        expect(res.status).toBe(400)
    })
})