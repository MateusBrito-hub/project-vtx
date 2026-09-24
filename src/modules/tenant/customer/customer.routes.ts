import { Router } from 'express'
import { customerController } from './customer.controller'
const customerRoutes = Router()

customerRoutes.post('/', (req, res) => customerController.create(req, res))
customerRoutes.get('/', (req, res) => customerController.list(req, res))
customerRoutes.get('/:id', (req, res) => customerController.getById(req, res))
customerRoutes.put('/:id', (req, res) => customerController.update(req, res))
customerRoutes.delete('/:id', (req, res) => customerController.delete(req, res))

export default customerRoutes