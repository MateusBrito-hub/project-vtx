import { Pool, PoolConfig } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../../generated/prisma/client'

export interface TenantConnectionOptions {
  maxPoolSize?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
}

export interface TenantConnectionEntry<T = any> {
  slug: string
  dbName: string
  connectionString: string
  pool: Pool
  adapter: PrismaPg
  client: T
  createdAt: Date
  lastAccessedAt: Date
}

export type TenantClientFactory<T = any> = (adapter: PrismaPg, connectionString: string) => T

/**
 * Valida e sanitiza o slug do tenant para garantir segurança contra SQL Injection
 * e nomes inválidos de bancos de dados no PostgreSQL.
 */
export function sanitizeTenantSlug(rawSlug: string): string {
  if (!rawSlug || typeof rawSlug !== 'string') {
    throw new Error('Tenant slug must be a non-empty string')
  }

  const normalized = rawSlug
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/-/g, '_')
    .replace(/[^a-z0-9_]/g, '')

  if (!normalized) {
    throw new Error(`Invalid tenant slug "${rawSlug}". Slug must contain alphanumeric characters, hyphens, or underscores`)
  }

  if (normalized.length > 50) {
    throw new Error(`Tenant slug "${rawSlug}" exceeds maximum allowed length of 50 characters`)
  }

  return normalized
}

/**
 * Retorna o nome físico do banco de dados no PostgreSQL no formato "vtx_<slug>".
 */
export function getTenantDatabaseName(rawSlug: string): string {
  const safeSlug = sanitizeTenantSlug(rawSlug)
  return `vtx_${safeSlug}`.substring(0, 63)
}

/**
 * Constrói a connection string do banco dedicado do tenant a partir da DATABASE_URL base,
 * preservando credenciais, porta, host e query parameters (ex: schema, sslmode).
 */
export function getTenantConnectionString(rawSlug: string, baseUrl?: string): string {
  const resolvedBaseUrl = baseUrl || process.env.DATABASE_URL
  if (!resolvedBaseUrl) {
    throw new Error('DATABASE_URL environment variable is not defined')
  }

  const dbName = getTenantDatabaseName(rawSlug)

  try {
    const url = new URL(resolvedBaseUrl)
    url.pathname = `/${dbName}`
    return url.toString()
  } catch {
    // Fallback para strings com formato não padrão
    const cleanUrl = resolvedBaseUrl.replace(/\/[^/?]+(\?.*)?$/, `/${dbName}$1`)
    return cleanUrl
  }
}

/**
 * Gerenciador dinâmico de conexões de tenant (Multi-tenant Connection Router).
 * Mantém em cache pools do pg e instâncias do adaptador Prisma, isolados por slug.
 */
export class TenantConnectionManager<TClient = any> {
  private connections = new Map<string, TenantConnectionEntry<TClient>>()
  private options: Required<TenantConnectionOptions>
  private clientFactory: TenantClientFactory<TClient>

  constructor(
    options: TenantConnectionOptions = {},
    clientFactory?: TenantClientFactory<TClient>
  ) {
    this.options = {
      maxPoolSize: options.maxPoolSize ?? 5,
      idleTimeoutMillis: options.idleTimeoutMillis ?? 30000,
      connectionTimeoutMillis: options.connectionTimeoutMillis ?? 5000
    }

    // Default factory usa PrismaClient padrão
    this.clientFactory = clientFactory || ((adapter: PrismaPg) => {
      return new PrismaClient({ adapter }) as unknown as TClient
    })
  }

  /**
   * Define uma fábrica customizada para criação do cliente (ex: cliente dedicado do tenant).
   */
  public setClientFactory(factory: TenantClientFactory<TClient>): void {
    this.clientFactory = factory
  }

  /**
   * Obtém ou cria a entrada de conexão para um tenant específico.
   */
  public getTenantEntry(rawSlug: string, baseUrl?: string): TenantConnectionEntry<TClient> {
    const slug = sanitizeTenantSlug(rawSlug)

    const existing = this.connections.get(slug)
    if (existing) {
      existing.lastAccessedAt = new Date()
      return existing
    }

    const dbName = getTenantDatabaseName(slug)
    const connectionString = getTenantConnectionString(slug, baseUrl)

    const poolConfig: PoolConfig = {
      connectionString,
      max: this.options.maxPoolSize,
      idleTimeoutMillis: this.options.idleTimeoutMillis,
      connectionTimeoutMillis: this.options.connectionTimeoutMillis
    }

    const pool = new Pool(poolConfig)
    const adapter = new PrismaPg(pool)
    const client = this.clientFactory(adapter, connectionString)

    const entry: TenantConnectionEntry<TClient> = {
      slug,
      dbName,
      connectionString,
      pool,
      adapter,
      client,
      createdAt: new Date(),
      lastAccessedAt: new Date()
    }

    this.connections.set(slug, entry)
    return entry
  }

  /**
   * Retorna o cliente Prisma dedicado ao banco do tenant.
   */
  public getTenantPrisma(rawSlug: string, baseUrl?: string): TClient {
    return this.getTenantEntry(rawSlug, baseUrl).client
  }

  /**
   * Retorna o pool pg dedicado ao banco do tenant.
   */
  public getTenantPool(rawSlug: string, baseUrl?: string): Pool {
    return this.getTenantEntry(rawSlug, baseUrl).pool
  }

  /**
   * Retorna o adaptador PrismaPg do tenant.
   */
  public getTenantAdapter(rawSlug: string, baseUrl?: string): PrismaPg {
    return this.getTenantEntry(rawSlug, baseUrl).adapter
  }

  /**
   * Verifica se já existe uma conexão ativa em cache para o tenant.
   */
  public hasTenantConnection(rawSlug: string): boolean {
    try {
      const slug = sanitizeTenantSlug(rawSlug)
      return this.connections.has(slug)
    } catch {
      return false
    }
  }

  /**
   * Fecha de forma graciosa a conexão de um tenant e a remove do cache.
   */
  public async closeTenantConnection(rawSlug: string): Promise<void> {
    const slug = sanitizeTenantSlug(rawSlug)
    const entry = this.connections.get(slug)
    if (entry) {
      this.connections.delete(slug)
      await entry.pool.end()
    }
  }

  /**
   * Fecha todas as conexões ativas gerenciadas pelo pool.
   */
  public async closeAllTenantConnections(): Promise<void> {
    const entries = Array.from(this.connections.values())
    this.connections.clear()

    await Promise.all(
      entries.map(async (entry) => {
        try {
          await entry.pool.end()
        } catch {
          // Ignora falhas no encerramento de pools já finalizados
        }
      })
    )
  }

  /**
   * Remove conexões que não foram acessadas dentro do período especificado (LRU / Idle Eviction).
   */
  public async evictIdleConnections(maxIdleAgeMs?: number): Promise<number> {
    const threshold = maxIdleAgeMs ?? this.options.idleTimeoutMillis
    const now = Date.now()
    const evicted: string[] = []

    for (const [slug, entry] of this.connections.entries()) {
      if (now - entry.lastAccessedAt.getTime() > threshold) {
        evicted.push(slug)
      }
    }

    for (const slug of evicted) {
      await this.closeTenantConnection(slug)
    }

    return evicted.length
  }

  /**
   * Métricas do gerenciador de conexões para monitoramento de observabilidade.
   */
  public getMetrics(): { activeConnections: number; cachedTenants: string[] } {
    return {
      activeConnections: this.connections.size,
      cachedTenants: Array.from(this.connections.keys())
    }
  }
}

// Instância Singleton padrão exportada para o sistema
export const tenantConnectionManager = new TenantConnectionManager()

export function getTenantPrisma(slug: string): any {
  return tenantConnectionManager.getTenantPrisma(slug)
}
