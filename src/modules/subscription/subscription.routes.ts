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

const router = Router()

router.post('/', registerSubscription)
router.get('/', getSubscriptions)
router.get('/:id', getSubscription)
router.get('/client/:clientId', getSubscriptionByClient)
router.patch('/:id', updateSubscriptionById)
router.patch('/:id/suspend', suspendSubscription)
router.patch('/:id/activate', activateSubscription)

export default router