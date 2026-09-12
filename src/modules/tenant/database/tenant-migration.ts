import { Client } from 'pg'
import { getTenantConnectionString, sanitizeTenantSlug } from '../config/tenant-connection'

/**
 * Script DDL idempotente que cria todas as tabelas, tipos enumerados e índices
 * do banco de dados dedicado do tenant (PostgreSQL), compatível com o schema prisma/tenant.prisma.
 */
export const TENANT_SCHEMA_DDL = `
-- 1. Enums Fiscais e da Reforma Tributária
DO $$ BEGIN
  CREATE TYPE "EnvironmentType" AS ENUM ('HOMOLOGATION', 'PRODUCTION');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TaxRegime" AS ENUM ('SIMPLES_NACIONAL', 'SIMPLES_EXCESSO_SUBLIMITE', 'REGIME_NORMAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TaxReformClass" AS ENUM ('PADRAO', 'REDUZIDA_60', 'REDUZIDA_30', 'CESTA_BASICA_ISENTA', 'IMPOSTO_SELETIVO', 'IMUNE_ISENTO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentModel" AS ENUM ('NFE_55', 'NFCE_65');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'VALIDATED', 'SIGNED', 'TRANSMITTING', 'AUTHORIZED', 'REJECTED', 'CANCELED', 'DENIED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentType" AS ENUM ('DINHEIRO_01', 'CHEQUE_02', 'CARTAO_CREDITO_03', 'CARTAO_DEBITO_04', 'CREDITO_LOJA_05', 'VALE_ALIMENTACAO_10', 'VALE_REFEICAO_11', 'PIX_17', 'SEM_PAGAMENTO_90', 'OUTROS_99');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "EventType" AS ENUM ('CANCELAMENTO', 'CCE', 'INUTILIZACAO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Tabela Company (Matriz e Filiais)
CREATE TABLE IF NOT EXISTS "Company" (
  "id" SERIAL PRIMARY KEY,
  "isHeadquarter" BOOLEAN NOT NULL DEFAULT true,
  "cnpj" VARCHAR(14) NOT NULL UNIQUE,
  "ie" VARCHAR(20),
  "im" VARCHAR(20),
  "socialName" VARCHAR(255) NOT NULL,
  "fantasyName" VARCHAR(255) NOT NULL,
  "street" VARCHAR(255) NOT NULL,
  "number" VARCHAR(30) NOT NULL,
  "complement" VARCHAR(100),
  "district" VARCHAR(100) NOT NULL,
  "cityCode" VARCHAR(7) NOT NULL,
  "cityName" VARCHAR(100) NOT NULL,
  "uf" VARCHAR(2) NOT NULL,
  "zipCode" VARCHAR(8) NOT NULL,
  "phone" VARCHAR(20),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela FiscalConfig (Configurações Fiscais por Filial)
CREATE TABLE IF NOT EXISTS "FiscalConfig" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL UNIQUE REFERENCES "Company"("id") ON DELETE CASCADE,
  "environment" "EnvironmentType" NOT NULL DEFAULT 'HOMOLOGATION',
  "taxRegime" "TaxRegime" NOT NULL DEFAULT 'SIMPLES_NACIONAL',
  "enableTaxReform" BOOLEAN NOT NULL DEFAULT true,
  "nfeSeries" INTEGER NOT NULL DEFAULT 1,
  "nfeNextNumber" INTEGER NOT NULL DEFAULT 1,
  "nfceSeries" INTEGER NOT NULL DEFAULT 1,
  "nfceNextNumber" INTEGER NOT NULL DEFAULT 1,
  "certificatePfxBase64" TEXT,
  "certificatePasswordEnc" TEXT,
  "certificateExpiresAt" TIMESTAMP(3),
  "certificateCnpj" VARCHAR(14),
  "cscIdToken" VARCHAR(10),
  "cscToken" VARCHAR(100),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabela Customer (Destinatários e Princípio do Destino)
CREATE TABLE IF NOT EXISTS "Customer" (
  "id" SERIAL PRIMARY KEY,
  "cpfCnpj" VARCHAR(14) NOT NULL UNIQUE,
  "name" VARCHAR(255) NOT NULL,
  "fantasyName" VARCHAR(255),
  "ie" VARCHAR(20),
  "indicadorIe" INTEGER NOT NULL DEFAULT 9,
  "email" VARCHAR(255),
  "phone" VARCHAR(20),
  "street" VARCHAR(255) NOT NULL,
  "number" VARCHAR(30) NOT NULL,
  "complement" VARCHAR(100),
  "district" VARCHAR(100) NOT NULL,
  "cityCode" VARCHAR(7) NOT NULL,
  "cityName" VARCHAR(100) NOT NULL,
  "uf" VARCHAR(2) NOT NULL,
  "zipCode" VARCHAR(8) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabela Product (Catálogo e Classificação da Reforma)
CREATE TABLE IF NOT EXISTS "Product" (
  "id" SERIAL PRIMARY KEY,
  "sku" VARCHAR(60) NOT NULL UNIQUE,
  "description" VARCHAR(255) NOT NULL,
  "ncm" VARCHAR(8) NOT NULL,
  "cest" VARCHAR(7),
  "unit" VARCHAR(6) NOT NULL,
  "price" DECIMAL(12, 2) NOT NULL,
  "ean" VARCHAR(14),
  "cfopDefault" VARCHAR(4) NOT NULL,
  "taxReformClass" "TaxReformClass" NOT NULL DEFAULT 'PADRAO',
  "isSubjectToIS" BOOLEAN NOT NULL DEFAULT false,
  "cstIbsCbsDefault" VARCHAR(2) DEFAULT '01',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tabela FiscalDocument (Cabeçalho com Tributos Legados + IBS/CBS/IS)
CREATE TABLE IF NOT EXISTS "FiscalDocument" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL REFERENCES "Company"("id"),
  "model" "DocumentModel" NOT NULL DEFAULT 'NFE_55',
  "series" INTEGER NOT NULL,
  "number" INTEGER NOT NULL,
  "accessKey" VARCHAR(44) UNIQUE,
  "naturezaOp" VARCHAR(60) NOT NULL DEFAULT 'VENDA DE MERCADORIA',
  "tipoOp" INTEGER NOT NULL DEFAULT 1,
  "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "emissionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "authorizationDate" TIMESTAMP(3),
  "customerId" INTEGER REFERENCES "Customer"("id"),
  "totalProducts" DECIMAL(12, 2) NOT NULL,
  "totalDiscount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "totalInvoice" DECIMAL(12, 2) NOT NULL,
  "totalTaxIcms" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "totalTaxPis" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "totalTaxCofins" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "totalTaxIpi" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "totalIbsEstadual" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "totalIbsMunicipal" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "totalIbs" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "totalCbs" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "totalIS" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "protocolNumber" VARCHAR(50),
  "cStat" VARCHAR(5),
  "xMotivo" VARCHAR(255),
  "xmlSigned" TEXT,
  "xmlDistribution" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FiscalDocument_company_model_series_number_key" UNIQUE ("companyId", "model", "series", "number")
);

-- 7. Tabela FiscalDocumentItem (Itens com Apuração IVA Dual)
CREATE TABLE IF NOT EXISTS "FiscalDocumentItem" (
  "id" SERIAL PRIMARY KEY,
  "documentId" INTEGER NOT NULL REFERENCES "FiscalDocument"("id") ON DELETE CASCADE,
  "itemNumber" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL REFERENCES "Product"("id"),
  "description" VARCHAR(255) NOT NULL,
  "ncm" VARCHAR(8) NOT NULL,
  "cfop" VARCHAR(4) NOT NULL,
  "unit" VARCHAR(6) NOT NULL,
  "quantity" DECIMAL(12, 4) NOT NULL,
  "unitPrice" DECIMAL(12, 4) NOT NULL,
  "totalPrice" DECIMAL(12, 2) NOT NULL,
  "discount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "cstIbsCbs" VARCHAR(2),
  "taxReformClass" "TaxReformClass" NOT NULL DEFAULT 'PADRAO',
  "baseIbs" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "aliqIbsEstadual" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  "valorIbsEstadual" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "aliqIbsMunicipal" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  "valorIbsMunicipal" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "valorIbsTotal" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "baseCbs" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "aliqCbs" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  "valorCbs" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "baseIS" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "aliqIS" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  "valorIS" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FiscalDocumentItem_documentId_itemNumber_key" UNIQUE ("documentId", "itemNumber")
);

-- 8. Tabela FiscalPayment (Pagamentos e Split Payment)
CREATE TABLE IF NOT EXISTS "FiscalPayment" (
  "id" SERIAL PRIMARY KEY,
  "documentId" INTEGER NOT NULL REFERENCES "FiscalDocument"("id") ON DELETE CASCADE,
  "paymentType" "PaymentType" NOT NULL DEFAULT 'DINHEIRO_01',
  "amount" DECIMAL(12, 2) NOT NULL,
  "splitPaymentEnabled" BOOLEAN NOT NULL DEFAULT false,
  "splitBankCode" VARCHAR(10),
  "splitIspb" VARCHAR(8),
  "splitCnpjRecipient" VARCHAR(14),
  "splitAmountIbs" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "splitAmountCbs" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Tabela FiscalEvent (Cancelamento, Carta de Correção, Inutilização)
CREATE TABLE IF NOT EXISTS "FiscalEvent" (
  "id" SERIAL PRIMARY KEY,
  "documentId" INTEGER NOT NULL REFERENCES "FiscalDocument"("id") ON DELETE CASCADE,
  "eventType" "EventType" NOT NULL,
  "sequenceNumber" INTEGER NOT NULL DEFAULT 1,
  "protocolNumber" VARCHAR(50),
  "cStat" VARCHAR(5),
  "xMotivo" VARCHAR(255),
  "correctionReason" TEXT,
  "xmlEvent" TEXT,
  "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`

/**
 * Executa as migrações estruturais no banco de dados dedicado do tenant (vtx_<slug>).
 */
export async function runTenantMigrations(rawSlug: string, baseUrl?: string): Promise<void> {
  const safeSlug = sanitizeTenantSlug(rawSlug)
  const connectionString = getTenantConnectionString(safeSlug, baseUrl)

  const client = new Client({ connectionString })
  await client.connect()

  try {
    await client.query(TENANT_SCHEMA_DDL)
  } finally {
    await client.end()
  }
}
