import { prisma } from '../../shared/database/prisma'
import { ISubscription } from './subscription.interface'
import { Prisma } from '@prisma/client'

export class SubscriptionRepository {
    async create(tx: Prisma.TransactionClient, clientId: number, amount: number) {
        return await tx.subscription.create({
            data: {
                clientId,
                amount
            }
        })
    }

    async findById(id: number) {
        return await prisma.subscription.findUnique({
            where: { id }
        })
    }

    async findByClientId(clientId: number) {
        return await prisma.subscription.findFirst({
            where: { clientId }
        })
    }

    async updateById(id: number, data: Partial<ISubscription>) {
        return await prisma.subscription.update({
            where: { id },
            data
        })
    }
    
    async findAll() {
        return await prisma.subscription.findMany()
    }

    async suspendById(id: number) {
        return await prisma.subscription.update({
            where: { id },
            data: {
                status: 'suspended'
            }
        })
    }

    async activateById(id: number) {
        return await prisma.subscription.update({
            where: { id },
            data: {
                status: 'active'
            }
        })
    }
}