import { describe, it, expect } from 'vitest'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient as TenantPrismaClient } from '../src/generated/tenant-prisma'
import { TENANT_SCHEMA_DDL, runTenantMigrations } from '../src/modules/tenant/database/tenant-migration'

describe('Tenant Dedicated Database Schema & Migrations (Task 02)', () => {
  describe('Prisma Client Generation & Model Registry', () => {
    it('should successfully instantiate TenantPrismaClient with PrismaPg adapter', () => {
      const adapter = new PrismaPg({
        connectionString: 'postgresql://test_user:pass@localhost:5432/vtx_tenant_test'
      })
      const tenantPrisma = new TenantPrismaClient({ adapter })

      expect(tenantPrisma).toBeDefined()
      expect(typeof tenantPrisma).toBe('object')
    })

    it('should expose all required fiscal and corporate models on TenantPrismaClient', () => {
      const adapter = new PrismaPg({
        connectionString: 'postgresql://test_user:pass@localhost:5432/vtx_tenant_test'
      })
      const tenantPrisma = new TenantPrismaClient({ adapter })

      // Validação das entidades da modelagem
      expect(tenantPrisma.company).toBeDefined()
      expect(typeof tenantPrisma.company.findMany).toBe('function')

      expect(tenantPrisma.fiscalConfig).toBeDefined()
      expect(typeof tenantPrisma.fiscalConfig.findUnique).toBe('function')

      expect(tenantPrisma.customer).toBeDefined()
      expect(typeof tenantPrisma.customer.create).toBe('function')

      expect(tenantPrisma.product).toBeDefined()
      expect(typeof tenantPrisma.product.findMany).toBe('function')

      expect(tenantPrisma.fiscalDocument).toBeDefined()
      expect(typeof tenantPrisma.fiscalDocument.findMany).toBe('function')

      expect(tenantPrisma.fiscalDocumentItem).toBeDefined()
      expect(typeof tenantPrisma.fiscalDocumentItem.create).toBe('function')

      expect(tenantPrisma.fiscalPayment).toBeDefined()
      expect(typeof tenantPrisma.fiscalPayment.create).toBe('function')

      expect(tenantPrisma.fiscalEvent).toBeDefined()
      expect(typeof tenantPrisma.fiscalEvent.create).toBe('function')
    })
  })

  describe('Tenant Migration DDL Definition', () => {
    it('should declare all necessary enums for Tax Reform (IBS/CBS/IS)', () => {
      expect(TENANT_SCHEMA_DDL).toContain('CREATE TYPE "EnvironmentType"')
      expect(TENANT_SCHEMA_DDL).toContain('CREATE TYPE "TaxRegime"')
      expect(TENANT_SCHEMA_DDL).toContain('CREATE TYPE "TaxReformClass"')
      expect(TENANT_SCHEMA_DDL).toContain('CREATE TYPE "DocumentModel"')
      expect(TENANT_SCHEMA_DDL).toContain('CREATE TYPE "DocumentStatus"')
      expect(TENANT_SCHEMA_DDL).toContain('CREATE TYPE "PaymentType"')
      expect(TENANT_SCHEMA_DDL).toContain('CREATE TYPE "EventType"')

      // Classes da Reforma Tributária
      expect(TENANT_SCHEMA_DDL).toContain('PADRAO')
      expect(TENANT_SCHEMA_DDL).toContain('REDUZIDA_60')
      expect(TENANT_SCHEMA_DDL).toContain('REDUZIDA_30')
      expect(TENANT_SCHEMA_DDL).toContain('CESTA_BASICA_ISENTA')
      expect(TENANT_SCHEMA_DDL).toContain('IMPOSTO_SELETIVO')
    })

    it('should declare all tables and relational foreign keys', () => {
      expect(TENANT_SCHEMA_DDL).toContain('CREATE TABLE IF NOT EXISTS "Company"')
      expect(TENANT_SCHEMA_DDL).toContain('CREATE TABLE IF NOT EXISTS "FiscalConfig"')
      expect(TENANT_SCHEMA_DDL).toContain('CREATE TABLE IF NOT EXISTS "Customer"')
      expect(TENANT_SCHEMA_DDL).toContain('CREATE TABLE IF NOT EXISTS "Product"')
      expect(TENANT_SCHEMA_DDL).toContain('CREATE TABLE IF NOT EXISTS "FiscalDocument"')
      expect(TENANT_SCHEMA_DDL).toContain('CREATE TABLE IF NOT EXISTS "FiscalDocumentItem"')
      expect(TENANT_SCHEMA_DDL).toContain('CREATE TABLE IF NOT EXISTS "FiscalPayment"')
      expect(TENANT_SCHEMA_DDL).toContain('CREATE TABLE IF NOT EXISTS "FiscalEvent"')

      // Suporte a Split Payment
      expect(TENANT_SCHEMA_DDL).toContain('"splitPaymentEnabled"')
      expect(TENANT_SCHEMA_DDL).toContain('"splitAmountIbs"')
      expect(TENANT_SCHEMA_DDL).toContain('"splitAmountCbs"')

      // Campos de Partilha de IBS Estadual e Municipal
      expect(TENANT_SCHEMA_DDL).toContain('"totalIbsEstadual"')
      expect(TENANT_SCHEMA_DDL).toContain('"totalIbsMunicipal"')
      expect(TENANT_SCHEMA_DDL).toContain('"totalIbs"')
      expect(TENANT_SCHEMA_DDL).toContain('"totalCbs"')
      expect(TENANT_SCHEMA_DDL).toContain('"totalIS"')
    })

    it('should reject invalid tenant slug during migration execution', async () => {
      await expect(runTenantMigrations('')).rejects.toThrow('Tenant slug must be a non-empty string')
      await expect(runTenantMigrations('invalid slug with spaces!')).rejects.toThrow()
    })
  })
})
