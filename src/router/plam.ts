import { Router } from 'express'
import {
    createPlanController,
    getPlans,
    getPlan
} from '../controller/plan'

const router = Router()

router.post('/', createPlanController)
router.get('/', getPlans)
router.get('/:id', getPlan)

export default router