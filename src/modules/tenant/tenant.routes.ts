import { Router } from 'express'
import { tenantMiddleware } from './tenant.middleware'
import tenantConfigRoutes from './config/tenant-config.routes'
import productRoutes from './product/product.routes'
import customerRoutes from './customer/customer.routes'
import { quotaService } from './fiscal/quota.service'

const tenantRoutes = Router()

// O middleware de subdomínio/X-Tenant-Slug é aplicado uma única vez para TODOS os módulos do tenant
tenantRoutes.use(tenantMiddleware)

// Endpoint de auditoria de cota fiscal
tenantRoutes.get('/fiscal/quota', async (req, res) => {
    try {
        const quota = await quotaService.checkEmissionQuota(req.tenantSlug!, req.tenantPrisma!)
        return res.status(200).json(quota)
    } catch (err: any) {
        return res.status(500).json({ error: err.message })
    }
})

// Submódulos integrados sob o roteador do tenant:
tenantRoutes.use('/', tenantConfigRoutes)           // expõe /companies, /fiscal/config, /fiscal/certificate
tenantRoutes.use('/products', productRoutes)        // expõe /products
tenantRoutes.use('/customers', customerRoutes)     // expõe /customers

export default tenantRoutes