import { Router } from 'express'
import { tenantMiddleware } from './tenant.middleware'
import tenantConfigRoutes from './config/tenant-config.routes'
import productRoutes from './product/product.routes'

const tenantRoutes = Router()

// O middleware de subdomínio/X-Tenant-Slug é aplicado uma única vez para TODOS os módulos do tenant
tenantRoutes.use(tenantMiddleware)

// Submódulos integrados sob o roteador do tenant:
tenantRoutes.use('/', tenantConfigRoutes)        // expõe /companies, /fiscal/config, /fiscal/certificate
tenantRoutes.use('/products', productRoutes)     // expõe /products

export default tenantRoutes