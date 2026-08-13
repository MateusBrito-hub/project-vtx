import { PrismaClient } from "@prisma/client";
import { IPlan } from "../shared/interface/plan";

const prisma = new PrismaClient()

export async function getAllPlans() {
    return await prisma.plan.findMany({
        orderBy:{
            id: 'desc'
        }
    })
}

export async function getPlanById(id: number) {
    return await prisma.plan.findUnique({
        where: { id }
    })
}

export async function createPlan(data: IPlan) {
    return await prisma.plan.create({
        data: {
            name: data.name,
            price: data.price,
            maxDocs: data.maxDocs
        }
    })
}
