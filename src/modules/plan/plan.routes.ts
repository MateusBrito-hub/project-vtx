import { Router } from 'express'
import {
    registerPlan,
    getPlans,
    getPlan,
    updatePlanById,
    suspendPlanById,
    activatePlanById
} from './plan.controller'

const router = Router()

router.post('/', registerPlan)
router.get('/', getPlans)
router.get('/:id', getPlan)
router.patch('/:id', updatePlanById)
router.patch('/:id/suspend', suspendPlanById)
router.patch('/:id/activate', activatePlanById)

export default router