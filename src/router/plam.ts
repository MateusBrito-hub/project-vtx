import { Router } from 'express'
import {
    registerPlan,
    getPlans,
    getPlan,
    updatePlanById,
    suspendPlanById,
    activatePlanById
} from '../controller/plan'

const router = Router()

router.post('/', registerPlan)
router.get('/', getPlans)
router.get('/:id', getPlan)
router.put('/:id', updatePlanById)
router.delete('/:id', suspendPlanById)
router.patch('/:id/activate', activatePlanById)

export default router