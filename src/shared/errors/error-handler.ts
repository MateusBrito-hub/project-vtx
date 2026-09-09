// src/shared/errors/error-handler.ts
import { Response } from 'express'
import { ZodError } from 'zod'

export const INTERNAL_ERROR_MESSAGE = 'Erro interno do servidor'

/**
 * Trata erros internos inesperados (500).
 * Garante que o erro real seja registrado no console do servidor
 * e que o cliente receba apenas uma mensagem genérica e segura.
 */
export function handleInternalError(res: Response, error: unknown): Response {
    console.error('[Internal Error]:', error)
    return res.status(500).json({
        error: INTERNAL_ERROR_MESSAGE,
    })
}

/**
 * Trata erros de validação do Zod (400) com mensagens amigáveis.
 */
export function handleZodError(res: Response, error: ZodError): Response {
    return res.status(400).json({
        error: 'Erro de validação',
        details: error.flatten().fieldErrors,
        issues: error.issues.map(i => i.message),
    })
}