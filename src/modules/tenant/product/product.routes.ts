import { Router } from 'express'
import { productController } from './product.controller'

const productRoutes = Router()

productRoutes.post('/', (req, res) => productController.create(req, res))
productRoutes.get('/', (req, res) => productController.list(req, res))
productRoutes.get('/:id', (req, res) => productController.getById(req, res))
productRoutes.put('/:id', (req, res) => productController.update(req, res))
productRoutes.delete('/:id', (req, res) => productController.delete(req, res))

export default productRoutes