// src/modules/plan/plan.service.ts
import { PlanRepository } from './plan.repository'
import { CreatePlanDTO, UpdatePlanDTO } from './plan.schema'
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

export async function createPlan(data: CreatePlanDTO) {
    return await planRepository.create(data)
}

export async function updatePlan(id: number, data: UpdatePlanDTO) {
    return await planRepository.updateById(id, data)
}

export async function suspendPlan(id: number) {
    return await planRepository.suspendById(id)
}

export async function activatePlan(id: number) {
    return await planRepository.activateById(id)
}