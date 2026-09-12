import { PrismaClient as TenantPrismaClient } from '../../../generated/tenant-prisma/client'
import { CreateCompanyInput, UpdateFiscalConfigInput } from './tenant-config.schema'
import { encryptCertificateText } from '../certificate/certificate.crypto'
import { parsePfxCertificate } from '../certificate/certificate.parser'

export class TenantConfigService {
  /**
   * Retorna a matriz (headquarter) ou a primeira empresa cadastrada no tenant.
   */
  public async getTargetCompany(tenantPrisma: TenantPrismaClient, companyId?: number) {
    if (companyId) {
      const company = await tenantPrisma.company.findUnique({ where: { id: companyId } })
      if (!company) throw new Error(`Company with id ${companyId} not found.`)
      return company
    }

    const headquarter = await tenantPrisma.company.findFirst({
      where: { isHeadquarter: true }
    })

    if (headquarter) return headquarter

    const anyCompany = await tenantPrisma.company.findFirst()
    if (anyCompany) return anyCompany

    throw new Error('No company registered in tenant database. Please register a company first.')
  }

  /**
   * Lista todas as filiais e matriz da organização.
   */
  public async listCompanies(tenantPrisma: TenantPrismaClient) {
    return tenantPrisma.company.findMany({
      include: {
        fiscalConfig: {
          select: {
            environment: true,
            taxRegime: true,
            enableTaxReform: true,
            nfeSeries: true,
            nfeNextNumber: true,
            nfceSeries: true,
            nfceNextNumber: true,
            certificateExpiresAt: true,
            certificateCnpj: true
          }
        }
      },
      orderBy: { id: 'asc' }
    })
  }

  /**
   * Cadastra uma nova filial ou matriz, provisionando suas configurações fiscais padrão.
   */
  public async createCompany(tenantPrisma: TenantPrismaClient, data: CreateCompanyInput) {
    const existingCnpj = await tenantPrisma.company.findUnique({
      where: { cnpj: data.cnpj }
    })

    if (existingCnpj) {
      throw new Error(`Company with CNPJ "${data.cnpj}" already exists in this tenant.`)
    }

    // Cria a empresa e vincula a configuração fiscal inicial
    const company = await tenantPrisma.company.create({
      data: {
        cnpj: data.cnpj,
        socialName: data.socialName,
        fantasyName: data.fantasyName,
        street: data.street,
        number: data.number,
        complement: data.complement,
        district: data.district,
        cityCode: data.cityCode,
        cityName: data.cityName,
        uf: data.uf,
        zipCode: data.zipCode,
        ie: data.ie,
        im: data.im,
        phone: data.phone,
        isHeadquarter: data.isHeadquarter ?? false,
        fiscalConfig: {
          create: {
            environment: 'HOMOLOGATION',
            taxRegime: 'SIMPLES_NACIONAL',
            enableTaxReform: true,
            nfeSeries: 1,
            nfeNextNumber: 1,
            nfceSeries: 1,
            nfceNextNumber: 1
          }
        }
      },
      include: {
        fiscalConfig: true
      }
    })

    return company
  }

  /**
   * Obtém as configurações fiscais ativas da empresa.
   */
  public async getFiscalConfig(tenantPrisma: TenantPrismaClient, companyId?: number) {
    const company = await this.getTargetCompany(tenantPrisma, companyId)

    let config = await tenantPrisma.fiscalConfig.findUnique({
      where: { companyId: company.id }
    })

    if (!config) {
      config = await tenantPrisma.fiscalConfig.create({
        data: {
          companyId: company.id,
          environment: 'HOMOLOGATION',
          taxRegime: 'SIMPLES_NACIONAL',
          enableTaxReform: true
        }
      })
    }

    // Sanitiza retorno: nunca expõe binário ou senha em endpoints públicos
    return {
      companyId: company.id,
      companyName: company.socialName,
      cnpj: company.cnpj,
      environment: config.environment,
      taxRegime: config.taxRegime,
      enableTaxReform: config.enableTaxReform,
      nfeSeries: config.nfeSeries,
      nfeNextNumber: config.nfeNextNumber,
      nfceSeries: config.nfceSeries,
      nfceNextNumber: config.nfceNextNumber,
      hasCertificate: Boolean(config.certificatePfxBase64),
      certificateExpiresAt: config.certificateExpiresAt,
      certificateCnpj: config.certificateCnpj,
      cscConfigured: Boolean(config.cscIdToken && config.cscToken)
    }
  }

  /**
   * Atualiza as séries e parâmetros fiscais da filial.
   */
  public async updateFiscalConfig(
    tenantPrisma: TenantPrismaClient,
    data: UpdateFiscalConfigInput,
    companyId?: number
  ) {
    const targetId = data.companyId || companyId
    const company = await this.getTargetCompany(tenantPrisma, targetId)

    const updated = await tenantPrisma.fiscalConfig.upsert({
      where: { companyId: company.id },
      update: {
        environment: data.environment,
        taxRegime: data.taxRegime,
        enableTaxReform: data.enableTaxReform,
        nfeSeries: data.nfeSeries,
        nfeNextNumber: data.nfeNextNumber,
        nfceSeries: data.nfceSeries,
        nfceNextNumber: data.nfceNextNumber,
        cscIdToken: data.cscIdToken,
        cscToken: data.cscToken
      },
      create: {
        companyId: company.id,
        environment: data.environment ?? 'HOMOLOGATION',
        taxRegime: data.taxRegime ?? 'SIMPLES_NACIONAL',
        enableTaxReform: data.enableTaxReform ?? true,
        nfeSeries: data.nfeSeries ?? 1,
        nfeNextNumber: data.nfeNextNumber ?? 1,
        nfceSeries: data.nfceSeries ?? 1,
        nfceNextNumber: data.nfceNextNumber ?? 1,
        cscIdToken: data.cscIdToken,
        cscToken: data.cscToken
      }
    })

    return {
      message: 'Fiscal configuration updated successfully',
      companyId: company.id,
      environment: updated.environment,
      taxRegime: updated.taxRegime,
      enableTaxReform: updated.enableTaxReform,
      nfeSeries: updated.nfeSeries,
      nfeNextNumber: updated.nfeNextNumber,
      nfceSeries: updated.nfceSeries,
      nfceNextNumber: updated.nfceNextNumber
    }
  }

  /**
   * Ingestão, validação ICP-Brasil e armazenamento criptografado do certificado digital A1.
   */
  public async uploadCertificate(
    tenantPrisma: TenantPrismaClient,
    tenantSlug: string,
    certificateBase64: string,
    password: string,
    companyId?: number
  ) {
    const company = await this.getTargetCompany(tenantPrisma, companyId)

    // 1. Validação e extração ICP-Brasil
    const certInfo = parsePfxCertificate(certificateBase64, password)

    if (certInfo.isExpired) {
      throw new Error(`The provided certificate expired on ${certInfo.expiresAt.toISOString()}. Upload an active certificate.`)
    }

    // 2. Criptografia em repouso vinculada ao slug do tenant via AES-256-GCM
    const encryptedPfx = encryptCertificateText(certificateBase64, tenantSlug)
    const encryptedPassword = encryptCertificateText(password, tenantSlug)

    // 3. Persistência segura no banco do tenant
    await tenantPrisma.fiscalConfig.upsert({
      where: { companyId: company.id },
      update: {
        certificatePfxBase64: encryptedPfx,
        certificatePasswordEnc: encryptedPassword,
        certificateExpiresAt: certInfo.expiresAt,
        certificateCnpj: certInfo.cnpj
      },
      create: {
        companyId: company.id,
        certificatePfxBase64: encryptedPfx,
        certificatePasswordEnc: encryptedPassword,
        certificateExpiresAt: certInfo.expiresAt,
        certificateCnpj: certInfo.cnpj
      }
    })

    const daysUntilExpiration = Math.ceil((certInfo.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

    return {
      message: 'Certificate A1 successfully installed and encrypted',
      companyId: company.id,
      companyCnpj: company.cnpj,
      certificateCnpj: certInfo.cnpj,
      socialName: certInfo.socialName,
      expiresAt: certInfo.expiresAt,
      daysUntilExpiration
    }
  }

  /**
   * Consulta o status do certificado sem expor segredos.
   */
  public async getCertificateStatus(tenantPrisma: TenantPrismaClient, companyId?: number) {
    const company = await this.getTargetCompany(tenantPrisma, companyId)
    const config = await tenantPrisma.fiscalConfig.findUnique({
      where: { companyId: company.id }
    })

    if (!config || !config.certificatePfxBase64 || !config.certificateExpiresAt) {
      return {
        hasCertificate: false,
        companyId: company.id,
        message: 'No certificate configured for this branch'
      }
    }

    const now = Date.now()
    const expiresAt = config.certificateExpiresAt
    const isExpired = expiresAt.getTime() < now
    const daysUntilExpiration = Math.ceil((expiresAt.getTime() - now) / (1000 * 60 * 60 * 24))

    return {
      hasCertificate: true,
      companyId: company.id,
      certificateCnpj: config.certificateCnpj,
      expiresAt,
      isExpired,
      daysUntilExpiration
    }
  }
}

export const tenantConfigService = new TenantConfigService()
