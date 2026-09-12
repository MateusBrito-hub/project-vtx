import { Request, Response, NextFunction } from 'express'
import { prisma } from '../../shared/database/prisma'
import { sanitizeTenantSlug, getTenantPrisma } from './config/tenant-connection'
import { PrismaClient as TenantPrismaClient } from '../../generated/tenant-prisma/client'

declare global {
  namespace Express {
    interface Request {
      tenantSlug?: string
      tenant?: any
      tenantPrisma?: TenantPrismaClient
    }
  }
}

const RESERVED_SUBDOMAINS = new Set([
  'admin',
  'api',
  'core',
  'app',
  'www',
  'mail',
  'smtp',
  'ftp',
  'localhost',
  '127'
])

/**
 * Extrai o slug do tenant a partir do cabeçalho X-Tenant-Slug ou subdomínio do Host.
 */
export function extractTenantSlug(req: Request): string | null {
  // 1. Prioridade: Cabeçalho explícito (APIs, testes, gateways)
  const headerSlug = req.headers['x-tenant-slug']
  if (headerSlug && typeof headerSlug === 'string' && headerSlug.trim()) {
    return headerSlug.trim()
  }

  // 2. Extração via Hostname / Subdomínio (ex: slug.vtx.com.br ou slug.localhost)
  const host = (req.hostname || req.headers.host || '').split(':')[0].toLowerCase()
  const parts = host.split('.')

  if (parts.length >= 2) {
    const candidate = parts[0].trim()
    if (candidate && !RESERVED_SUBDOMAINS.has(candidate) && !/^\d+$/.test(candidate)) {
      return candidate
    }
  }

  return null
}

/**
 * Middleware para identificação de tenant, validação de status no banco central
 * e injeção do Prisma Client dedicado no ciclo de vida da requisição Express.
 */
export async function tenantMiddleware(req: Request, res: Response, next: NextFunction): Promise<any> {
  const rawSlug = extractTenantSlug(req)

  if (!rawSlug) {
    return res.status(400).json({
      error: 'Tenant identifier not provided. Use subdomain (slug.domain.com) or X-Tenant-Slug header.'
    })
  }

  let sanitizedSlug: string
  try {
    sanitizedSlug = sanitizeTenantSlug(rawSlug)
  } catch (err: any) {
    return res.status(400).json({
      error: err.message
    })
  }

  try {
    // 1. Valida existência e status do tenant no banco central (VTX Core)
    // Permite busca tanto pelo formato com hífen quanto com underscore
    const client = await prisma.client.findFirst({
      where: {
        OR: [
          { slug: rawSlug },
          { slug: sanitizedSlug }
        ]
      }
    })

    if (!client) {
      return res.status(404).json({
        error: `Tenant "${rawSlug}" not found.`
      })
    }

    if (client.status !== 'active') {
      return res.status(403).json({
        error: `Tenant "${rawSlug}" is currently ${client.status}. Access denied.`
      })
    }

    // 2. Injeta o contexto e o Prisma Client dedicado à requisição
    req.tenantSlug = sanitizedSlug
    req.tenant = client
    req.tenantPrisma = getTenantPrisma(sanitizedSlug)

    return next()
  } catch (err: any) {
    return res.status(500).json({
      error: `Failed to resolve tenant connection: ${err.message}`
    })
  }
}
