import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import forge from 'node-forge'

// Mock do prisma central para o middleware de tenant
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

describe('Tenant HTTP Routes & Subdomain Resolution (Task 04)', () => {
  const ACTIVE_SLUG = 'drogaria-central'
  const INACTIVE_SLUG = 'drogaria-bloqueada'

  // Banco em memória simulado para o tenant dedicado
  let mockCompanyStore: any[] = []
  let mockFiscalConfigStore: any[] = []

  // Helper para gerar PFX válido em memória
  function generateTestPfx(commonName: string, password: string): string {
    const pki = forge.pki
    const keys = pki.rsa.generateKeyPair(1024)
    const cert = pki.createCertificate()
    cert.publicKey = keys.publicKey
    cert.serialNumber = '10001'
    cert.validity.notBefore = new Date()
    cert.validity.notAfter = new Date()
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1)

    const attrs = [{ name: 'commonName', value: commonName }]
    cert.setSubject(attrs)
    cert.setIssuer(attrs)
    cert.sign(keys.privateKey)

    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password)
    const p12Der = forge.asn1.toDer(p12Asn1).getBytes()
    return forge.util.encode64(p12Der)
  }

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/vtx_core'
    mockCompanyStore = []
    mockFiscalConfigStore = []

    // Mock das respostas do banco central (VTX Core)
    const findClientMock = async ({ where }: any) => {
      const candidates = where.OR
        ? where.OR.map((item: any) => item.slug)
        : [where.slug]

      if (candidates.includes(ACTIVE_SLUG) || candidates.includes('drogaria_central')) {
        return { id: 1, slug: ACTIVE_SLUG, socialName: 'Drogaria Central LTDA', status: 'active' }
      }
      if (candidates.includes(INACTIVE_SLUG) || candidates.includes('drogaria_bloqueada')) {
        return { id: 2, slug: INACTIVE_SLUG, socialName: 'Drogaria Bloqueada LTDA', status: 'suspended' }
      }
      return null
    }

    mockCentralPrisma.client.findUnique.mockImplementation(findClientMock)
    mockCentralPrisma.client.findFirst.mockImplementation(findClientMock)

    // Configura o client factory do tenant para utilizar o mock em memória do tenant
    tenantConnectionManager.setClientFactory(() => {
      return {
        company: {
          findFirst: vi.fn(async ({ where }: any = {}) => {
            if (where?.isHeadquarter) {
              return mockCompanyStore.find((c) => c.isHeadquarter) || null
            }
            return mockCompanyStore[0] || null
          }),
          findUnique: vi.fn(async ({ where }: any) => {
            if (where.id) return mockCompanyStore.find((c) => c.id === where.id) || null
            if (where.cnpj) return mockCompanyStore.find((c) => c.cnpj === where.cnpj) || null
            return null
          }),
          findMany: vi.fn(async () => {
            return mockCompanyStore.map((c) => ({
              ...c,
              fiscalConfig: mockFiscalConfigStore.find((fc) => fc.companyId === c.id) || null
            }))
          }),
          create: vi.fn(async ({ data }: any) => {
            const id = mockCompanyStore.length + 1
            const newCompany = {
              id,
              cnpj: data.cnpj,
              socialName: data.socialName,
              fantasyName: data.fantasyName,
              street: data.street,
              number: data.number,
              complement: data.complement || null,
              district: data.district,
              cityCode: data.cityCode,
              cityName: data.cityName,
              uf: data.uf,
              zipCode: data.zipCode,
              ie: data.ie || null,
              im: data.im || null,
              phone: data.phone || null,
              isHeadquarter: data.isHeadquarter ?? false,
              createdAt: new Date(),
              updatedAt: new Date()
            }
            mockCompanyStore.push(newCompany)

            if (data.fiscalConfig?.create) {
              mockFiscalConfigStore.push({
                id: mockFiscalConfigStore.length + 1,
                companyId: id,
                ...data.fiscalConfig.create,
                createdAt: new Date(),
                updatedAt: new Date()
              })
            }

            return newCompany
          })
        },
        fiscalConfig: {
          findUnique: vi.fn(async ({ where }: any) => {
            return mockFiscalConfigStore.find((fc) => fc.companyId === where.companyId) || null
          }),
          create: vi.fn(async ({ data }: any) => {
            const newConfig = {
              id: mockFiscalConfigStore.length + 1,
              ...data,
              createdAt: new Date(),
              updatedAt: new Date()
            }
            mockFiscalConfigStore.push(newConfig)
            return newConfig
          }),
          upsert: vi.fn(async ({ where, update, create }: any) => {
            let existing = mockFiscalConfigStore.find((fc) => fc.companyId === where.companyId)
            if (existing) {
              Object.assign(existing, update, { updatedAt: new Date() })
              return existing
            }
            const newConfig = {
              id: mockFiscalConfigStore.length + 1,
              ...create,
              createdAt: new Date(),
              updatedAt: new Date()
            }
            mockFiscalConfigStore.push(newConfig)
            return newConfig
          })
        }
      } as any
    })
  })

  describe('Subdomain & Header Resolution Middleware', () => {
    it('should return 400 when no tenant identifier is provided in request', async () => {
      const response = await request(app).get('/api/tenant/companies')
      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Tenant identifier not provided')
    })

    it('should return 404 when tenant does not exist in central core', async () => {
      const response = await request(app)
        .get('/api/tenant/companies')
        .set('X-Tenant-Slug', 'inexistent-slug')

      expect(response.status).toBe(404)
      expect(response.body.error).toContain('not found')
    })

    it('should return 403 when tenant is suspended or inactive', async () => {
      const response = await request(app)
        .get('/api/tenant/companies')
        .set('X-Tenant-Slug', INACTIVE_SLUG)

      expect(response.status).toBe(403)
      expect(response.body.error).toContain('Access denied')
    })

    it('should resolve tenant via Subdomain (Host header)', async () => {
      const response = await request(app)
        .get('/api/tenant/companies')
        .set('Host', `${ACTIVE_SLUG}.vtx.com.br`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
    })
  })

  describe('Company Management (Multi-Branch)', () => {
    const validCompanyPayload = {
      cnpj: '12345678000195',
      socialName: 'Drogaria Central Matriz LTDA',
      fantasyName: 'Drogaria Central',
      street: 'Av. Paulista',
      number: '1000',
      district: 'Bela Vista',
      cityCode: '3550308',
      cityName: 'São Paulo',
      uf: 'SP',
      zipCode: '01310100',
      isHeadquarter: true
    }

    it('should create a new company branch with 201 status', async () => {
      const response = await request(app)
        .post('/api/tenant/companies')
        .set('X-Tenant-Slug', ACTIVE_SLUG)
        .send(validCompanyPayload)

      expect(response.status).toBe(201)
      expect(response.body.cnpj).toBe('12345678000195')
      expect(response.body.socialName).toBe('Drogaria Central Matriz LTDA')
    })

    it('should reject company creation with invalid CNPJ or missing fields (Zod strict)', async () => {
      const invalidPayload = {
        ...validCompanyPayload,
        cnpj: '123', // menos de 14 dígitos
        unexpectedField: 'MassAssignmentAttempt'
      }

      const response = await request(app)
        .post('/api/tenant/companies')
        .set('X-Tenant-Slug', ACTIVE_SLUG)
        .send(invalidPayload)

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Validation error')
    })

    it('should list registered branches with GET /api/tenant/companies', async () => {
      // Cria a empresa
      await request(app)
        .post('/api/tenant/companies')
        .set('X-Tenant-Slug', ACTIVE_SLUG)
        .send(validCompanyPayload)

      const response = await request(app)
        .get('/api/tenant/companies')
        .set('X-Tenant-Slug', ACTIVE_SLUG)

      expect(response.status).toBe(200)
      expect(response.body).toHaveLength(1)
      expect(response.body[0].cnpj).toBe('12345678000195')
    })
  })

  describe('Fiscal Configuration & Tax Reform Endpoints', () => {
    beforeEach(async () => {
      // Pré-cadastra matriz
      await request(app)
        .post('/api/tenant/companies')
        .set('X-Tenant-Slug', ACTIVE_SLUG)
        .send({
          cnpj: '12345678000195',
          socialName: 'Matriz Fiscal LTDA',
          fantasyName: 'Matriz',
          street: 'Rua das Flores',
          number: '50',
          district: 'Centro',
          cityCode: '3550308',
          cityName: 'São Paulo',
          uf: 'SP',
          zipCode: '01001000',
          isHeadquarter: true
        })
    })

    it('should retrieve fiscal configuration with GET /api/tenant/fiscal/config', async () => {
      const response = await request(app)
        .get('/api/tenant/fiscal/config')
        .set('X-Tenant-Slug', ACTIVE_SLUG)

      expect(response.status).toBe(200)
      expect(response.body.environment).toBe('HOMOLOGATION')
      expect(response.body.enableTaxReform).toBe(true)
      expect(response.body.nfeSeries).toBe(1)
      expect(response.body.hasCertificate).toBe(false)
    })

    it('should update fiscal parameters with PUT /api/tenant/fiscal/config', async () => {
      const updatePayload = {
        environment: 'PRODUCTION',
        taxRegime: 'REGIME_NORMAL',
        nfeSeries: 10,
        nfeNextNumber: 500,
        enableTaxReform: true
      }

      const response = await request(app)
        .put('/api/tenant/fiscal/config')
        .set('X-Tenant-Slug', ACTIVE_SLUG)
        .send(updatePayload)

      expect(response.status).toBe(200)
      expect(response.body.environment).toBe('PRODUCTION')
      expect(response.body.taxRegime).toBe('REGIME_NORMAL')
      expect(response.body.nfeSeries).toBe(10)
      expect(response.body.nfeNextNumber).toBe(500)
    })
  })

  describe('A1 Certificate Ingestion & Status Endpoints', () => {
    const CERT_PASSWORD = 'StrongPassword!2026'

    beforeEach(async () => {
      // Pré-cadastra matriz
      await request(app)
        .post('/api/tenant/companies')
        .set('X-Tenant-Slug', ACTIVE_SLUG)
        .send({
          cnpj: '12345678000195',
          socialName: 'Farmacia Modelo LTDA',
          fantasyName: 'Farmacia Modelo',
          street: 'Av. Brasil',
          number: '100',
          district: 'Centro',
          cityCode: '3550308',
          cityName: 'São Paulo',
          uf: 'SP',
          zipCode: '01001000',
          isHeadquarter: true
        })
    })

    it('should upload, validate, encrypt and register A1 certificate', async () => {
      const certBase64 = generateTestPfx('FARMACIA MODELO LTDA:12345678000195', CERT_PASSWORD)

      const response = await request(app)
        .post('/api/tenant/fiscal/certificate')
        .set('X-Tenant-Slug', ACTIVE_SLUG)
        .send({
          certificateBase64: certBase64,
          password: CERT_PASSWORD
        })

      expect(response.status).toBe(200)
      expect(response.body.message).toContain('successfully installed and encrypted')
      expect(response.body.certificateCnpj).toBe('12345678000195')
      expect(response.body.daysUntilExpiration).toBeGreaterThan(0)
    })

    it('should reject certificate upload when password is wrong', async () => {
      const certBase64 = generateTestPfx('FARMACIA MODELO LTDA:12345678000195', CERT_PASSWORD)

      const response = await request(app)
        .post('/api/tenant/fiscal/certificate')
        .set('X-Tenant-Slug', ACTIVE_SLUG)
        .send({
          certificateBase64: certBase64,
          password: 'IncorrectPassword'
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Failed to decrypt PKCS#12')
    })

    it('should report certificate status without exposing private keys', async () => {
      const certBase64 = generateTestPfx('FARMACIA MODELO LTDA:12345678000195', CERT_PASSWORD)

      // 1. Upload do certificado
      await request(app)
        .post('/api/tenant/fiscal/certificate')
        .set('X-Tenant-Slug', ACTIVE_SLUG)
        .send({
          certificateBase64: certBase64,
          password: CERT_PASSWORD
        })

      // 2. Consulta de status
      const response = await request(app)
        .get('/api/tenant/fiscal/certificate/status')
        .set('X-Tenant-Slug', ACTIVE_SLUG)

      expect(response.status).toBe(200)
      expect(response.body.hasCertificate).toBe(true)
      expect(response.body.certificateCnpj).toBe('12345678000195')
      expect(response.body.isExpired).toBe(false)
      expect(response.body.daysUntilExpiration).toBeGreaterThan(0)
      // Confirma que chaves e senhas não foram expostas
      expect(response.body.password).toBeUndefined()
      expect(response.body.privateKey).toBeUndefined()
    })
  })
})
