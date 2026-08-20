import { IClient } from './client.interface'
import { 
    create,
    findAll,
    findById,
    findBySlug,
    updateById,
    suspendById,
    cancelById,
    activateById
} from './client.repository'


export async function createClientWithSubscription(data: IClient) {
    return await create(data)
}

export async function getAllClients() {
    return await findAll()
}

export async function getClientById(id: number) {
    return await findById(id)
}

export async function getClientBySlug(slug: string) {
    return await findBySlug(slug)
}

export async function updateClientById(
    id: number,
    data: Partial<IClient>
) {
    return await updateById(id, data)
}

export async function suspendClientById(id: number) {
    return await suspendById(id)
}

export async function cancelClientById(id: number) {
    return await cancelById(id)
}

export async function activeClientById(id: number) {
    return await activateById(id)
}