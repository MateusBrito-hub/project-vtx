import { PrismaClient } from '@prisma/client'
import { createClientDatabase } from '../utils/databse-manager'
import { IClient } from '../shared/interface/client'

const prisma = new PrismaClient()

export async function createClientWithSubscription(data: IClient) {
    return await prisma.$transaction(async (tx) => {
        // Buscar plano
        const plan = await tx.plan.findUnique({
            where: { id: data.planId }
        })

        if (!plan) {
            throw new Error("Plano não encontrado")
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

        // 🚀 Criar banco físico do client
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

export async function getAllClients() {
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

export async function getClientById(id: number) {
    return await prisma.client.findUnique({
        where: { id },
        include: {
            plan: true,
            subscription: true
        }
    })
}

export async function getClientBySlug(slug: string) {
    return await prisma.client.findUnique({
        where: { slug },
        include: {
            plan: true,
            subscription: true
        }
    })
}

export async function updateClientById(
    id: number,
    data: Partial<IClient>
) {
    const client = await prisma.client.findUnique({
        where: { id }
    })

    if (!client) {
        throw new Error('Client não encontrada')
    }

    // ❌ Não permitir alterar o database (caso exista no model)
    if ((data as any).database) {
        throw new Error('Não é permitido alterar o database da client')
    }

    const updatedClient = await prisma.client.update({
        where: { id },
        data
    })

    return updatedClient
}

export async function suspendClientById(id: number) {
    return await prisma.client.update({
        where: { id },
        data: {
            status: 'suspended'
        }
    })
}

export async function cancelClientById(id: number) {
    return await prisma.client.update({
        where: { id },
        data: {
            status: 'cancelled'
        }
    })
}

export async function activeClientById(id: number) {
    return await prisma.client.update({
        where: { id },
        data: {
            status: 'active'
        }
    })
}