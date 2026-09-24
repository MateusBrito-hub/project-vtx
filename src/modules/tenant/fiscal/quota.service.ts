import { prisma as centralPrisma } from '../../../shared/database/prisma'
import { PrismaClient as TenantPrismaClient } from '../../../generated/tenant-prisma/client'

export interface QuotaCheckResult {
    allowed: boolean
    maxDocs: number
    usedDocs: number
    remainingDocs: number
    planName: string
    cycleStart: Date
    cycleEnd: Date
    reason?: string
}

export class QuotaService {
    /**
     * Calcula o início e o fim do ciclo mensal corrente.
     */
    public getMonthlyCycleWindow(referenceDate: Date = new Date()): { cycleStart: Date; cycleEnd: Date } {
        const cycleStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1, 0, 0, 0, 0)
        const cycleEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999)
        return { cycleStart, cycleEnd }
    }

    /**
     * Consulta a assinatura central e afere o saldo de emissão do tenant.
     */
    public async checkEmissionQuota(slug: string, tenantPrisma: TenantPrismaClient): Promise<QuotaCheckResult> {
        const { cycleStart, cycleEnd } = this.getMonthlyCycleWindow()

        // 1. Busca plano e assinatura no banco central (VTX Core)
        const client = await centralPrisma.client.findUnique({
            where: { slug },
            include: {
                subscription: true,
                plan: true
            }
        })

        if (!client) {
            return {
                allowed: false,
                maxDocs: 0,
                usedDocs: 0,
                remainingDocs: 0,
                planName: 'N/A',
                cycleStart,
                cycleEnd,
                reason: 'TENANT_NOT_FOUND'
            }
        }

        if (!client.subscription || client.subscription.status !== 'active') {
            return {
                allowed: false,
                maxDocs: client.plan?.maxDocs ?? 0,
                usedDocs: 0,
                remainingDocs: 0,
                planName: client.plan?.name ?? 'Plano Desconhecido',
                cycleStart,
                cycleEnd,
                reason: 'INACTIVE_SUBSCRIPTION'
            }
        }

        const maxDocs = client.plan.maxDocs

        // 2. Conta documentos autorizados no banco dedicado (VTX Tenant) no ciclo corrente
        const usedDocs = await tenantPrisma.fiscalDocument.count({
            where: {
                status: 'AUTHORIZED',
                emissionDate: {
                    gte: cycleStart,
                    lte: cycleEnd
                }
            }
        })

        const remainingDocs = Math.max(0, maxDocs - usedDocs)
        const allowed = usedDocs < maxDocs

        return {
            allowed,
            maxDocs,
            usedDocs,
            remainingDocs,
            planName: client.plan.name,
            cycleStart,
            cycleEnd,
            reason: allowed ? undefined : 'QUOTA_EXCEEDED'
        }
    }

    /**
     * Assegura que o tenant possui quota disponível, disparando exceção controlada caso excedido.
     */
    public async assertEmissionQuota(slug: string, tenantPrisma: TenantPrismaClient): Promise<QuotaCheckResult> {
        const quota = await this.checkEmissionQuota(slug, tenantPrisma)

        if (!quota.allowed) {
            if (quota.reason === 'INACTIVE_SUBSCRIPTION') {
                const error = new Error('Tenant subscription is inactive or suspended.')
                    ; (error as any).code = 'INACTIVE_SUBSCRIPTION'
                throw error
            }

            if (quota.reason === 'QUOTA_EXCEEDED') {
                const error = new Error(`Monthly fiscal emission limit reached (${quota.usedDocs}/${quota.maxDocs} docs). Upgrade plan to continue.`)
                    ; (error as any).code = 'QUOTA_EXCEEDED'
                    ; (error as any).quota = quota
                throw error
            }

            const error = new Error(`Emission blocked: ${quota.reason}`)
                ; (error as any).code = quota.reason
            throw error
        }

        return quota
    }
}

export const quotaService = new QuotaService()