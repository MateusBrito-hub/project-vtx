import { prisma } from '../../shared/database/prisma'
import { IPlan } from './plan.interface'
import { Prisma } from '@prisma/client'

export class PlanRepository {

    async create(data: IPlan) {
        return await prisma.plan.create({
            data: {
                name: data.name,
                price: data.price,
                maxDocs: data.maxDocs
            }
        })
    }

    async findById(tx: Prisma.TransactionClient, id: number) {
        return await tx.plan.findUnique({
            where: { id }
        })
    }   

    async findAll() {
        return await prisma.plan.findMany({
            orderBy: {
                id: 'desc'
            }
        })
    }

    async updateById(id: number, data: IPlan) {
        return await prisma.plan.update({
            where: { id },
            data: {
                name: data.name,
                price: data.price,
                maxDocs: data.maxDocs
            }
        })
    }

    async suspendById(id: number) {
        return await prisma.plan.update({
            where: { id },
            data: {
                status: 'suspended'
            }
        })
    }

    async activateById(id: number) {
        return await prisma.plan.update({
            where: { id },
            data: {
                status: 'active'
            }
        })
    }
}
