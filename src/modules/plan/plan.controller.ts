import { Request, Response } from 'express';
import {
    getAllPlans,
    getPlanById,
    createPlan,
    activatePlan,
    suspendPlan,
    updatePlan
} from './plan.service';
import { createPlanSchema, updatePlanSchema } from './plan.schema'
import { handleInternalError, handleZodError } from '../../shared/errors/error-handler';
import { ZodError } from 'zod';

export async function registerPlan(
    req: Request,
    res: Response
) {
    try {
        const data = createPlanSchema.parse(req.body)

        const result = await createPlan(data)

        return res.status(201).json({
            message: 'Plan criado com sucesso',
            data: result
        })
    } catch (error: any) {
        if (error instanceof ZodError) {
            return handleZodError(res, error)
        }
        return handleInternalError(res, error)
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
        if (error instanceof ZodError) {
            return handleZodError(res, error)
        }
        return handleInternalError(res, error)
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

        const result = await getPlanById(id)

        if (!result) {
            return res.status(404).json({
                error: 'Plan não encontrado'
            })
        }
        return res.status(200).json({
            data: result
        })
    } catch (error: any) {
        if (error instanceof ZodError) {
            return handleZodError(res, error)
        }
        return handleInternalError(res, error)
    }
}

export async function updatePlanById(
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

        const data = updatePlanSchema.parse(req.body)

        const plan = await getPlanById(id)
        if (!plan) {
            return res.status(404).json({
                error: 'Plan não encontrado'
            })
        }

        const updatedPlan = await updatePlan(id, data)

        return res.json(updatedPlan)
    } catch (error: any) {
        if (error instanceof ZodError) {
            return handleZodError(res, error)
        }
        return handleInternalError(res, error)
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
        if (error instanceof ZodError) {
            return handleZodError(res, error)
        }
        return handleInternalError(res, error)
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
        if (error instanceof ZodError) {
            return handleZodError(res, error)
        }
        return handleInternalError(res, error)
    } 
}
