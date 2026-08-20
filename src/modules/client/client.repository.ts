import { prisma } from '../../shared/database/prisma'
import { IClient } from './client.interface'
import { createClientDatabase } from '../../shared/database/database-manager'
import { findByid } from '../plan/plan.repository'

export async function create(data: IClient) {
    return await prisma.$transaction(async (tx) => {
        const plan = await findByid(data.planId)
        
            if (!plan) {
                throw new Error('Plano não encontrado')
            }

        const client = await tx.client.create({
            data: {
                socialName: data.socialName,
                fantasyName: data.fantasyName,
                CPF_CNPJ: data.CPF_CNPJ,
                IE: data.IE,
                IM: data.IM,
                owner: data.owner,
                ownerDocument: data.ownerDocument,
                address: data.address,
                district: data.district,
                complement: data.complement,
                UF: data.UF,
                zipCode: data.zipCode,
                slug: data.slug,
                contact: data.contact,
                email: data.email,
                planId: data.planId
            }
        })

        await createClientDatabase(client.slug)

        const subscription = await tx.subscription.create({
            data: {
                clientId: client.id,
                amount: plan.price
            }
        })


        return {
            client,
            subscription
        }
    })
}

export async function findAll() {
    return await prisma.client.findMany({
        include: {
            plan: true,
            subscription: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    })
}

export async function findById(id: number) {
    return await prisma.client.findUnique({
        where: { id },
        include: {
            plan: true,
            subscription: true
        }
    })
}

export async function findBySlug(slug: string) {
    return await prisma.client.findUnique({
        where: { slug },
        include: {
            plan: true,
            subscription: true
        }
    })
}

export async function updateById(id: number, data: Partial<IClient>) {
    const client = await prisma.client.findUnique({
        where: { id }
    })

    if (!client) {
        throw new Error('Client não encontrada')
    }

    if ((data as any).database) {
        throw new Error('Não é permitido alterar o database da client')
    }

    return await prisma.client.update({
        where: { id },
        data
    })
}

export async function suspendById(id: number) {
    return await prisma.client.update({
        where: { id },
        data: {
            status: 'suspended'
        }
    })
}

export async function cancelById(id: number) {
    return await prisma.client.update({
        where: { id },
        data: {
            status: 'cancelled'
        }
    })
}

export async function activateById(id: number) {
    return await prisma.client.update({
        where: { id },
        data: {
            status: 'active'
        }
    })
}