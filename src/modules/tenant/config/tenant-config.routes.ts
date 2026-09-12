import { Router } from 'express'
import { tenantConfigController } from './tenant-config.controller'
import { tenantMiddleware } from '../tenant.middleware'

const tenantRoutes = Router()

// Todas as rotas do tenant passam obrigatoriamente pela resolução de subdomínio/X-Tenant-Slug
tenantRoutes.use(tenantMiddleware)

// Gestão de Filiais e Matriz
tenantRoutes.get('/companies', (req, res) => tenantConfigController.listCompanies(req, res))
tenantRoutes.post('/companies', (req, res) => tenantConfigController.createCompany(req, res))

// Configuração Fiscal e Reforma Tributária
tenantRoutes.get('/fiscal/config', (req, res) => tenantConfigController.getFiscalConfig(req, res))
tenantRoutes.put('/fiscal/config', (req, res) => tenantConfigController.updateFiscalConfig(req, res))

// Certificado Digital A1
tenantRoutes.post('/fiscal/certificate', (req, res) => tenantConfigController.uploadCertificate(req, res))
tenantRoutes.get('/fiscal/certificate/status', (req, res) => tenantConfigController.getCertificateStatus(req, res))

export default tenantRoutes
