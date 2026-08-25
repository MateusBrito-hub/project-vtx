// src/shared/auth/role.middleware.ts

import { Request, Response, NextFunction } from 'express'

type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR'

export function requireRole(...allowedRoles: UserRole[]) {
    return (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Não autenticado',
            })
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Acesso negado',
            })
        }

        next()
    }
}