import { IClient } from './client.interface'
import { ClientRepository } from './client.repository'
import { PlanRepository } from '../plan/plan.repository'
import { SubscriptionRepository } from '../subscription/subscription.repository'
import { createClientDatabase } from '../../shared/database/database-manager'
import { prisma } from '../../shared/database/prisma'

const clientRepository = new ClientRepository()
const planRepository = new PlanRepository()
const subscriptionRepository = new SubscriptionRepository()

export async function createClientWithSubscription(data: IClient) {
    const result = await prisma.$transaction(async (tx: any) => {
        const plan = await planRepository.findById(tx, data.planId)
        if (!plan) {
            throw new Error('Plan not found')
        }

        const client = await clientRepository.create(tx, data)

        const subscription = await subscriptionRepository.create(tx, client.id, plan.price)

        return {
            client,
            subscription
        }
    })

    await createClientDatabase(result.client.slug)

    return result
}

export async function getAllClients() {
    return await clientRepository.findAll()
}

export async function getClientById(id: number) {
    return await clientRepository.findById(id)
}

export async function getClientBySlug(slug: string) {
    return await clientRepository.findBySlug(slug)
}

export async function updateClientById(
    id: number,
    data: Partial<IClient>
) {
    return await clientRepository.updateById(id, data)
}

export async function suspendClientById(id: number) {
    return await clientRepository.suspendById(id)
}

export async function cancelClientById(id: number) {
    return await clientRepository.cancelById(id)
}

export async function activateClientById(id: number) {
    return await clientRepository.activateById(id)
}