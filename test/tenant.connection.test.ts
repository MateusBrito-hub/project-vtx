import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  sanitizeTenantSlug,
  getTenantDatabaseName,
  getTenantConnectionString,
  TenantConnectionManager
} from '../src/modules/tenant/config/tenant-connection'

describe('Tenant Connection & Router (Task 01)', () => {
  const BASE_DATABASE_URL = 'postgresql://vtx_user:secret123@localhost:5432/vtx_core?schema=public&sslmode=prefer'

  describe('sanitizeTenantSlug', () => {
    it('should normalize valid slug with hyphens to lowercase underscores', () => {
      expect(sanitizeTenantSlug('Empresa-Alpha')).toBe('empresa_alpha')
      expect(sanitizeTenantSlug('loja_matriz')).toBe('loja_matriz')
      expect(sanitizeTenantSlug('Filial01')).toBe('filial01')
    })

    it('should remove accents and invalid characters', () => {
      expect(sanitizeTenantSlug('Farmácia-São-João')).toBe('farmacia_sao_joao')
      expect(sanitizeTenantSlug('Super@Mercado#123')).toBe('supermercado123')
    })

    it('should reject empty or whitespace-only slugs', () => {
      expect(() => sanitizeTenantSlug('')).toThrow('Tenant slug must be a non-empty string')
      expect(() => sanitizeTenantSlug('   ')).toThrow('Invalid tenant slug')
      expect(() => sanitizeTenantSlug(null as any)).toThrow('Tenant slug must be a non-empty string')
    })

    it('should reject slugs containing only invalid characters', () => {
      expect(() => sanitizeTenantSlug('!@#$%&*')).toThrow('Invalid tenant slug')
    })

    it('should reject slugs exceeding 50 characters', () => {
      const overlyLongSlug = 'a'.repeat(51)
      expect(() => sanitizeTenantSlug(overlyLongSlug)).toThrow('exceeds maximum allowed length')
    })
  })

  describe('getTenantDatabaseName', () => {
    it('should format database name as vtx_<slug>', () => {
      expect(getTenantDatabaseName('loja-centro')).toBe('vtx_loja_centro')
      expect(getTenantDatabaseName('cliente123')).toBe('vtx_cliente123')
    })

    it('should truncate database name to 63 characters max (PostgreSQL limit)', () => {
      const longSlug = 'a'.repeat(50) // 'vtx_' + 50 = 54 chars <= 63
      const dbName = getTenantDatabaseName(longSlug)
      expect(dbName.length).toBeLessThanOrEqual(63)
      expect(dbName.startsWith('vtx_')).toBe(true)
    })
  })

  describe('getTenantConnectionString', () => {
    it('should replace base database name with dedicated tenant database name', () => {
      const connStr = getTenantConnectionString('empresa-beta', BASE_DATABASE_URL)
      expect(connStr).toBe('postgresql://vtx_user:secret123@localhost:5432/vtx_empresa_beta?schema=public&sslmode=prefer')
    })

    it('should preserve authentication credentials, port, host and query params', () => {
      const complexUrl = 'postgresql://admin:P%40ssw0rd!@pg-cluster.internal:5433/vtx_core?schema=custom&connect_timeout=10'
      const connStr = getTenantConnectionString('matriz', complexUrl)
      expect(connStr).toContain('admin:P%40ssw0rd!@pg-cluster.internal:5433')
      expect(connStr).toContain('/vtx_matriz')
      expect(connStr).toContain('schema=custom&connect_timeout=10')
    })

    it('should throw an error if DATABASE_URL is not provided and env is empty', () => {
      const originalEnv = process.env.DATABASE_URL
      delete process.env.DATABASE_URL
      try {
        expect(() => getTenantConnectionString('empresa-a')).toThrow('DATABASE_URL environment variable is not defined')
      } finally {
        process.env.DATABASE_URL = originalEnv
      }
    })
  })

  describe('TenantConnectionManager (Cache, Isolation & Lifecycle)', () => {
    let manager: TenantConnectionManager
    let mockClients: Map<string, any>

    beforeEach(() => {
      mockClients = new Map()
      // Cria manager com factory mockada para isolar testes sem necessidade de PostgreSQL ativo
      manager = new TenantConnectionManager(
        {
          maxPoolSize: 2,
          idleTimeoutMillis: 1000,
          connectionTimeoutMillis: 500
        },
        (adapter, connectionString) => {
          const clientInstance = {
            id: Math.random(),
            connectionString,
            $connect: vi.fn(),
            $disconnect: vi.fn()
          }
          return clientInstance
        }
      )
    })

    afterEach(async () => {
      await manager.closeAllTenantConnections()
    })

    it('should instantiate and return a client for a new tenant', () => {
      const client = manager.getTenantPrisma('tenant-alpha', BASE_DATABASE_URL)
      expect(client).toBeDefined()
      expect(client.connectionString).toContain('/vtx_tenant_alpha')
      expect(manager.hasTenantConnection('tenant-alpha')).toBe(true)
    })

    it('should return cached client on subsequent calls for the same tenant (Cache Hit)', () => {
      const clientFirstCall = manager.getTenantPrisma('tenant-alpha', BASE_DATABASE_URL)
      const clientSecondCall = manager.getTenantPrisma('tenant-alpha', BASE_DATABASE_URL)

      expect(clientSecondCall).toBe(clientFirstCall)
      expect(clientSecondCall.id).toBe(clientFirstCall.id)

      const metrics = manager.getMetrics()
      expect(metrics.activeConnections).toBe(1)
      expect(metrics.cachedTenants).toEqual(['tenant_alpha'])
    })

    it('should maintain strict database isolation between different tenants', () => {
      const clientA = manager.getTenantPrisma('tenant-a', BASE_DATABASE_URL)
      const clientB = manager.getTenantPrisma('tenant-b', BASE_DATABASE_URL)

      expect(clientA).not.toBe(clientB)
      expect(clientA.connectionString).toContain('/vtx_tenant_a')
      expect(clientB.connectionString).toContain('/vtx_tenant_b')

      const metrics = manager.getMetrics()
      expect(metrics.activeConnections).toBe(2)
      expect(metrics.cachedTenants).toContain('tenant_a')
      expect(metrics.cachedTenants).toContain('tenant_b')
    })

    it('should accurately close and remove a single tenant connection', async () => {
      manager.getTenantPrisma('tenant-to-close', BASE_DATABASE_URL)
      expect(manager.hasTenantConnection('tenant-to-close')).toBe(true)

      await manager.closeTenantConnection('tenant-to-close')
      expect(manager.hasTenantConnection('tenant-to-close')).toBe(false)
      expect(manager.getMetrics().activeConnections).toBe(0)
    })

    it('should close all connections when closeAllTenantConnections is called', async () => {
      manager.getTenantPrisma('tenant-1', BASE_DATABASE_URL)
      manager.getTenantPrisma('tenant-2', BASE_DATABASE_URL)
      manager.getTenantPrisma('tenant-3', BASE_DATABASE_URL)

      expect(manager.getMetrics().activeConnections).toBe(3)

      await manager.closeAllTenantConnections()
      expect(manager.getMetrics().activeConnections).toBe(0)
      expect(manager.hasTenantConnection('tenant-1')).toBe(false)
    })

    it('should evict idle connections exceeding the threshold', async () => {
      const entry = manager.getTenantEntry('idle-tenant', BASE_DATABASE_URL)
      // Simula tempo de inatividade
      entry.lastAccessedAt = new Date(Date.now() - 5000)

      expect(manager.hasTenantConnection('idle-tenant')).toBe(true)

      const evictedCount = await manager.evictIdleConnections(2000)
      expect(evictedCount).toBe(1)
      expect(manager.hasTenantConnection('idle-tenant')).toBe(false)
    })
  })
})
