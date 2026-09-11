// src/modules/plan/plan.schema.ts
import { z } from 'zod'

/**
 * Schema estrito para criação de Planos (POST /plans).
 * Proíbe estritamente id, status ou campos não mapeados.
 */
export const createPlanSchema = z.object({
    name: z
        .string()
        .min(1, 'Nome do plano é obrigatório')
        .max(100, 'Nome do plano deve ter no máximo 100 caracteres'),

    price: z
        .number({ error: 'Preço deve ser um número' })
        .positive('Preço deve ser maior que zero'),

    maxDocs: z
        .number({ error: 'maxDocs deve ser um número inteiro' })
        .int('maxDocs deve ser um número inteiro')
        .positive('maxDocs deve ser maior que zero')
})
.strict()

/**
 * Schema estrito para atualização parcial de Planos (PATCH /plans/:id).
 * Requer ao menos um campo válido e bloqueia propriedades desconhecidas.
 */
export const updatePlanSchema = z.object({
    name: z
        .string()
        .min(1, 'Nome do plano não pode ser vazio')
        .max(100, 'Nome do plano deve ter no máximo 100 caracteres')
        .optional(),

    price: z
        .number({ error: 'Preço deve ser um número' })
        .positive('Preço deve ser maior que zero')
        .optional(),

    maxDocs: z
        .number({ error: 'maxDocs deve ser um número inteiro' })
        .int('maxDocs deve ser um número inteiro')
        .positive('maxDocs deve ser maior que zero')
        .optional()
})
.strict()
.refine(data => Object.keys(data).length > 0, {
    message: 'Ao menos um campo deve ser fornecido para atualização'
})

export type CreatePlanDTO = z.infer<typeof createPlanSchema>
export type UpdatePlanDTO = z.infer<typeof updatePlanSchema>