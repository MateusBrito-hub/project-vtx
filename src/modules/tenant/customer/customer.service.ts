import { PrismaClient as TenantPrismaClient } from '../../../generated/tenant-prisma/client'
import { CreateCustomerDTO, UpdateCustomerDTO } from './customer.schema'

export class CustomerService {
    public async create(tenantPrisma: TenantPrismaClient, data: CreateCustomerDTO) {
        const existing = await tenantPrisma.customer.findUnique({
            where: { cpfCnpj: data.cpfCnpj }
        })

        if (existing) {
            const error = new Error(`Customer with document "${data.cpfCnpj}" already exists in this tenant.`)
                ; (error as any).code = 'CONFLICT'
            throw error
        }

        return tenantPrisma.customer.create({
            data: {
                cpfCnpj: data.cpfCnpj,
                name: data.name,
                fantasyName: data.fantasyName ?? null,
                ie: data.ie ?? null,
                indicadorIe: data.indicadorIe,
                email: data.email ?? null,
                phone: data.phone ?? null,
                street: data.street,
                number: data.number,
                complement: data.complement ?? null,
                district: data.district,
                cityCode: data.cityCode,
                cityName: data.cityName,
                uf: data.uf,
                zipCode: data.zipCode
            }
        })
    }

    public async list(tenantPrisma: TenantPrismaClient, query: { search?: string; page?: number; limit?: number }) {
        const page = Math.max(1, query.page ?? 1)
        const limit = Math.min(100, Math.max(1, query.limit ?? 20))
        const skip = (page - 1) * limit

        const where: any = {}
        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: 'insensitive' } },
                { fantasyName: { contains: query.search, mode: 'insensitive' } },
                { cpfCnpj: { contains: query.search } }
            ]
        }

        const [total, items] = await Promise.all([
            tenantPrisma.customer.count({ where }),
            tenantPrisma.customer.findMany({
                where,
                skip,
                take: limit,
                orderBy: { name: 'asc' }
            })
        ])

        return {
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        }
    }

    public async getById(tenantPrisma: TenantPrismaClient, id: number) {
        const customer = await tenantPrisma.customer.findUnique({
            where: { id }
        })

        if (!customer) {
            const error = new Error(`Customer with id ${id} not found.`)
                ; (error as any).code = 'NOT_FOUND'
            throw error
        }

        return customer
    }

    public async getByDocument(tenantPrisma: TenantPrismaClient, cpfCnpj: string) {
        const customer = await tenantPrisma.customer.findUnique({
            where: { cpfCnpj }
        })

        if (!customer) {
            const error = new Error(`Customer with document ${cpfCnpj} not found.`)
                ; (error as any).code = 'NOT_FOUND'
            throw error
        }

        return customer
    }

    public async update(tenantPrisma: TenantPrismaClient, id: number, data: UpdateCustomerDTO) {
        await this.getById(tenantPrisma, id)

        if (data.cpfCnpj) {
            const existing = await tenantPrisma.customer.findUnique({
                where: { cpfCnpj: data.cpfCnpj }
            })
            if (existing && existing.id !== id) {
                const error = new Error(`Document "${data.cpfCnpj}" is already registered to another customer.`)
                    ; (error as any).code = 'CONFLICT'
                throw error
            }
        }

        return tenantPrisma.customer.update({
            where: { id },
            data
        })
    }

    public async delete(tenantPrisma: TenantPrismaClient, id: number) {
        await this.getById(tenantPrisma, id)
        return tenantPrisma.customer.delete({
            where: { id }
        })
    }
}

export const customerService = new CustomerService()