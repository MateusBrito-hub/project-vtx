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
import { quotaService } from '../src/modules/tenant/fiscal/quota.service'

describe('Tenant Fiscal Quota Validator (Task 04)', () => {
    const ACTIVE_SLUG = 'drogaria-central'
    let mockAuthorizedCount = 0

    beforeEach(() => {
        process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/vtx_core'
        mockAuthorizedCount = 0

        // Configuração do mock central com plano de 100 documentos
        mockCentralPrisma.client.findUnique.mockImplementation(async ({ where }: any) => {
            if (where.slug === ACTIVE_SLUG || where.slug === 'drogaria_central') {
                return {
                    id: 1,
                    slug: ACTIVE_SLUG,
                    socialName: 'Drogaria Central LTDA',
                    status: 'active',
                    plan: {
                        id: 10,
                        name: 'Plano Pro 100',
                        maxDocs: 100
                    },
                    subscription: {
                        id: 20,
                        status: 'active'
                    }
                }
            }
            return null
        })

        mockCentralPrisma.client.findFirst.mockImplementation(async ({ where }: any) => {
            const candidates = where.OR ? where.OR.map((i: any) => i.slug) : [where.slug]
            if (candidates.includes(ACTIVE_SLUG) || candidates.includes('drogaria_central')) {
                return { id: 1, slug: ACTIVE_SLUG, socialName: 'Drogaria Central LTDA', status: 'active' }
            }
            return null
        })

        // Configuração do mock do banco dedicado
        tenantConnectionManager.setClientFactory(() => {
            return {
                fiscalDocument: {
                    count: vi.fn(async () => mockAuthorizedCount)
                }
            } as any
        })
    })

    it('should allow emission when usedDocs is strictly less than maxDocs', async () => {
        mockAuthorizedCount = 25 // 25 de 100

        const mockTenantPrisma = tenantConnectionManager.getTenantPrisma(ACTIVE_SLUG)
        const result = await quotaService.checkEmissionQuota(ACTIVE_SLUG, mockTenantPrisma)

        expect(result.allowed).toBe(true)
        expect(result.maxDocs).toBe(100)
        expect(result.usedDocs).toBe(25)
        expect(result.remainingDocs).toBe(75)
        expect(result.planName).toBe('Plano Pro 100')
        expect(result.reason).toBeUndefined()
    })

    it('should block emission when usedDocs reaches maxDocs limit', async () => {
        mockAuthorizedCount = 100 // Limite atingido

        const mockTenantPrisma = tenantConnectionManager.getTenantPrisma(ACTIVE_SLUG)
        const result = await quotaService.checkEmissionQuota(ACTIVE_SLUG, mockTenantPrisma)

        expect(result.allowed).toBe(false)
        expect(result.usedDocs).toBe(100)
        expect(result.remainingDocs).toBe(0)
        expect(result.reason).toBe('QUOTA_EXCEEDED')
    })

    it('should throw QUOTA_EXCEEDED error in assertEmissionQuota when quota is exhausted', async () => {
        mockAuthorizedCount = 105 // Limite estourado

        const mockTenantPrisma = tenantConnectionManager.getTenantPrisma(ACTIVE_SLUG)
        await expect(quotaService.assertEmissionQuota(ACTIVE_SLUG, mockTenantPrisma)).rejects.toThrow(
            'Monthly fiscal emission limit reached'
        )
    })

    it('should block emission if subscription is not active in central core', async () => {
        mockCentralPrisma.client.findUnique.mockImplementationOnce(async () => {
            return {
                id: 1,
                slug: ACTIVE_SLUG,
                status: 'active',
                plan: { id: 10, name: 'Plano Pro 100', maxDocs: 100 },
                subscription: { id: 20, status: 'suspended' } // Suspenso!
            }
        })

        const mockTenantPrisma = tenantConnectionManager.getTenantPrisma(ACTIVE_SLUG)
        const result = await quotaService.checkEmissionQuota(ACTIVE_SLUG, mockTenantPrisma)

        expect(result.allowed).toBe(false)
        expect(result.reason).toBe('INACTIVE_SUBSCRIPTION')
    })

    it('should expose quota endpoint with GET /api/tenant/fiscal/quota', async () => {
        mockAuthorizedCount = 42

        const response = await request(app)
            .get('/api/tenant/fiscal/quota')
            .set('X-Tenant-Slug', ACTIVE_SLUG)

        expect(response.status).toBe(200)
        expect(response.body.allowed).toBe(true)
        expect(response.body.maxDocs).toBe(100)
        expect(response.body.usedDocs).toBe(42)
        expect(response.body.remainingDocs).toBe(58)
        expect(response.body.planName).toBe('Plano Pro 100')
    })
})