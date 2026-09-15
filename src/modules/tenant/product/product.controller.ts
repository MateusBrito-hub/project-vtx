import { Request, Response } from 'express'
import { productService } from './product.service'
import { createProductSchema, updateProductSchema } from './product.schema'

export class ProductController {
  public async create(req: Request, res: Response): Promise<any> {
    try {
      const validated = createProductSchema.parse(req.body)
      const product = await productService.create(req.tenantPrisma!, validated)
      return res.status(201).json(product)
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation error', details: err.issues })
      }
      if (err.code === 'CONFLICT') {
        return res.status(409).json({ error: err.message })
      }
      return res.status(400).json({ error: err.message })
    }
  }

  public async list(req: Request, res: Response): Promise<any> {
    try {
      const search = req.query.search ? String(req.query.search) : undefined
      const page = req.query.page ? Number(req.query.page) : 1
      const limit = req.query.limit ? Number(req.query.limit) : 20

      const result = await productService.list(req.tenantPrisma!, { search, page, limit })
      return res.status(200).json(result)
    } catch (err: any) {
      return res.status(500).json({ error: err.message })
    }
  }

  public async getById(req: Request, res: Response): Promise<any> {
    try {
      const id = Number(req.params.id)
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid product id' })
      }
      const product = await productService.getById(req.tenantPrisma!, id)
      return res.status(200).json(product)
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return res.status(404).json({ error: err.message })
      }
      return res.status(500).json({ error: err.message })
    }
  }

  public async update(req: Request, res: Response): Promise<any> {
    try {
      const id = Number(req.params.id)
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid product id' })
      }
      const validated = updateProductSchema.parse(req.body)
      const product = await productService.update(req.tenantPrisma!, id, validated)
      return res.status(200).json(product)
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation error', details: err.issues })
      }
      if (err.code === 'CONFLICT') {
        return res.status(409).json({ error: err.message })
      }
      if (err.code === 'NOT_FOUND') {
        return res.status(404).json({ error: err.message })
      }
      return res.status(400).json({ error: err.message })
    }
  }

  public async delete(req: Request, res: Response): Promise<any> {
    try {
      const id = Number(req.params.id)
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid product id' })
      }
      await productService.delete(req.tenantPrisma!, id)
      return res.status(204).send()
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return res.status(404).json({ error: err.message })
      }
      return res.status(500).json({ error: err.message })
    }
  }
}

export const productController = new ProductController()