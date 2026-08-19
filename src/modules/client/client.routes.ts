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

const router = Router()

router.post('/', createClient)
router.get('/', getClients)
router.get('/:id', getClient)
router.patch('/:id/update', updateClient)
router.patch('/:id/suspend', suspendClient)
router.patch('/:id/cancel', cancelClient)
router.patch('/:id/active', activeClient)
router.get('/:slug/status', getSlug)

export default router