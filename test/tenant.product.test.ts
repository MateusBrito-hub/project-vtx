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

describe('Tenant Product Management & Tax Reform Classification (Task 02)', () => {
    const TENANT_SLUG = 'loja-materiais'
    let mockProductStore: any[] = []

    beforeEach(() => {
        process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/vtx_core'
        mockProductStore = []

        const findClientMock = async ({ where }: any) => {
            const candidates = where.OR ? where.OR.map((i: any) => i.slug) : [where.slug]
            if (candidates.includes(TENANT_SLUG) || candidates.includes('loja_materiais')) {
                return { id: 1, slug: TENANT_SLUG, socialName: 'Loja Materiais LTDA', status: 'active' }
            }
            return null
        }

        mockCentralPrisma.client.findUnique.mockImplementation(findClientMock)
        mockCentralPrisma.client.findFirst.mockImplementation(findClientMock)

        tenantConnectionManager.setClientFactory(() => {
            return {
                product: {
                    findUnique: vi.fn(async ({ where }: any) => {
                        if (where.id) return mockProductStore.find((p) => p.id === where.id) || null
                        if (where.sku) return mockProductStore.find((p) => p.sku === where.sku) || null
                        return null
                    }),
                    count: vi.fn(async () => mockProductStore.length),
                    findMany: vi.fn(async ({ skip = 0, take = 20 }: any = {}) => {
                        return mockProductStore.slice(skip, skip + take)
                    }),
                    create: vi.fn(async ({ data }: any) => {
                        const newProduct = {
                            id: mockProductStore.length + 1,
                            ...data,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }
                        mockProductStore.push(newProduct)
                        return newProduct
                    }),
                    update: vi.fn(async ({ where, data }: any) => {
                        const index = mockProductStore.findIndex((p) => p.id === where.id)
                        if (index === -1) throw new Error('Not found')
                        Object.assign(mockProductStore[index], data, { updatedAt: new Date() })
                        return mockProductStore[index]
                    }),
                    delete: vi.fn(async ({ where }: any) => {
                        const index = mockProductStore.findIndex((p) => p.id === where.id)
                        if (index === -1) throw new Error('Not found')
                        const deleted = mockProductStore.splice(index, 1)[0]
                        return deleted
                    })
                }
            } as any
        })
    })

    const validProductPayload = {
        sku: 'MED-001',
        description: 'Dipirona Monoidratada 500mg',
        ncm: '30049099',
        cest: '1300100',
        unit: 'CX',
        price: 15.50,
        taxReformClass: 'REDUZIDA_60',
        cfopDefault: '5102'
    }

    it('should create a new product with valid Tax Reform classification', async () => {
        const response = await request(app)
            .post('/api/tenant/products')
            .set('X-Tenant-Slug', TENANT_SLUG)
            .send(validProductPayload)

        expect(response.status).toBe(201)
        expect(response.body.sku).toBe('MED-001')
        expect(response.body.taxReformClass).toBe('REDUZIDA_60')
        expect(response.body.ncm).toBe('30049099')
    })

    it('should return 409 Conflict when creating product with duplicated SKU', async () => {
        await request(app)
            .post('/api/tenant/products')
            .set('X-Tenant-Slug', TENANT_SLUG)
            .send(validProductPayload)

        const response = await request(app)
            .post('/api/tenant/products')
            .set('X-Tenant-Slug', TENANT_SLUG)
            .send(validProductPayload)

        expect(response.status).toBe(409)
        expect(response.body.error).toContain('already exists')
    })

    it('should reject product creation with invalid NCM (must be 8 digits)', async () => {
        const response = await request(app)
            .post('/api/tenant/products')
            .set('X-Tenant-Slug', TENANT_SLUG)
            .send({
                ...validProductPayload,
                sku: 'INV-NCM',
                ncm: '123' // Inválido
            })

        expect(response.status).toBe(400)
        expect(response.body.error).toBe('Validation error')
    })

    it('should list products with pagination metadata', async () => {
        await request(app)
            .post('/api/tenant/products')
            .set('X-Tenant-Slug', TENANT_SLUG)
            .send(validProductPayload)

        const response = await request(app)
            .get('/api/tenant/products')
            .set('X-Tenant-Slug', TENANT_SLUG)

        expect(response.status).toBe(200)
        expect(response.body.items).toHaveLength(1)
        expect(response.body.pagination.total).toBe(1)
    })

    it('should retrieve a product by ID', async () => {
        const created = await request(app)
            .post('/api/tenant/products')
            .set('X-Tenant-Slug', TENANT_SLUG)
            .send(validProductPayload)

        const response = await request(app)
            .get(`/api/tenant/products/${created.body.id}`)
            .set('X-Tenant-Slug', TENANT_SLUG)

        expect(response.status).toBe(200)
        expect(response.body.id).toBe(created.body.id)
        expect(response.body.description).toBe('Dipirona Monoidratada 500mg')
    })

    it('should update an existing product with PUT', async () => {
        const created = await request(app)
            .post('/api/tenant/products')
            .set('X-Tenant-Slug', TENANT_SLUG)
            .send(validProductPayload)

        const response = await request(app)
            .put(`/api/tenant/products/${created.body.id}`)
            .set('X-Tenant-Slug', TENANT_SLUG)
            .send({
                price: 18.90,
                taxReformClass: 'CESTA_BASICA_ISENTA'
            })

        expect(response.status).toBe(200)
        expect(response.body.price).toBe(18.90)
        expect(response.body.taxReformClass).toBe('CESTA_BASICA_ISENTA')
    })

    it('should delete a product with DELETE /:id', async () => {
        const created = await request(app)
            .post('/api/tenant/products')
            .set('X-Tenant-Slug', TENANT_SLUG)
            .send(validProductPayload)

        const deleteResponse = await request(app)
            .delete(`/api/tenant/products/${created.body.id}`)
            .set('X-Tenant-Slug', TENANT_SLUG)

        expect(deleteResponse.status).toBe(204)

        const getResponse = await request(app)
            .get(`/api/tenant/products/${created.body.id}`)
            .set('X-Tenant-Slug', TENANT_SLUG)

        expect(getResponse.status).toBe(404)
    })
})