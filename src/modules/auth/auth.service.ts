// src/modules/auth/auth.service.ts

import bcrypt from 'bcryptjs'

import { findUserByEmail } from './auth.repository'
import { generateAccessToken } from '../../shared/auth/jwt'

export async function authenticate(
    email: string,
    password: string
) {
    const user = await findUserByEmail(email)

    // Não diferenciamos "email inexistente"
    // de "senha incorreta".
    if (!user) {
        throw new Error('INVALID_CREDENTIALS')
    }

    if (!user.active) {
        throw new Error('USER_INACTIVE')
    }

    const passwordMatches = await bcrypt.compare(
        password,
        user.passwordHash
    )

    if (!passwordMatches) {
        throw new Error('INVALID_CREDENTIALS')
    }

    const token = generateAccessToken({
        sub: user.id,
        role: user.role,
    })

    return {
        accessToken: token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        },
    }
}