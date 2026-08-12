import { Router } from 'express'
import {
    createClient,
    getClients,
    getClient,
    updateClient
} from '../controller/client'

const router = Router()

router.post('/', createClient)
router.get('/', getClients)
router.get('/:id', getClient)
router.patch('/:id/update', updateClient)

export default router