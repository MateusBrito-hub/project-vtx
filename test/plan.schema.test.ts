// test/plan.schema.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

vi.mock('../src/shared/database/prisma', () => ({
    prisma: {
        plan: {
            create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data, status: 'active' })),
            findUnique: vi.fn().mockResolvedValue({ id: 1, name: 'Plano Antigo', price: 50, maxDocs: 100 }),
            update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, name: 'Plano Antigo', price: 50, maxDocs: 100, ...data }))
        },
        $transaction: vi.fn().mockImplementation(async (callback) => callback({
            plan: {
                findUnique: vi.fn().mockResolvedValue({ id: 1, name: 'Plano Básico', price: 99.9, maxDocs: 100 })
            }
        }))
    }
}))

import { registerPlan, updatePlanById } from '../src/modules/plan/plan.controller'

describe('Plan Zod Validation & Mass Assignment Protection (TASK 01 - Sprint 4)', () => {
    let app: express.Express

    beforeEach(() => {
        vi.clearAllMocks()
        app = express()
        app.use(express.json())
        app.post('/plans', registerPlan)
        app.patch('/plans/:id', updatePlanById)
    })

    describe('POST /plans (Criação de Planos)', () => {
        it('deve criar plano com sucesso quando os dados forem estritamente válidos (201)', async () => {
            const validPayload = {
                name: 'Plano Pro 2026',
                price: 199.90,
                maxDocs: 1000
            }

            const res = await request(app).post('/plans').send(validPayload)

            expect(res.status).toBe(201)
            expect(res.body.message).toBe('Plan criado com sucesso')
        })

        it('deve rejeitar com HTTP 400 tentativa de Mass Assignment com campos não autorizados', async () => {
            const maliciousPayload = {
                name: 'Plano Malicioso',
                price: 10,
                maxDocs: 50,
                status: 'suspended',
                id: 999,
                injectedField: 'hack'
            }

            const res = await request(app).post('/plans').send(maliciousPayload)

            expect(res.status).toBe(400)
            expect(res.body).toHaveProperty('error')
        })

        it('deve rejeitar com HTTP 400 quando campos obrigatórios estiverem ausentes', async () => {
            const incompletePayload = {
                name: 'Plano Sem Preço'
            }

            const res = await request(app).post('/plans').send(incompletePayload)

            expect(res.status).toBe(400)
        })
    })

    describe('PATCH /plans/:id (Atualização de Planos)', () => {
        it('deve atualizar parcialmente com sucesso quando informado campo válido (200)', async () => {
            const updatePayload = {
                price: 249.90
            }

            const res = await request(app).patch('/plans/1').send(updatePayload)

            expect(res.status).toBe(200)
        })

        it('deve rejeitar com HTTP 400 tentativa de alterar campos não permitidos', async () => {
            const invalidUpdate = {
                status: 'suspended',
                extraProperty: 'forbidden'
            }

            const res = await request(app).patch('/plans/1').send(invalidUpdate)

            expect(res.status).toBe(400)
        })

        it('deve rejeitar com HTTP 400 body vazio em atualização', async () => {
            const res = await request(app).patch('/plans/1').send({})

            expect(res.status).toBe(400)
        })
    })
})