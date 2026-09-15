import { PrismaClient as TenantPrismaClient } from '../../../generated/tenant-prisma/client'
import { CreateProductDTO, UpdateProductDTO } from './product.schema'

export class ProductService {
  public async create(tenantPrisma: TenantPrismaClient, data: CreateProductDTO) {
    const existing = await tenantPrisma.product.findUnique({
      where: { sku: data.sku }
    })

    if (existing) {
      const error = new Error(`Product with SKU "${data.sku}" already exists in this tenant.`)
      ;(error as any).code = 'CONFLICT'
      throw error
    }

    return tenantPrisma.product.create({
      data: {
        sku: data.sku,
        description: data.description,
        ncm: data.ncm,
        cest: data.cest ?? null,
        unit: data.unit,
        price: data.price,
        ean: data.ean ?? null,
        cfopDefault: data.cfopDefault,
        taxReformClass: data.taxReformClass,
        isSubjectToIS: data.isSubjectToIS,
        cstIbsCbsDefault: data.cstIbsCbsDefault
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
        { sku: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } }
      ]
    }

    const [total, items] = await Promise.all([
      tenantPrisma.product.count({ where }),
      tenantPrisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { description: 'asc' }
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
    const product = await tenantPrisma.product.findUnique({
      where: { id }
    })

    if (!product) {
      const error = new Error(`Product with id ${id} not found.`)
      ;(error as any).code = 'NOT_FOUND'
      throw error
    }

    return product
  }

  public async update(tenantPrisma: TenantPrismaClient, id: number, data: UpdateProductDTO) {
    await this.getById(tenantPrisma, id)

    if (data.sku) {
      const existing = await tenantPrisma.product.findUnique({
        where: { sku: data.sku }
      })
      if (existing && existing.id !== id) {
        const error = new Error(`SKU "${data.sku}" is already in use by another product.`)
        ;(error as any).code = 'CONFLICT'
        throw error
      }
    }

    return tenantPrisma.product.update({
      where: { id },
      data
    })
  }

  public async delete(tenantPrisma: TenantPrismaClient, id: number) {
    await this.getById(tenantPrisma, id)
    return tenantPrisma.product.delete({
      where: { id }
    })
  }
}

export const productService = new ProductService()