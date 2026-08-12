import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    registerClient,
    getAllClients,
    getClientById,
    getClientByName,
    updateClientById,
} from '../src/service/client' // ajuste o caminho conforme sua estrutura

// ── Mock do PrismaClient ──────────────────────────────────────────────────────
// vi.mock é hoisted para o topo do arquivo pelo Vitest,
// por isso o objeto de mocks deve ser criado DENTRO do factory.
vi.mock('@prisma/client', () => {
    const clientMethods = {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
    }

    return {
        PrismaClient: function () {
            return { client: clientMethods }
        },
        // Exportamos clientMethods para poder acessá-lo nos testes
        __clientMethods: clientMethods,
    }
})

// ── Acessa os mocks após o hoisting ──────────────────────────────────────────
async function getPrismaMock() {
    const mod = await import('@prisma/client') as any
    return mod.__clientMethods as {
        create: ReturnType<typeof vi.fn>
        findMany: ReturnType<typeof vi.fn>
        findUnique: ReturnType<typeof vi.fn>
        update: ReturnType<typeof vi.fn>
    }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
const mockClientData = {
    name: 'João Silva',
    email: 'joao@email.com',
    phone: '83999990000',
    password: 'senha_hash_123',
    profilePicture: 'https://cdn.example.com/avatar.png',
    address: 'Rua das Flores, 42 – João Pessoa/PB',
}

const mockClientRecord = {
    id: 1,
    ...mockClientData,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
}

// ── Testes ────────────────────────────────────────────────────────────────────
describe('Client Repository', () => {
    let prisma: Awaited<ReturnType<typeof getPrismaMock>>

    beforeEach(async () => {
        prisma = await getPrismaMock()
        vi.clearAllMocks()
    })

    // ── registerClient ────────────────────────────────────────────────────────
    describe('registerClient', () => {
        it('deve criar um cliente e retornar o objeto criado', async () => {
            prisma.create.mockResolvedValueOnce(mockClientRecord)

            const result = await registerClient(mockClientData)

            expect(prisma.create).toHaveBeenCalledOnce()
            expect(prisma.create).toHaveBeenCalledWith({
                data: {
                    name: mockClientData.name,
                    email: mockClientData.email,
                    phone: mockClientData.phone,
                    password: mockClientData.password,
                    profilePicture: mockClientData.profilePicture,
                    address: mockClientData.address,
                },
            })
            expect(result).toEqual({ client: mockClientRecord })
        })

        it('deve propagar erro quando o Prisma falhar', async () => {
            prisma.create.mockRejectedValueOnce(new Error('DB connection failed'))

            await expect(registerClient(mockClientData)).rejects.toThrow(
                'DB connection failed'
            )
        })
    })

    // ── getAllClients ─────────────────────────────────────────────────────────
    describe('getAllClients', () => {
        it('deve retornar lista de clientes ordenada por createdAt desc', async () => {
            prisma.findMany.mockResolvedValueOnce([mockClientRecord])

            const result = await getAllClients()

            expect(prisma.findMany).toHaveBeenCalledOnce()
            expect(prisma.findMany).toHaveBeenCalledWith({
                orderBy: { createdAt: 'desc' },
            })
            expect(result).toEqual([mockClientRecord])
        })

        it('deve retornar array vazio quando não houver clientes', async () => {
            prisma.findMany.mockResolvedValueOnce([])

            const result = await getAllClients()

            expect(result).toEqual([])
        })
    })

    // ── getClientById ─────────────────────────────────────────────────────────
    describe('getClientById', () => {
        it('deve retornar o cliente correto para um id existente', async () => {
            prisma.findUnique.mockResolvedValueOnce(mockClientRecord)

            const result = await getClientById(1)

            expect(prisma.findUnique).toHaveBeenCalledWith({ where: { id: 1 } })
            expect(result).toEqual(mockClientRecord)
        })

        it('deve retornar null para um id inexistente', async () => {
            prisma.findUnique.mockResolvedValueOnce(null)

            const result = await getClientById(999)

            expect(result).toBeNull()
        })
    })

    // ── getClientByName ───────────────────────────────────────────────────────
    describe('getClientByName', () => {
        it('deve retornar o cliente correto para um nome existente', async () => {
            prisma.findUnique.mockResolvedValueOnce(mockClientRecord)

            const result = await getClientByName('João Silva')

            expect(prisma.findUnique).toHaveBeenCalledWith({
                where: { name: 'João Silva' },
            })
            expect(result).toEqual(mockClientRecord)
        })

        it('deve retornar null para um nome inexistente', async () => {
            prisma.findUnique.mockResolvedValueOnce(null)

            const result = await getClientByName('Fantasma')

            expect(result).toBeNull()
        })
    })

    // ── updateClientById ──────────────────────────────────────────────────────
    describe('updateClientById', () => {
        it('deve atualizar e retornar o cliente quando ele existir', async () => {
            const updatedRecord = { ...mockClientRecord, phone: '83988880000' }

            prisma.findUnique.mockResolvedValueOnce(mockClientRecord)
            prisma.update.mockResolvedValueOnce(updatedRecord)

            const result = await updateClientById(1, { phone: '83988880000' })

            expect(prisma.findUnique).toHaveBeenCalledWith({ where: { id: 1 } })
            expect(prisma.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { phone: '83988880000' },
            })
            expect(result).toEqual(updatedRecord)
        })

        it('deve lançar erro "Client não encontrada" quando o id não existir', async () => {
            prisma.findUnique.mockResolvedValueOnce(null)

            await expect(
                updateClientById(999, { phone: '83900000000' })
            ).rejects.toThrow('Client não encontrada')

            expect(prisma.update).not.toHaveBeenCalled()
        })

        it('deve aceitar atualização parcial dos campos', async () => {
            const partialUpdate = { address: 'Nova Rua, 99' }
            const updatedRecord = { ...mockClientRecord, ...partialUpdate }

            prisma.findUnique.mockResolvedValueOnce(mockClientRecord)
            prisma.update.mockResolvedValueOnce(updatedRecord)

            const result = await updateClientById(1, partialUpdate)

            expect(result.address).toBe('Nova Rua, 99')
        })
    })
})