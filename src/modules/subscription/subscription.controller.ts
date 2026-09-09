import { Request, Response } from 'express';
import {
    activateSubscriptionById,
    createSubscription,
    getAllSubscriptions,
    getSubscriptionByClientId,
    getSubscriptionById,
    suspendSubscriptionById,
    updateSubscriptionById
} from './subscription.service';
import { ZodError } from 'zod'
import { createSubscriptionSchema, updateSubscriptionSchema } from './subscription.schema'

export async function registerSubscription(
    req: Request,
    res: Response
) {
    try {
        // Validação estrita em runtime
        const data = createSubscriptionSchema.parse(req.body)
        const result = await createSubscription(data)
        
        return res.status(201).json({
            message: 'Subscription criada com sucesso',
            data: result
        })
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: 'Erro de validação',
                details: error.flatten().fieldErrors,
                issues: error.issues.map(i => i.message)
            })
        }
        console.error(error)
        return res.status(500).json({
            error: error.message || 'Erro interno'
        })
    }
}

export async function getSubscriptions(
    req: Request,
    res: Response
) {
    try {
        const result = await getAllSubscriptions()
        return res.status(200).json({
            data: result
        })
    } catch (error: any) {
        console.error(error)
        return res.status(500).json({
            error: error.message || 'Erro interno'
        })
    }
}

export async function getSubscription(
    req: Request,
    res: Response
) {
    try {
        const id  = Number(req.params.id)
        if (isNaN(id)) {
            return res.status(400).json({
                error: 'ID inválido'
            })
        }
        
        const result = await getSubscriptionById(id)
        
        if (!result) {
            return res.status(404).json({
                error: 'Subscription não encontrada'
            })
        }
        return res.status(200).json({
            data: result
        })
    } catch (error: any) {
        console.error(error)
        return res.status(500).json({
            error: error.message || 'Erro interno'
        })
    }
}

export async function getSubscriptionByClient(
    req: Request,
    res: Response
) {
    try {
        const clientId = Number(req.params.clientId)
        if (isNaN(clientId)) {
            return res.status(400).json({
                error: 'Client ID inválido'
            })
        }

        const result = await getSubscriptionByClientId(clientId)

        if (!result) {
            return res.status(404).json({
                error: 'Subscription não encontrada'
            })
        }

        return res.status(200).json({
            data: result
        })
    } catch (error: any) {
        console.error(error)
        return res.status(500).json({
            error: error.message || 'Erro interno'
        })
    }
}

export async function updateSubscription(
    req: Request<{ id: string }>,
    res: Response
) {
    try {
        const id = Number(req.params.id)
        if (isNaN(id)) {
            return res.status(400).json({ error: 'ID inválido' })
        }
        // 1. Validação em tempo de execução com Zod (.strict())
        const data = updateSubscriptionSchema.parse(req.body)
        // 2. Verifica existência prévia
        const subscription = await getSubscriptionById(id)
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription não encontrada' })
        }
        // 3. Atualização segura apenas com campos validados
        const updatedSubscription = await updateSubscriptionById(id, data)
        return res.status(200).json({
            message: 'Subscription atualizada com sucesso',
            data: updatedSubscription
        })
    } catch (error: any) {
        // Trata erro de validação do Zod como HTTP 400 amigável
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: 'Erro de validação',
                details: error.flatten().fieldErrors,
                issues: error.issues.map(i => i.message)
            })
        }
        console.error(error)
        return res.status(500).json({
            error: error.message || 'Erro interno'
        })
    }
}

export async function suspendSubscription(
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

        const subscription = await getSubscriptionById(id)
        if (!subscription) {
            return res.status(404).json({
                error: 'Subscription não encontrada'
            })
        }

        const suspendedSubscription = await suspendSubscriptionById(id)

        return res.status(200).json({
            data: suspendedSubscription
        })
    } catch (error: any) {
        console.error(error)
        return res.status(500).json({
            error: error.message || 'Erro interno'
        })
    }
}

export async function activateSubscription(
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

        const subscription = await getSubscriptionById(id)
        if (!subscription) {
            return res.status(404).json({
                error: 'Subscription não encontrada'
            })
        }
        const activatedSubscription = await activateSubscriptionById(id)
        return res.status(200).json({
            data: activatedSubscription
        })
    } catch (error: any) {
        console.error(error)
        return res.status(500).json({
            error: error.message || 'Erro interno'
        })
    }
}
