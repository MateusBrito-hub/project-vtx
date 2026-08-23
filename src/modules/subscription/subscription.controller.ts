import { Request, Response } from 'express';
import {
    activateSubscriptionById,
    createSubscription,
    getAllSubscriptions,
    getSubscriptionByClientId,
    getSubscriptionById,
    suspendSubscriptionById,
    updateSubscription
} from './subscription.service';
import { ISubscription } from './subscription.interface';

export async function registerSubscription(
    req: Request<{}, {}, ISubscription>,
    res: Response
) {
    try {
        const body  = req.body
        if (!body.clientId || !body.amount) {
            return res.status(400).json({
                error: 'clientId e amount são obrigatórios'
            })
        }
        const result = await createSubscription({
            clientId: Number(body.clientId),
            amount: Number(body.amount)
        })
        
        return res.status(201).json({
            message: 'Subscription criada com sucesso',
            data: result
        })
    } catch (error: any) {
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

export async function updateSubscriptionById(
    req: Request<{ id: string }, {}, Partial<ISubscription>>,
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

        const subscription = await getSubscriptionById(id)
        if (!subscription) {
            return res.status(404).json({
                error: 'Subscription não encontrada'
            })
        }

        const updatedSubscription = await updateSubscription(id, body)

        return res.status(200).json({
            data: updatedSubscription
        })
    } catch (error: any) {
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
