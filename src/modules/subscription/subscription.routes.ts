import { Router } from 'express'
import {
    registerSubscription,
    getSubscriptions,
    getSubscription,
    updateSubscriptionById,
    suspendSubscription,
    activateSubscription,
    getSubscriptionByClient
} from './subscription.controller'
import { requireRole } from '../../shared/auth/role.middleware'

const router = Router()

router.post('/', requireRole('SUPER_ADMIN'), registerSubscription)
router.get('/', requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'), getSubscriptions)
router.get('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'), getSubscription)
router.get('/client/:clientId', requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'), getSubscriptionByClient)
router.patch('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), updateSubscriptionById)
router.patch('/:id/suspend', requireRole('SUPER_ADMIN'), suspendSubscription)
router.patch('/:id/activate', requireRole('SUPER_ADMIN'), activateSubscription)

export default router