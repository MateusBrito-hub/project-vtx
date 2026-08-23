import { SubscriptionRepository } from './subscription.repository'
import { ISubscription } from './subscription.interface'
import { prisma } from '../../shared/database/prisma'

const subscriptionRepository = new SubscriptionRepository()

export async function getAllSubscriptions() {
    return await subscriptionRepository.findAll()
}

export async function getSubscriptionById(id: number) {
    return await subscriptionRepository.findById(id)
}

export async function getSubscriptionByClientId(clientId: number) {
    return await subscriptionRepository.findByClientId(clientId)
}

export async function createSubscription(data: ISubscription) {
    return await prisma.$transaction(async (tx: any) => {
        return await subscriptionRepository.create(tx, data.clientId, data.amount)
    })
}

export async function updateSubscription(
    id: number,
    data: Partial<ISubscription>
) {
    return await subscriptionRepository.updateById(id, data)
}

export async function suspendSubscriptionById(id: number) {
    return await subscriptionRepository.suspendById(id)
}

export async function activateSubscriptionById(id: number) {
    return await subscriptionRepository.activateById(id)
}