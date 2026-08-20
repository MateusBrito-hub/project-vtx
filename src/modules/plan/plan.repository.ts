import { prisma } from '../../shared/database/prisma'
//import { IPlan } from '../shared/interface/plan'

export async function findByid(id: number) {
    return await prisma.plan.findUnique({
        where: { id }
    })
}