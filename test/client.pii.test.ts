// test/client.pii.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// vi.hoisted garante que a lista exista antes do vi.mock ser processado no topo
const { mockClientList } = vi.hoisted(() => {
    const mockClientList = [
        {
            id: 1,
            socialName: 'Empresa Teste LTDA',
            fantasyName: 'Teste',
            CPF_CNPJ: '12345678000199',
            IE: '123456789',
            IM: '987654321',
            owner: 'João Silva',
            ownerDocument: '12345678900',
            address: 'Rua Teste, 123',
            district: 'Centro',
            complement: 'Sala 1',
            UF: 'PB',
            zipCode: '58000000',
            slug: 'empresa-teste',
            contact: '83900000000',
            email: 'contato@empresateste.com',
            planId: 1,
            status: 'active',
            createdAt: new Date('2025-01-01'),
            plan: { id: 1, name: 'Básico' },
            subscription: { id: 1, amount: 99.9 }
        }
    ]
    return { mockClientList }
})
vi.mock('../src/shared/database/prisma', () => ({
    prisma: {
        client: {
            findMany: vi.fn().mockImplementation(() => Promise.resolve(mockClientList)),
            findUnique: vi.fn().mockImplementation(({ where }: { where: { id: number } }) => {
                return Promise.resolve(mockClientList.find(c => c.id === where.id) || null)
            })
        }
    }
}))
import { getClients, getClient } from '../src/modules/client/client.controller'

describe('Proteção de PII para Role OPERATOR (TASK 02 - Sprint 3)', () => {
    let app: express.Express

    function createTestApp(userRole: 'ADMIN' | 'OPERATOR') {
        const testApp = express()
        testApp.use(express.json())

        // Simula usuário autenticado pelo authMiddleware
        testApp.use((req, _res, next) => {
            ;(req as express.Request & { user: { id: number; role: 'ADMIN' | 'OPERATOR' } }).user = {
                id: 99,
                role: userRole
            }
            next()
        })

        testApp.get('/clients', getClients)
        testApp.get('/clients/:id', getClient)
        return testApp
    }

    describe('Quando autenticado como OPERATOR', () => {
        beforeEach(() => {
            app = createTestApp('OPERATOR')
        })

        it('deve omitir CPF_CNPJ, documentos e dados de endereço em GET /clients', async () => {
            const res = await request(app).get('/clients')

            expect(res.status).toBe(200)
            expect(Array.isArray(res.body)).toBe(true)
            const client = res.body[0]

            // Campos operacionais permitidos
            expect(client.id).toBe(1)
            expect(client.socialName).toBe('Empresa Teste LTDA')
            expect(client.slug).toBe('empresa-teste')
            expect(client.status).toBe('active')

            // PII sensível deve ser omitido
            expect(client.CPF_CNPJ).toBeUndefined()
            expect(client.owner).toBeUndefined()
            expect(client.ownerDocument).toBeUndefined()
            expect(client.IE).toBeUndefined()
            expect(client.IM).toBeUndefined()
            expect(client.address).toBeUndefined()
            expect(client.district).toBeUndefined()
            expect(client.complement).toBeUndefined()
            expect(client.UF).toBeUndefined()
            expect(client.zipCode).toBeUndefined()
        })

        it('deve omitir PII sensível em GET /clients/:id', async () => {
            const res = await request(app).get('/clients/1')

            expect(res.status).toBe(200)
            expect(res.body.id).toBe(1)
            expect(res.body.socialName).toBe('Empresa Teste LTDA')

            expect(res.body.CPF_CNPJ).toBeUndefined()
            expect(res.body.ownerDocument).toBeUndefined()
            expect(res.body.address).toBeUndefined()
        })
    })

    describe('Quando autenticado como ADMIN', () => {
        beforeEach(() => {
            app = createTestApp('ADMIN')
        })

        it('deve retornar o payload completo com dados fiscais em GET /clients', async () => {
            const res = await request(app).get('/clients')

            expect(res.status).toBe(200)
            const client = res.body[0]

            expect(client.CPF_CNPJ).toBe('12345678000199')
            expect(client.owner).toBe('João Silva')
            expect(client.ownerDocument).toBe('12345678900')
            expect(client.address).toBe('Rua Teste, 123')
            expect(client.UF).toBe('PB')
        })

        it('deve retornar o payload completo em GET /clients/:id', async () => {
            const res = await request(app).get('/clients/1')

            expect(res.status).toBe(200)
            expect(res.body.CPF_CNPJ).toBe('12345678000199')
            expect(res.body.ownerDocument).toBe('12345678900')
        })
    })
})