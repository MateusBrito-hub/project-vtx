import { z } from 'zod'

export const taxReformClassEnum = z.enum([
  'PADRAO',
  'REDUZIDA_60',
  'REDUZIDA_30',
  'CESTA_BASICA_ISENTA',
  'IMPOSTO_SELETIVO',
  'IMUNE_ISENTO'
])

export const createProductSchema = z
  .object({
    sku: z.string().min(1, 'SKU is required').max(60),
    description: z.string().min(1, 'Description is required').max(255),
    ncm: z.string().regex(/^\d{8}$/, 'NCM must contain exactly 8 numeric digits'),
    cest: z.string().regex(/^\d{7}$/, 'CEST must contain exactly 7 numeric digits').optional().nullable(),
    unit: z.string().min(1, 'Unit is required').max(6),
    price: z.number().positive('Price must be greater than zero'),
    ean: z.string().max(14).optional().nullable(),
    cfopDefault: z.string().regex(/^\d{4}$/, 'CFOP must contain exactly 4 numeric digits').default('5102'),
    taxReformClass: taxReformClassEnum.optional().default('PADRAO'),
    isSubjectToIS: z.boolean().optional().default(false),
    cstIbsCbsDefault: z.string().regex(/^\d{2}$/, 'CST must contain 2 numeric digits').optional().default('01')
  })
  .strict()

export const updateProductSchema = z
  .object({
    sku: z.string().min(1).max(60).optional(),
    description: z.string().min(1).max(255).optional(),
    ncm: z.string().regex(/^\d{8}$/).optional(),
    cest: z.string().regex(/^\d{7}$/).optional().nullable(),
    unit: z.string().min(1).max(6).optional(),
    price: z.number().positive().optional(),
    ean: z.string().max(14).optional().nullable(),
    cfopDefault: z.string().regex(/^\d{4}$/).optional(),
    taxReformClass: taxReformClassEnum.optional(),
    isSubjectToIS: z.boolean().optional(),
    cstIbsCbsDefault: z.string().regex(/^\d{2}$/).optional()
  })
  .strict()

export type CreateProductDTO = z.infer<typeof createProductSchema>
export type UpdateProductDTO = z.infer<typeof updateProductSchema>