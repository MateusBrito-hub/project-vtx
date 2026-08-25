import { prisma } from '../../shared/database/prisma'
import { IClient } from './client.interface'
import { Prisma } from '@prisma/client'

export class ClientRepository {

    async create(tx: Prisma.TransactionClient, data: IClient) {
        return await tx.client.create({
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
    }
    
    async findAll() {
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
    
    async findById(id: number) {
        return await prisma.client.findUnique({
            where: { id },
            include: {
                plan: true,
                subscription: true
            }
        })
    }
    
    async findBySlug(slug: string) {
        return await prisma.client.findUnique({
            where: { slug },
            include: {
                plan: true,
                subscription: true
            }
        })
    }
    
    async updateById(id: number, data: Partial<IClient>) {
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
    
    async suspendById(id: number) {
        return await prisma.client.update({
            where: { id },
            data: {
                status: 'suspended'
            }
        })
    }
    
    async cancelById(id: number) {
        return await prisma.client.update({
            where: { id },
            data: {
                status: 'canceled'
            }
        })
    }
    
    async activateById(id: number) {
        return await prisma.client.update({
            where: { id },
            data: {
                status: 'active'
            }
        })
    }
}

