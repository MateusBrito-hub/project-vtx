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

const router = Router()

router.post('/', requireRole('SUPER_ADMIN'), createClient)
router.get('/', requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'), getClients)
router.get('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'), getClient)
router.patch('/:id/update', requireRole('SUPER_ADMIN', 'ADMIN'), updateClient)
router.patch('/:id/suspend', requireRole('SUPER_ADMIN', 'ADMIN'), suspendClient)
router.patch('/:id/cancel', requireRole('SUPER_ADMIN', 'ADMIN'), cancelClient)
router.patch('/:id/active', requireRole('SUPER_ADMIN', 'ADMIN'), activeClient)
router.get('/:slug/status', requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'), getSlug)

export default router