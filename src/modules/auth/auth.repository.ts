// src/modules/auth/auth.repository.ts

import { prisma } from '../../shared/database/prisma'

export async function findUserByEmail(email: string) {
    const userModel = (prisma as any).user

    return userModel.findUnique({
        where: {
            email: email.toLowerCase(),
        },
    })
}