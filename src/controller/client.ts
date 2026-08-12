import { Request, Response } from 'express'
import {
    getAllClients,
    getClientById,
    getClientByName,
    registerClient,
    updateClientById
} from '../service/client'
import { IClient } from '../shared/interface/client'
import { isString } from 'util'
import { isNumberObject, isStringObject } from 'util/types'

export async function createClient(
    req: Request<{}, {}, IClient>,
    res: Response
) {
    try {
        const body = req.body

        if (!body.name || !body.email || !body.password) {
            return res.status(400).json({
                error: 'name, email e password são obrigatórios'
            })
        }

        const result = await registerClient(body)

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
        const param = req.params.id
        const numericId = Number(param)

        if (!isNaN(numericId)) {
            const client = await getClientById(numericId)

            if (!client) {
                return res.status(404).json({
                    error: 'Client não encontrado'
                })
            }

            return res.json(client)
        }

        const client = await getClientByName(String(param))

        if (!client) {
            return res.status(404).json({
                error: 'Client não encontrado'
            })
        }

        return res.json(client)

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
            message: 'Client atualizado com sucesso',
            data: updated
        })

    } catch (error: any) {
        return res.status(400).json({
            error: error.message
        })
    }
}
