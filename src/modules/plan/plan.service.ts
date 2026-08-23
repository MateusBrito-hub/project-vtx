import { PlanRepository } from './plan.repository'
import { IPlan } from './plan.interface'
import { prisma } from '../../shared/database/prisma'

const planRepository = new PlanRepository()

export async function getAllPlans() {
    return await planRepository.findAll()
}

export async function getPlanById(id: number) {
    return await prisma.$transaction(async (tx: any) => {
        return await planRepository.findById(tx, id)
    })
}

export async function createPlan(data: IPlan) {
    return await planRepository.create(data)
}

export async function updatePlan(id: number, data: IPlan) {
    return await planRepository.updateById(id, data)
}

export async function suspendPlan(id: number) {
    return await planRepository.suspendById(id)
}

export async function activatePlan(id: number) {
    return await planRepository.activateById(id)
}
