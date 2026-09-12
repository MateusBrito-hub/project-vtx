import { Request, Response } from 'express'
import { tenantConfigService } from './tenant-config.service'
import {
  createCompanySchema,
  updateFiscalConfigSchema,
  uploadCertificateSchema
} from './tenant-config.schema'

export class TenantConfigController {
  public async listCompanies(req: Request, res: Response): Promise<any> {
    try {
      const companies = await tenantConfigService.listCompanies(req.tenantPrisma!)
      return res.status(200).json(companies)
    } catch (err: any) {
      return res.status(500).json({ error: err.message })
    }
  }

  public async createCompany(req: Request, res: Response): Promise<any> {
    try {
      const validated = createCompanySchema.parse(req.body)
      const company = await tenantConfigService.createCompany(req.tenantPrisma!, validated)
      return res.status(201).json(company)
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation error', details: err.issues })
      }
      return res.status(400).json({ error: err.message })
    }
  }

  public async getFiscalConfig(req: Request, res: Response): Promise<any> {
    try {
      const companyId = req.query.companyId ? Number(req.query.companyId) : undefined
      const config = await tenantConfigService.getFiscalConfig(req.tenantPrisma!, companyId)
      return res.status(200).json(config)
    } catch (err: any) {
      return res.status(404).json({ error: err.message })
    }
  }

  public async updateFiscalConfig(req: Request, res: Response): Promise<any> {
    try {
      const validated = updateFiscalConfigSchema.parse(req.body)
      const companyId = req.query.companyId ? Number(req.query.companyId) : undefined
      const result = await tenantConfigService.updateFiscalConfig(req.tenantPrisma!, validated, companyId)
      return res.status(200).json(result)
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation error', details: err.issues })
      }
      return res.status(400).json({ error: err.message })
    }
  }

  public async uploadCertificate(req: Request, res: Response): Promise<any> {
    try {
      const validated = uploadCertificateSchema.parse(req.body)
      const result = await tenantConfigService.uploadCertificate(
        req.tenantPrisma!,
        req.tenantSlug!,
        validated.certificateBase64,
        validated.password,
        validated.companyId
      )
      return res.status(200).json(result)
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation error', details: err.issues })
      }
      return res.status(400).json({ error: err.message })
    }
  }

  public async getCertificateStatus(req: Request, res: Response): Promise<any> {
    try {
      const companyId = req.query.companyId ? Number(req.query.companyId) : undefined
      const status = await tenantConfigService.getCertificateStatus(req.tenantPrisma!, companyId)
      return res.status(200).json(status)
    } catch (err: any) {
      return res.status(404).json({ error: err.message })
    }
  }
}

export const tenantConfigController = new TenantConfigController()
