// src/modules/auth/auth.controller.ts

import { Request, Response } from 'express'
import { authenticate } from './auth.service'
import { revokeToken } from '../../shared/auth/token-blacklist'

export async function login(
    req: Request,
    res: Response
) {
    try {
        const { email, password } = req.body

        if (
            typeof email !== 'string' ||
            typeof password !== 'string'
        ) {
            return res.status(400).json({
                error: 'Email e senha são obrigatórios',
            })
        }

        const result = await authenticate(
            email.trim(),
            password
        )

        return res.status(200).json(result)
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === 'USER_INACTIVE'
        ) {
            return res.status(403).json({
                error: 'Usuário inativo',
            })
        }

        return res.status(401).json({
            error: 'Credenciais inválidas',
        })
    }
}

export async function logout(
    req: Request,
    res: Response
) {
    if (req.token) {
        revokeToken(req.token)
    }
    return res.status(200).json({
        message: 'Logout realizado com sucesso',
    })
}