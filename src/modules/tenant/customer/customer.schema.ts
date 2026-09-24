import { z } from 'zod'

export const createCustomerSchema = z
    .object({
        cpfCnpj: z
            .string()
            .regex(/^\d{11}$|^\d{14}$/, 'Document must be either an 11-digit CPF or a 14-digit CNPJ'),
        name: z.string().min(1, 'Name is required').max(255),
        fantasyName: z.string().max(255).optional().nullable(),
        ie: z.string().max(20).optional().nullable(),
        indicadorIe: z.union([z.literal(1), z.literal(2), z.literal(9)]).default(9),
        email: z.email('Invalid email address').optional().nullable(),
        phone: z.string().max(20).optional().nullable(),
        street: z.string().min(1, 'Street is required').max(255),
        number: z.string().min(1, 'Number is required').max(30),
        complement: z.string().max(100).optional().nullable(),
        district: z.string().min(1, 'District is required').max(100),
        cityCode: z.string().regex(/^\d{7}$/, 'City code must be a 7-digit IBGE code'),
        cityName: z.string().min(1, 'City name is required').max(100),
        uf: z
            .string()
            .length(2, 'UF must contain 2 characters')
            .transform((val) => val.toUpperCase()),
        zipCode: z.string().regex(/^\d{8}$/, 'Zip code must contain exactly 8 numeric digits')
    })
    .strict()

export const updateCustomerSchema = z
    .object({
        cpfCnpj: z.string().regex(/^\d{11}$|^\d{14}$/).optional(),
        name: z.string().min(1).max(255).optional(),
        fantasyName: z.string().max(255).optional().nullable(),
        ie: z.string().max(20).optional().nullable(),
        indicadorIe: z.union([z.literal(1), z.literal(2), z.literal(9)]).optional(),
        email: z.email().optional().nullable(),
        phone: z.string().max(20).optional().nullable(),
        street: z.string().min(1).max(255).optional(),
        number: z.string().min(1).max(30).optional(),
        complement: z.string().max(100).optional().nullable(),
        district: z.string().min(1).max(100).optional(),
        cityCode: z.string().regex(/^\d{7}$/).optional(),
        cityName: z.string().min(1).max(100).optional(),
        uf: z
            .string()
            .length(2)
            .transform((val) => val.toUpperCase())
            .optional(),
        zipCode: z.string().regex(/^\d{8}$/).optional()
    })
    .strict()

export type CreateCustomerDTO = z.infer<typeof createCustomerSchema>
export type UpdateCustomerDTO = z.infer<typeof updateCustomerSchema>