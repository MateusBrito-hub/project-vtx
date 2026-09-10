// src/shared/auth/auth.middleware.ts

import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from './jwt'
import { isTokenRevoked } from './token-blacklist'

export interface AuthenticatedUser {
    id: number
    role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR'
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser
            token?: string
        }
    }
}

export function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const authorization = req.headers.authorization

        if (!authorization) {
            return res.status(401).json({
                error: 'Token não informado',
            })
        }

        if (!authorization.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Formato de autorização inválido',
            })
        }

        const token = authorization.substring(7)

        if (isTokenRevoked(token)) {
            return res.status(401).json({
                error: 'Token revogado',
            })
        }

        const payload = verifyAccessToken(token)

        req.user = {
            id: payload.sub,
            role: payload.role,
        }
        req.token = token

        return next()
    } catch {
        return res.status(401).json({
            error: 'Token inválido ou expirado',
        })
    }
}