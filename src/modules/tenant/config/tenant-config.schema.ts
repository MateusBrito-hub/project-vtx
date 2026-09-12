import { z } from 'zod'

export const createCompanySchema = z
  .object({
    cnpj: z.string().regex(/^\d{14}$/, 'CNPJ must contain exactly 14 numeric digits'),
    socialName: z.string().min(1, 'socialName is required').max(255),
    fantasyName: z.string().min(1, 'fantasyName is required').max(255),
    street: z.string().min(1, 'street is required').max(255),
    number: z.string().min(1, 'number is required').max(30),
    complement: z.string().max(100).optional(),
    district: z.string().min(1, 'district is required').max(100),
    cityCode: z.string().regex(/^\d{7}$/, 'cityCode must be a 7-digit IBGE code'),
    cityName: z.string().min(1, 'cityName is required').max(100),
    uf: z.string().length(2, 'UF must contain 2 letters').transform((v) => v.toUpperCase()),
    zipCode: z.string().regex(/^\d{8}$/, 'zipCode must contain exactly 8 numeric digits'),
    ie: z.string().max(20).optional(),
    im: z.string().max(20).optional(),
    phone: z.string().max(20).optional(),
    isHeadquarter: z.boolean().optional()
  })
  .strict()

export const updateFiscalConfigSchema = z
  .object({
    companyId: z.number().int().positive().optional(),
    environment: z.enum(['HOMOLOGATION', 'PRODUCTION']).optional(),
    taxRegime: z.enum(['SIMPLES_NACIONAL', 'SIMPLES_EXCESSO_SUBLIMITE', 'REGIME_NORMAL']).optional(),
    enableTaxReform: z.boolean().optional(),
    nfeSeries: z.number().int().min(1).max(999).optional(),
    nfeNextNumber: z.number().int().positive().optional(),
    nfceSeries: z.number().int().min(1).max(999).optional(),
    nfceNextNumber: z.number().int().positive().optional(),
    cscIdToken: z.string().max(10).optional(),
    cscToken: z.string().max(100).optional()
  })
  .strict()

export const uploadCertificateSchema = z
  .object({
    companyId: z.number().int().positive().optional(),
    certificateBase64: z.string().min(1, 'certificateBase64 is required'),
    password: z.string().min(1, 'password is required')
  })
  .strict()

export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateFiscalConfigInput = z.infer<typeof updateFiscalConfigSchema>
export type UploadCertificateInput = z.infer<typeof uploadCertificateSchema>
