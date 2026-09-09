// src/modules/subscription/subscription.schema.ts
import { z } from 'zod'

/**
 * Campos utilizados durante a criação de uma Subscription.
 *
 * Campos como 'status' e 'startDate' não aparecem aqui porque
 * são inicializados pelo sistema com valores padrão.
 */
export const createSubscriptionSchema = z.object({
    clientId: z
        .number({
            error: 'O ID do cliente deve ser um número',
        })
        .int('O ID do cliente deve ser um número inteiro')
        .positive('O ID do cliente deve ser positivo'),
    amount: z
        .number({
            error: 'O valor deve ser um número',
        })
        .positive('O valor deve ser maior que zero'),
})
    .strict()
export type CreateSubscriptionDTO = z.infer<typeof createSubscriptionSchema>

/**
 * Schema estrito para atualização de Assinatura.
 * Pela regra de negócio, apenas o valor (amount) pode ser alterado via PATCH direto.
 * Mudanças de status devem ocorrer via endpoints dedicados (/suspend, /activate).
 * O clientId não pode ser transferido.
 */
export const updateSubscriptionSchema = z.object({
    amount: z
        .number({
            error: 'Amount deve ser um número',
        })
        .positive('Amount deve ser um valor maior que zero')
        .optional(),
})
    .strict()
    .refine(data => Object.keys(data).length > 0, {
        message: 'Pelo menos um campo válido deve ser fornecido para atualização'
    })

export type UpdateSubscriptionDTO = z.infer<typeof updateSubscriptionSchema>