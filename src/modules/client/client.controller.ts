import { Request, Response } from 'express';
import {
    createClientWithSubscription,
    getAllClients,
    getClientById,
    getClientBySlug,
    updateClientById,
    suspendClientById,
    cancelClientById,
    activateClientById
} from './client.service';
import { IClient } from './client.interface';

export async function createClient(
    req: Request<{}, {}, IClient>,
    res: Response
) {
    try {
        const body = req.body

        if (!body.socialName || !body.email || !body.planId) {
            return res.status(400).json({
                error: 'socialName, email e planId são obrigatórios'
            })
        }

        if(body.slug) {
            const slugRegex = /^[a-z0-9-]=$/

            if(!slugRegex.test(body.slug)) {
                return res.status(400).json({
                    error: 'Formato de slug inválido. Use apenas letras minúsculas, números e hífens sem espaços.'
                })
            }
        }

        const result = await createClientWithSubscription({
            ...body,
            planId: Number(body.planId)
        })

        return res.status(201).json({
            message: 'Client criado com sucesso',
            data: result
        })

    } catch (error: any) {
        console.error(error)

        return res.status(500).json({
            error: error.message || 'Erro interno'
        })
    }
}

export async function getClients(
    req: Request,
    res: Response
) {
    try {
        const tenants = await getAllClients()
        return res.json(tenants)
    } catch (error: any) {
        return res.status(500).json({
            error: error.message
        })
    }
}

export async function getClient(
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

        const tenant = await getClientById(id)

        if (!tenant) {
            return res.status(404).json({
                error: 'Client não encontrado'
            })
        }

        return res.json(tenant)

    } catch (error: any) {
        return res.status(500).json({
            error: error.message
        })
    }
}

export async function updateClient(
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

        const updated = await updateClientById(id, req.body)

        return res.status(200).json({
            message: 'Client atualizada com sucesso',
            data: updated
        })

    } catch (error: any) {
        return res.status(400).json({
            error: error.message
        })
    }
}

export async function suspendClient(
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

        const suspended = await suspendClientById(id)
        return res.status(200).json({
            message: 'Client suspensa com sucesso',
            data: suspended
        })

    } catch (error: any) {
        return res.status(400).json({
            error: error.message
        })
    }
}

export async function cancelClient(
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

        const canceled = await cancelClientById(id)
        return res.status(200).json({
            message: 'Client cancelada com sucesso',
            data: canceled
        })

    } catch (error: any) {
        return res.status(400).json({
            error: error.message
        })
    }
}

export async function activeClient(
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

        const active = await activateClientById(id)
        return res.status(200).json({
            message: 'Client ativada com sucesso',
            data: active
        })

    } catch (error: any) {
        return res.status(400).json({
            error: error.message
        })
    }
}

export async function getSlug(
    req: Request,
    res: Response
) {

    const slug = String(req.params.slug);

    if (!slug) return res.status(400).json({ error: 'Slug é obrigatório' });
    
    const tenant = await getClientBySlug(slug);

    if (!tenant) return res.status(404).json({ error: 'Not found' });

    res.json({
        slug: tenant.slug,
        name: tenant.socialName,
        status: tenant.status,
        plan: tenant.plan
    })
}