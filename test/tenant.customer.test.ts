import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const { mockCentralPrisma } = vi.hoisted(() => {
    const mockCentralPrisma = {
        client: {
            findUnique: vi.fn(),
            findFirst: vi.fn()
        }
    }
    return { mockCentralPrisma }
})

vi.mock('../src/shared/database/prisma', () => ({
    prisma: mockCentralPrisma
}))

import { app } from '../src/app'
import { tenantConnectionManager } from '../src/modules/tenant/config/tenant-connection'

describe('Tenant Customer Management & Destination Principle (Task 03)', () => {
    const TENANT_SLUG = 'drogaria-central'
    let mockCustomerStore: any[] = []

    beforeEach(() => {
        process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/vtx_core'
        mockCustomerStore = []

        const findClientMock = async ({ where }: any) => {
            const candidates = where.OR ? where.OR.map((i: any) => i.slug) : [where.slug]
            if (candidates.includes(TENANT_SLUG) || candidates.includes('drogaria_central')) {
                return { id: 1, slug: TENANT_SLUG, socialName: 'Drogaria Central LTDA', status: 'active' }
            }
            return null
        }

        mockCentralPrisma.client.findUnique.mockImplementation(findClientMock)
        mockCentralPrisma.client.findFirst.mockImplementation(findClientMock)

        tenantConnectionManager.setClientFactory(() => {
            return {
                customer: {
                    findUnique: vi.fn(async ({ where }: any) => {
                        if (where.id) return mockCustomerStore.find((c) => c.id === where.id) || null
                        if (where.cpfCnpj) return mockCustomerStore.find((c) => c.cpfCnpj === where.cpfCnpj) || null
                        return null
                    }),
                    count: vi.fn(async () => mockCustomerStore.length),
                    findMany: vi.fn(async ({ skip = 0, take = 20 }: any = {}) => {
                        return mockCustomerStore.slice(skip, skip + take)
                    }),
                    create: vi.fn(async ({ data }: any) => {
                        const newCustomer = {
                            id: mockCustomerStore.length + 1,
                            ...data,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }
                        mockCustomerStore.push(newCustomer)
                        return newCustomer
                    }),
                    update: vi.fn(async ({ where, data }: any) => {
                        const index = mockCustomerStore.findIndex((c) => c.id === where.id)
                        if (index === -1) throw new Error('Not found')
                        Object.assign(mockCustomerStore[index], data, { updatedAt: new Date() })
                        return mockCustomerStore[index]
                    }),
                    delete: vi.fn(async ({ where }: any) => {
                        const index = mockCustomerStore.findIndex((c) => c.id === where.id)
                        if (index === -1) throw new Error('Not found')
                        const deleted = mockCustomerStore.splice(index, 1)[0]
                        return deleted
                    })
                }
            } as any
        })
    })

    const validCustomerPayload = {
        cpfCnpj: '12345678000195',
        name: 'Hospital e Maternidade São Paulo LTDA',
        fantasyName: 'Hospital São Paulo',
        ie: '123456789',
        indicadorIe: 1,
        email: 'fiscal@hospitalsaopaulo.com.br',
        phone: '1133334444',
        street: 'Rua Vergueiro',
        number: '500',
        complement: 'Torre A',
        district: 'Liberdade',
        cityCode: '3550308', // IBGE São Paulo
        cityName: 'São Paulo',
        uf: 'SP',
        zipCode: '01504000'
    }

    it('should create a customer with valid IBGE code and destination address', async () => {
        const response = await request(app)
            .post('/api/tenant/customers')
            .set('X-Tenant-Slug', TENANT_SLUG)
            .send(validCustomerPayload)

        expect(response.status).toBe(201)
        expect(response.body.cpfCnpj).toBe('12345678000195')
        expect(response.body.cityCode).toBe('3550308')
        expect(response.body.uf).toBe('SP')
    })

    it('should create an individual customer with CPF (11 digits)', async () => {
        const cpfCustomer = {
            ...validCustomerPayload,
            cpfCnpj: '12345678901',
            name: 'João da Silva',
            fantasyName: null,
            indicadorIe: 9
        }

        const response = await request(app)
            .post('/api/tenant/customers')
            .set('X-Tenant-Slug', TENANT_SLUG)
            .send(cpfCustomer)

        expect(response.status).toBe(201)
        expect(response.body.cpfCnpj).toBe('12345678901')
    })

    it('should return 409 Conflict when creating customer with duplicated CPF/CNPJ', async () => {
        await request(app)
            .post('/api/tenant/customers')
            .set('X-Tenant-Slug', TENANT_SLUG)
            .send(validCustomerPayload)

        const response = await request(app)
            .post('/api/tenant/customers')
            .set('X-Tenant-Slug', TENANT_SLUG)
            .send(validCustomerPayload)

        expect(response.status).toBe(409)
        expect(response.body.error).toContain('already exists')
    })

    it('should reject customer with invalid IBGE cityCode (not 7 digits)', async () => {
        const response = await request(app)
            .post('/api/tenant/customers')
            .set('X-Tenant-Slug', TENANT_SLUG)
            .send({
                ...validCustomerPayload,
                cityCode: '1234' // Inválido (deve ter 7 dígitos)
            })

        expect(response.status).toBe(400)
        expect(response.body.error).toBe('Validation error')
    })

    it('should reject customer with invalid document length (e.g. 10 digits)', async () => {
        const response = await request(app)
            .post('/api/tenant/customers')
            .set('X-Tenant-Slug', TENANT_SLUG)
            .send({
                ...validCustomerPayload,
                cpfCnpj: '1234567890' // 10 dígitos (inválido)
            })

        expect(response.status).toBe(400)
        expect(response.body.error).toBe('Validation error')
    })

    it('should list customers with pagination', async () => {
        await request(app)
            .post('/api/tenant/customers')
            .set('X-Tenant-Slug', TENANT_SLUG)
            .send(validCustomerPayload)

        const response = await request(app)
            .get('/api/tenant/customers')
            .set('X-Tenant-Slug', TENANT_SLUG)

        expect(response.status).toBe(200)
        expect(response.body.items).toHaveLength(1)
        expect(response.body.pagination.total).toBe(1)
    })

    it('should update customer data with PUT', async () => {
        const created = await request(app)
            .post('/api/tenant/customers')
            .set('X-Tenant-Slug', TENANT_SLUG)
            .send(validCustomerPayload)

        const response = await request(app)
            .put(`/api/tenant/customers/${created.body.id}`)
            .set('X-Tenant-Slug', TENANT_SLUG)
            .send({
                email: 'novo-fiscal@hospitalsaopaulo.com.br',
                number: '600'
            })

        expect(response.status).toBe(200)
        expect(response.body.email).toBe('novo-fiscal@hospitalsaopaulo.com.br')
        expect(response.body.number).toBe('600')
    })

    it('should delete customer with DELETE /:id', async () => {
        const created = await request(app)
            .post('/api/tenant/customers')
            .set('X-Tenant-Slug', TENANT_SLUG)
            .send(validCustomerPayload)

        const deleteResponse = await request(app)
            .delete(`/api/tenant/customers/${created.body.id}`)
            .set('X-Tenant-Slug', TENANT_SLUG)

        expect(deleteResponse.status).toBe(204)

        const getResponse = await request(app)
            .get(`/api/tenant/customers/${created.body.id}`)
            .set('X-Tenant-Slug', TENANT_SLUG)

        expect(getResponse.status).toBe(404)
    })
})