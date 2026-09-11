// src/modules/plan/plan.repository.ts
import { prisma } from '../../shared/database/prisma'
import { CreatePlanDTO, UpdatePlanDTO } from './plan.schema'
import { Prisma } from '../../generated/prisma/client'

export class PlanRepository {

    async create(data: CreatePlanDTO) {
        return await prisma.plan.create({
            data: {
                name: data.name,
                price: data.price,
                maxDocs: data.maxDocs
            }
        })
    }

    async findById(tx: Prisma.TransactionClient, id: number) {
        const transactionClient = tx as Prisma.TransactionClient & {
            plan: typeof prisma.plan
        }

        return await transactionClient.plan.findUnique({
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

    async updateById(id: number, data: UpdatePlanDTO) {
        return await prisma.plan.update({
            where: { id },
            data
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