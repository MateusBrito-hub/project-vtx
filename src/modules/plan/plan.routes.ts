import { Router } from 'express'
import {
    registerPlan,
    getPlans,
    getPlan,
    updatePlanById,
    suspendPlanById,
    activatePlanById
} from './plan.controller'
import { requireRole } from '../../shared/auth/role.middleware'

const router = Router()

router.post('/', requireRole('SUPER_ADMIN'), registerPlan)
router.get('/', requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'), getPlans)
router.get('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR'), getPlan)
router.patch('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), updatePlanById)
router.patch('/:id/suspend', requireRole('SUPER_ADMIN',), suspendPlanById)
router.patch('/:id/activate', requireRole('SUPER_ADMIN',), activatePlanById)

export default router