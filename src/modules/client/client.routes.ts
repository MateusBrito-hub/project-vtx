import { Router } from 'express'
import {
    createClient,
    getClients,
    getClient,
    updateClient,
    suspendClient,
    cancelClient,
    activeClient,
    getSlug
} from './client.controller'
import { requireRole } from '../../shared/auth/role.middleware'
import { validateEmptyBody } from '../../shared/validation/emptyBody.middleware'

const router = Router()

router.post('/', 
    requireRole('SUPER_ADMIN'), 
    createClient)
router.get('/', 
    requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'), 
    validateEmptyBody,
    getClients)
router.get('/:id', 
    requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'), 
    validateEmptyBody,
    getClient)
router.patch('/:id/update', 
    requireRole('SUPER_ADMIN', 'ADMIN'), 
    updateClient)
router.patch('/:id/suspend', 
    requireRole('SUPER_ADMIN', 'ADMIN'), 
    validateEmptyBody,
    suspendClient)
router.patch('/:id/cancel', 
    requireRole('SUPER_ADMIN', 'ADMIN'), 
    validateEmptyBody,
    cancelClient)
router.patch('/:id/active', 
    requireRole('SUPER_ADMIN', 'ADMIN'), 
    validateEmptyBody,
    activeClient)
router.get('/:slug/status', 
    requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'), 
    validateEmptyBody,
    getSlug)

export default router