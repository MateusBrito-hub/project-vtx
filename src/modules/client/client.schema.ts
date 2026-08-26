import { z } from 'zod'

/**
 * Campos utilizados durante a criação do Client.
 *
 * Alguns campos, como status e createdAt, não aparecem aqui
 * porque são controlados pelo sistema.
 */
export const createClientSchema = z.object({
    socialName: z.string().min(1, 'Razão social é obrigatória'),

    fantasyName: z.string().min(1, 'Nome fantasia é obrigatório'),

    CPF_CNPJ: z
        .string()
        .min(11, 'CPF/CNPJ inválido'),

    IE: z.string().optional(),

    IM: z.string().optional(),

    owner: z.string().min(1, 'Proprietário é obrigatório'),

    ownerDocument: z
        .string()
        .min(11, 'Documento do proprietário inválido'),

    address: z.string().min(1, 'Endereço é obrigatório'),

    district: z.string().min(1, 'Bairro é obrigatório'),

    complement: z.string().optional(),

    UF: z
        .string()
        .length(2, 'UF deve possuir 2 caracteres')
        .toUpperCase(),

    zipCode: z
        .string()
        .min(8, 'CEP inválido'),

    slug: z
        .string()
        .min(3)
        .max(63)
        .regex(
            /^[a-z0-9-]+$/,
            'Slug deve conter apenas letras minúsculas, números e hífens'
        ),

    contact: z.string().min(1, 'Contato é obrigatório'),

    email: z
        .string()
        .email('Email inválido'),

    planId: z
        .number()
        .int()
        .positive()
})
.strict()


/**
 * Campos permitidos na atualização.
 *
 * Perceba que:
 *
 * - id não pode ser alterado
 * - planId não pode ser alterado aqui
 * - status não pode ser alterado aqui
 * - slug não pode ser alterado aqui
 * - database não existe
 */
export const updateClientSchema = z.object({
    socialName: z
        .string()
        .min(1)
        .optional(),

    fantasyName: z
        .string()
        .min(1)
        .optional(),

    CPF_CNPJ: z
        .string()
        .min(11)
        .optional(),

    IE: z
        .string()
        .optional(),

    IM: z
        .string()
        .optional(),

    owner: z
        .string()
        .min(1)
        .optional(),

    ownerDocument: z
        .string()
        .min(11)
        .optional(),

    address: z
        .string()
        .min(1)
        .optional(),

    district: z
        .string()
        .min(1)
        .optional(),

    complement: z
        .string()
        .optional(),

    UF: z
        .string()
        .length(2)
        .toUpperCase()
        .optional(),

    zipCode: z
        .string()
        .min(8)
        .optional(),

    contact: z
        .string()
        .min(1)
        .optional(),

    email: z
        .string()
        .email()
        .optional()
})
.strict()


/**
 * Operações de alteração de status não precisam receber
 * dados arbitrários.
 */
export const emptyBodySchema = z
    .object({})
    .strict()


export type CreateClientDTO =
    z.infer<typeof createClientSchema>

export type UpdateClientDTO =
    z.infer<typeof updateClientSchema>