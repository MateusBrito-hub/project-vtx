// src/shared/config/cors.ts

import { Request, Response, NextFunction } from 'express'
import cors, { CorsOptions } from 'cors'

/**
 * Obtém a lista de origens permitidas baseando-se no ambiente e nas variáveis de configuração.
 */
export function getAllowedOrigins(): string[] {
    const envOrigins = process.env.CORS_ALLOWED_ORIGINS

    if (envOrigins) {
        return envOrigins
            .split(',')
            .map((origin) => origin.trim())
            .filter((origin) => origin.length > 0)
    }

    // Em ambiente de desenvolvimento / teste, fallback seguro para portas locais comuns
    if (process.env.NODE_ENV !== 'production') {
        return [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:8080',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:5173',
            'http://127.0.0.1:8080',
        ]
    }

    // Em produção, exige configuração explícita via variável de ambiente
    return []
}

/**
 * Verifica se a origem enviada é permitida.
 * Requisições sem o cabeçalho Origin (mobile apps, curl, server-to-server) são permitidas.
 */
export function isOriginAllowed(
    origin: string | undefined,
    allowedOrigins: string[]
): boolean {
    if (!origin) {
        return true
    }

    return allowedOrigins.includes(origin)
}

/**
 * Gera as opções do pacote cors de forma dinâmica.
 */
export function getCorsOptions(): CorsOptions {
    const allowedOrigins = getAllowedOrigins()

    return {
        origin: (requestOrigin, callback) => {
            if (isOriginAllowed(requestOrigin, allowedOrigins)) {
                callback(null, true)
            } else {
                callback(null, false)
            }
        },
        credentials: process.env.CORS_CREDENTIALS === 'true',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        maxAge: 86400, // 24 horas de cache para preflight requests
    }
}

/**
 * Middleware de CORS com bloqueio explícito (HTTP 403) para origens não autorizadas
 * e aplicação dos cabeçalhos seguros para origens autorizadas.
 */
export const corsMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const origin = req.headers.origin
    const allowedOrigins = getAllowedOrigins()

    if (origin && !isOriginAllowed(origin, allowedOrigins)) {
        return res.status(403).json({
            error: 'Origem não permitida pela política de CORS.',
        })
    }

    return cors(getCorsOptions())(req, res, next)
}
