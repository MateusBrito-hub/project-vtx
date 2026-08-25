// src/modules/auth/auth.repository.ts

import { prisma } from '../../shared/database/prisma'

export async function findUserByEmail(email: string) {
    return prisma.user.findUnique({
        where: {
            email: email.toLowerCase(),
        },
    })
}