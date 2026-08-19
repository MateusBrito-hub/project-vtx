import { Request, Response } from 'express';
import {
    getAllPlans,
    getPlanById,
    createPlan,
    activatePlan,
    suspendPlan,
    updatePlan
} from '../service/plan';
import { IPlan } from '../shared/interface/plan';

export async function registerPlan(
    req: Request<{}, {}, IPlan>,
    res: Response
) {
    try {
        const body = req.body
        if (!body.name || !body.price || !body.maxDocs) {
            return res.status(400).json({
                error: 'name, price e maxDocs são obrigatórios'
            })
        }
        const result = await createPlan({
            ...body,
            price: Number(body.price),
            maxDocs: Number(body.maxDocs)
        })

        return res.status(201).json({
            message: 'Plan criado com sucesso',
            data: result
        })
    } catch (error: any) {
        console.error(error)
        return res.status(500).json({
            error: error.message || 'Erro interno'
        })
    }
}

export async function getPlans(
    req: Request,
    res: Response
) {
    try {
        const plans = await getAllPlans()
        return res.json(plans)
    } catch (error: any) {
        return res.status(500).json({
            error: error.message
        })
    }
}

export async function getPlan(
    req: Request,
    res: Response
) {
    try {
        const id = Number(req.params.id)
        if (isNaN(id)) {
            return res.status(400).json({
                error: 'ID inválido'
            })
        }

        const plan = await getPlanById(id)
        
        if (!plan) {
            return res.status(404).json({
                error: 'Plan não encontrado'
            })
        }
        return res.json(plan)
    } catch (error: any) {
        return res.status(500).json({
            error: error.message
        })
    }
}

export async function updatePlanById(
    req: Request<{ id: string }, {}, IPlan>,
    res: Response
) {
    try {
        const id = Number(req.params.id)
        if (isNaN(id)) {
            return res.status(400).json({
                error: 'ID inválido'
            })
        }

        const body = req.body
        if (!body.name || !body.price || !body.maxDocs) {
            return res.status(400).json({
                error: 'name, price e maxDocs são obrigatórios'
            })
        }

        const plan = await getPlanById(id)
        if (!plan) {
            return res.status(404).json({
                error: 'Plan não encontrado'
            })
        }

        const updatedPlan = await updatePlan(id, {
            ...body,
            price: Number(body.price),
            maxDocs: Number(body.maxDocs)
        })

        return res.json(updatedPlan)
    } catch (error: any) {
        return res.status(500).json({
            error: error.message
        })
    }
}

export async function suspendPlanById(
    req: Request<{ id: string }>,
    res: Response
) {
    try {
        const id = Number(req.params.id)
        if (isNaN(id)) {
            return res.status(400).json({
                error: 'ID inválido'
            })
        }

        const plan = await getPlanById(id)
        if (!plan) {
            return res.status(404).json({
                error: 'Plan não encontrado'
            })
        }

        const suspendedPlan = await suspendPlan(id)

        return res.json(suspendedPlan)
    } catch (error: any) {
        return res.status(500).json({
            error: error.message
        })
    }
}

export async function activatePlanById(
    req: Request<{ id: string }>,
    res: Response
) {
    try {
        const id = Number(req.params.id)
        if (isNaN(id)) {
            return res.status(400).json({
                error: 'ID inválido'
            })
        }

        const plan = await getPlanById(id)
        if (!plan) {
            return res.status(404).json({
                error: 'Plan não encontrado'
            })
        }

        const activatedPlan = await activatePlan(id)

        return res.json(activatedPlan)
    } catch (error: any) {
        return res.status(500).json({
            error: error.message
        })
    }
}
