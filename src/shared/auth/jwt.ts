import jwt from 'jsonwebtoken'

export interface AccessTokenPayload {
    sub: number
    role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR'
}

function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET

    if (!secret) {
        throw new Error('JWT_SECRET não configurado')
    }

    return secret
}

export function generateAccessToken(
    payload: AccessTokenPayload
): string {
    return jwt.sign(
        {
            sub: payload.sub,
            role: payload.role,
        },
        getJwtSecret(),
        {
            expiresIn: '15m',
            issuer: process.env.JWT_ISSUER ?? 'project-vtx',
            algorithm: 'HS256',
        }
    )
}

export function verifyAccessToken(token: string): AccessTokenPayload {
    const decoded = jwt.verify(
        token,
        getJwtSecret(),
        {
            algorithms: ['HS256'],
            issuer: process.env.JWT_ISSUER ?? 'project-vtx',
        }
    )

    if (
        typeof decoded !== 'object' ||
        decoded === null ||
        typeof decoded.sub !== 'number' ||
        typeof decoded.role !== 'string'
    ) {
        throw new Error('Payload JWT inválido')
    }

    return {
        sub: decoded.sub,
        role: decoded.role as AccessTokenPayload['role'],
    }
}