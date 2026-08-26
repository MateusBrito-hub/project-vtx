import { Request, Response, NextFunction } from 'express'
import { emptyBodySchema } from './common.schema'

export function validateEmptyBody(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {

        emptyBodySchema.parse(req.body)

        next()

    } catch {
        return res.status(400).json({
            error: 'Esta operação não aceita dados no body'
        })
    }
}