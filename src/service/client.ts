import { PrismaClient } from '@prisma/client'
import { IClient } from '../shared/interface/client'

const prisma = new PrismaClient()

export async function registerClient(data: IClient) {
    const client = await prisma.client.create({
            data: {
                name: data.name,
                email: data.email,
                phone: data.phone,
                password: data.password,
                profilePicture: data.profilePicture,
                address: data.address
            }
        })

        return {
            client
        }
}

export async function getAllClients() {
    return await prisma.client.findMany({
        orderBy: {
            createdAt: 'desc'
        }
    })
}

export async function getClientById(id: number) {
    return await prisma.client.findUnique({
        where: { id }
    })
}   

export async function getClientByName(name: string) {
    return await prisma.client.findUnique({
        where: { name }
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

    const updatedClient = await prisma.client.update({
        where: { id },
        data
    })

    return updatedClient
}
