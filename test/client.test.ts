import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IClient } from '../src/shared/interface/client'

// vi.hoisted garante que o mock exista antes do vi.mock ser processado
const { mockPrismaClient, mockCreateClientDatabase } = vi.hoisted(() => {
    const mockPrismaClient = {
        client: {
            create: vi.fn(),
            findMany: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        plan: {
            findUnique: vi.fn(),
        },
        subscription: {
            create: vi.fn(),
        },
        $transaction: vi.fn(),
    }

    const mockCreateClientDatabase = vi.fn()

    return { mockPrismaClient, mockCreateClientDatabase }
})

vi.mock('@prisma/client', () => ({
    // Precisa ser uma função "normal" (não arrow function).
    // O vi.fn() invoca a implementação via `new` quando o mock é chamado
    // com `new PrismaClient()`, e arrow functions não são construtíveis.
    PrismaClient: vi.fn(function () {
        return mockPrismaClient
    })
}))

vi.mock('../src/utils/databse-manager', () => ({
    createClientDatabase: mockCreateClientDatabase
}))

// Importa DEPOIS dos mocks, para que client.ts receba o PrismaClient mockado
import {
    createClientWithSubscription,
    getAllClients,
    getClientById,
    getClientBySlug,
    updateClientById,
    suspendClientById,
    cancelClientById,
    activeClientById,
} from '../src/service/client'

const mockClientData: IClient = {
    socialName: 'Empresa Teste LTDA',
    fantasyName: 'Teste',
    CPF_CNPJ: '12345678000199',
    IE: '123456789',
    IM: '987654321',
    owner: 'João Silva',
    ownerDocument: '12345678900',
    address: 'Rua Teste, 123',
    district: 'Centro',
    complement: '',
    UF: 'PB',
    zipCode: '58000000',
    slug: 'empresa-teste',
    contact: '83900000000',
    email: 'contato@empresateste.com',
    planId: 1,
} as IClient

const mockPlanRecord = {
    id: 1,
    name: 'Plano Básico',
    price: 99.9,
}

const mockClientRecord = {
    id: 1,
    ...mockClientData,
    status: 'active',
    createdAt: new Date('2025-01-01'),
}

const mockSubscriptionRecord = {
    id: 1,
    clientId: 1,
    amount: mockPlanRecord.price,
}

beforeEach(() => {
    vi.clearAllMocks()

    // Por padrão, $transaction executa a callback passando o próprio mock como "tx"
    mockPrismaClient.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrismaClient)
    })
})

describe('Client Repository', () => {
    describe('createClientWithSubscription', () => {
        it('deve criar um client com subscription e retornar ambos', async () => {
            mockPrismaClient.plan.findUnique.mockResolvedValueOnce(mockPlanRecord)
            mockPrismaClient.client.create.mockResolvedValueOnce(mockClientRecord)
            mockCreateClientDatabase.mockResolvedValueOnce(undefined)
            mockPrismaClient.subscription.create.mockResolvedValueOnce(mockSubscriptionRecord)

            const result = await createClientWithSubscription(mockClientData)

            expect(mockPrismaClient.plan.findUnique).toHaveBeenCalledWith({
                where: { id: mockClientData.planId }
            })
            expect(mockPrismaClient.client.create).toHaveBeenCalledOnce()
            expect(mockCreateClientDatabase).toHaveBeenCalledWith(mockClientRecord.slug)
            expect(mockPrismaClient.subscription.create).toHaveBeenCalledWith({
                data: {
                    clientId: mockClientRecord.id,
                    amount: mockPlanRecord.price
                }
            })
            expect(result).toEqual({
                client: mockClientRecord,
                subscription: mockSubscriptionRecord
            })
        })

        it('deve lançar erro "Plano não encontrado" quando o plano não existir', async () => {
            mockPrismaClient.plan.findUnique.mockResolvedValueOnce(null)

            await expect(
                createClientWithSubscription(mockClientData)
            ).rejects.toThrow('Plano não encontrado')

            expect(mockPrismaClient.client.create).not.toHaveBeenCalled()
            expect(mockCreateClientDatabase).not.toHaveBeenCalled()
            expect(mockPrismaClient.subscription.create).not.toHaveBeenCalled()
        })

        it('deve propagar erro quando o Prisma falhar na criação do client', async () => {
            mockPrismaClient.plan.findUnique.mockResolvedValueOnce(mockPlanRecord)
            mockPrismaClient.client.create.mockRejectedValueOnce(new Error('DB connection failed'))

            await expect(
                createClientWithSubscription(mockClientData)
            ).rejects.toThrow('DB connection failed')

            expect(mockCreateClientDatabase).not.toHaveBeenCalled()
        })
    })

    describe('getAllClients', () => {
        it('deve retornar lista de clientes ordenada por createdAt desc', async () => {
            mockPrismaClient.client.findMany.mockResolvedValueOnce([mockClientRecord])

            const result = await getAllClients()

            expect(mockPrismaClient.client.findMany).toHaveBeenCalledWith({
                include: {
                    plan: true,
                    subscription: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            })
            expect(result).toEqual([mockClientRecord])
        })

        it('deve retornar array vazio quando não houver clientes', async () => {
            mockPrismaClient.client.findMany.mockResolvedValueOnce([])

            const result = await getAllClients()

            expect(result).toEqual([])
        })
    })

    describe('getClientById', () => {
        it('deve retornar o cliente correto para um id existente', async () => {
            mockPrismaClient.client.findUnique.mockResolvedValueOnce(mockClientRecord)

            const result = await getClientById(1)

            expect(mockPrismaClient.client.findUnique).toHaveBeenCalledWith({
                where: { id: 1 },
                include: {
                    plan: true,
                    subscription: true
                }
            })
            expect(result).toEqual(mockClientRecord)
        })

        it('deve retornar null para um id inexistente', async () => {
            mockPrismaClient.client.findUnique.mockResolvedValueOnce(null)

            const result = await getClientById(999)

            expect(result).toBeNull()
        })
    })

    describe('getClientBySlug', () => {
        it('deve retornar o cliente correto para um slug existente', async () => {
            mockPrismaClient.client.findUnique.mockResolvedValueOnce(mockClientRecord)

            const result = await getClientBySlug('empresa-teste')

            expect(mockPrismaClient.client.findUnique).toHaveBeenCalledWith({
                where: { slug: 'empresa-teste' },
                include: {
                    plan: true,
                    subscription: true
                }
            })
            expect(result).toEqual(mockClientRecord)
        })

        it('deve retornar null para um slug inexistente', async () => {
            mockPrismaClient.client.findUnique.mockResolvedValueOnce(null)

            const result = await getClientBySlug('fantasma')

            expect(result).toBeNull()
        })
    })

    describe('updateClientById', () => {
        it('deve atualizar e retornar o cliente quando ele existir', async () => {
            const updatedRecord = { ...mockClientRecord, contact: '83900000000' }

            mockPrismaClient.client.findUnique.mockResolvedValueOnce(mockClientRecord)
            mockPrismaClient.client.update.mockResolvedValueOnce(updatedRecord)

            const result = await updateClientById(1, { contact: '83900000000' })

            expect(mockPrismaClient.client.findUnique).toHaveBeenCalledWith({
                where: { id: 1 }
            })
            expect(mockPrismaClient.client.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { contact: '83900000000' }
            })
            expect(result).toEqual(updatedRecord)
        })

        it('deve lançar erro "Client não encontrada" quando o id não existir', async () => {
            mockPrismaClient.client.findUnique.mockResolvedValueOnce(null)

            await expect(
                updateClientById(999, { contact: '83900000000' })
            ).rejects.toThrow('Client não encontrada')

            expect(mockPrismaClient.client.update).not.toHaveBeenCalled()
        })

        it('deve aceitar atualização parcial dos campos', async () => {
            const updatedRecord = { ...mockClientRecord, email: 'novo@teste.com' }

            mockPrismaClient.client.findUnique.mockResolvedValueOnce(mockClientRecord)
            mockPrismaClient.client.update.mockResolvedValueOnce(updatedRecord)

            const result = await updateClientById(1, { email: 'novo@teste.com' })

            expect(result.email).toBe('novo@teste.com')
        })

        it('deve lançar erro ao tentar alterar o campo "database"', async () => {
            mockPrismaClient.client.findUnique.mockResolvedValueOnce(mockClientRecord)

            await expect(
                updateClientById(1, { database: 'novo_banco' } as any)
            ).rejects.toThrow('Não é permitido alterar o database da client')

            expect(mockPrismaClient.client.update).not.toHaveBeenCalled()
        })
    })

    describe('suspendClientById', () => {
        it('deve atualizar o status do client para "suspended"', async () => {
            const suspendedRecord = { ...mockClientRecord, status: 'suspended' }
            mockPrismaClient.client.update.mockResolvedValueOnce(suspendedRecord)

            const result = await suspendClientById(1)

            expect(mockPrismaClient.client.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { status: 'suspended' }
            })
            expect(result.status).toBe('suspended')
        })
    })

    describe('cancelClientById', () => {
        it('deve atualizar o status do client para "cancelled"', async () => {
            const cancelledRecord = { ...mockClientRecord, status: 'cancelled' }
            mockPrismaClient.client.update.mockResolvedValueOnce(cancelledRecord)

            const result = await cancelClientById(1)

            expect(mockPrismaClient.client.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { status: 'cancelled' }
            })
            expect(result.status).toBe('cancelled')
        })
    })

    describe('activeClientById', () => {
        it('deve atualizar o status do client para "active"', async () => {
            const activeRecord = { ...mockClientRecord, status: 'active' }
            mockPrismaClient.client.update.mockResolvedValueOnce(activeRecord)

            const result = await activeClientById(1)

            expect(mockPrismaClient.client.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { status: 'active' }
            })
            expect(result.status).toBe('active')
        })
    })
})