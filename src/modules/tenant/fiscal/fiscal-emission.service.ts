import { PrismaClient as TenantPrismaClient } from '../../../generated/tenant-prisma/client'
import { quotaService } from './quota.service'
import { tenantConfigService } from '../config/tenant-config.service'
import { decryptCertificateText } from '../certificate/certificate.crypto'
import { parsePfxCertificate } from '../certificate/certificate.parser'
import { buildNFeXml } from './engine/nfe-builder'
import { buildNFCeXml } from './engine/nfce-builder'
import { signXml } from './engine/xml-signer'
import { assertValidFiscalXml } from './engine/xsd-validator'

export interface EmitFiscalDocumentInput {
    companyId?: number
    model: '55' | '65'
    naturezaOp?: string
    tipoOp?: number
    customerId?: number
    customer?: {
        cpfCnpj: string
        name: string
        indicadorIe?: number
        ie?: string
        email?: string
        street?: string
        number?: string
        district?: string
        cityCode?: string
        cityName?: string
        uf?: string
        zipCode?: string
    }
    items: Array<{
        productId?: number
        sku: string
        description: string
        ncm: string
        cfop: string
        unit: string
        quantity: number
        unitPrice: number
        discount?: number
        taxReformClass?: 'PADRAO' | 'REDUZIDA_60' | 'REDUZIDA_30' | 'CESTA_BASICA_ISENTA' | 'IMPOSTO_SELETIVO' | 'IMUNE_ISENTO'
        isSubjectToIS?: boolean
        cstIbsCbs?: string
    }>
    payments: Array<{
        tPag: string
        vPag: number
        cardCnpj?: string
        cardBrand?: string
        cardAuth?: string
    }>
    vTroco?: number
    isContingency?: boolean
    contingencyReason?: string
    infCpl?: string
}

export interface FiscalEmissionResult {
    documentId: number
    accessKey: string
    model: '55' | '65'
    series: number
    number: number
    status: string
    totalInvoice: number
    totalIbs: number
    totalCbs: number
    totalIS: number
    xmlSigned: string
    qrCodeUrl?: string
}

export class FiscalEmissionService {
    /**
     * Orquestra a emissão atômica de NF-e ou NFC-e no tenant.
     */
    public async emit(
        tenantSlug: string,
        tenantPrisma: TenantPrismaClient,
        input: EmitFiscalDocumentInput
    ): Promise<FiscalEmissionResult> {
        // 1. Validação de Quota Mensal do Plano (assertEmissionQuota)
        await quotaService.assertEmissionQuota(tenantSlug, tenantPrisma)

        // 2. Resolução da Empresa e Configuração Fiscal
        const company = await tenantConfigService.getTargetCompany(tenantPrisma, input.companyId)
        const fiscalConfig = await tenantPrisma.fiscalConfig.findUnique({
            where: { companyId: company.id }
        })

        if (!fiscalConfig) {
            throw new Error(`Fiscal configuration not found for company ${company.socialName} (id ${company.id}).`)
        }

        if (!fiscalConfig.certificatePfxBase64 || !fiscalConfig.certificatePasswordEnc) {
            const error = new Error('A1 Digital Certificate is not installed or configured for this company.')
                ; (error as any).code = 'CERTIFICATE_NOT_CONFIGURED'
            throw error
        }

        if (input.model === '65' && (!fiscalConfig.cscIdToken || !fiscalConfig.cscToken)) {
            const error = new Error('NFC-e emission requires CSC (cscIdToken and cscToken) configured in FiscalConfig.')
                ; (error as any).code = 'CSC_NOT_CONFIGURED'
            throw error
        }

        // 3. Descriptografia e Carga do Certificado A1
        const pfxBase64 = decryptCertificateText(fiscalConfig.certificatePfxBase64, tenantSlug)
        const pfxPassword = decryptCertificateText(fiscalConfig.certificatePasswordEnc, tenantSlug)
        const certInfo = parsePfxCertificate(pfxBase64, pfxPassword)

        if (certInfo.isExpired) {
            const error = new Error(`Company A1 Digital Certificate expired on ${certInfo.expiresAt.toISOString()}.`)
                ; (error as any).code = 'CERTIFICATE_EXPIRED'
            throw error
        }

        // 4. Resolução da Numeração Sequencial por Filial
        const series = input.model === '55' ? fiscalConfig.nfeSeries : fiscalConfig.nfceSeries
        const nextNumber = input.model === '55' ? fiscalConfig.nfeNextNumber : fiscalConfig.nfceNextNumber

        // 5. Resolução do Cliente/Destinatário
        let resolvedCustomer = input.customer
        let customerId = input.customerId

        if (!resolvedCustomer && customerId) {
            const dbCustomer = await tenantPrisma.customer.findUnique({ where: { id: customerId } })
            if (dbCustomer) {
                resolvedCustomer = {
                    cpfCnpj: dbCustomer.cpfCnpj,
                    name: dbCustomer.name,
                    indicadorIe: dbCustomer.indicadorIe,
                    ie: dbCustomer.ie ?? undefined,
                    email: dbCustomer.email ?? undefined,
                    street: dbCustomer.street,
                    number: dbCustomer.number,
                    district: dbCustomer.district,
                    cityCode: dbCustomer.cityCode,
                    cityName: dbCustomer.cityName,
                    uf: dbCustomer.uf,
                    zipCode: dbCustomer.zipCode
                }
            }
        }

        if (input.model === '55' && !resolvedCustomer) {
            const error = new Error('Customer (destinatário) is mandatory for NF-e (Model 55) emission.')
                ; (error as any).code = 'CUSTOMER_REQUIRED'
            throw error
        }

        // Se informou cliente via objeto mas não tem customerId, busca ou cria no banco
        if (!customerId && resolvedCustomer) {
            const existingCustomer = await tenantPrisma.customer.findUnique({
                where: { cpfCnpj: resolvedCustomer.cpfCnpj }
            })
            if (existingCustomer) {
                customerId = existingCustomer.id
            } else {
                const createdCustomer = await tenantPrisma.customer.create({
                    data: {
                        cpfCnpj: resolvedCustomer.cpfCnpj,
                        name: resolvedCustomer.name,
                        indicadorIe: resolvedCustomer.indicadorIe ?? 9,
                        street: resolvedCustomer.street || 'Rua Principal',
                        number: resolvedCustomer.number || 'S/N',
                        district: resolvedCustomer.district || 'Centro',
                        cityCode: resolvedCustomer.cityCode || '3550308',
                        cityName: resolvedCustomer.cityName || 'São Paulo',
                        uf: resolvedCustomer.uf || 'SP',
                        zipCode: resolvedCustomer.zipCode || '01001000'
                    }
                })
                customerId = createdCustomer.id
            }
        }

        // 6. Montagem dos Dados da Empresa para o Builder
        const companyBuilderData = {
            cnpj: company.cnpj,
            socialName: company.socialName,
            fantasyName: company.fantasyName,
            ie: company.ie || 'ISENTO',
            crt: fiscalConfig.taxRegime === 'REGIME_NORMAL' ? ('3' as const) : ('1' as const),
            street: company.street,
            number: company.number,
            district: company.district,
            cityCode: company.cityCode,
            cityName: company.cityName,
            uf: company.uf,
            zipCode: company.zipCode,
            phone: company.phone ?? undefined
        }

        // 7. Geração do XML PL_009_V4 com Reforma Tributária
        let buildResult: any
        if (input.model === '55') {
            buildResult = buildNFeXml({
                series,
                number: nextNumber,
                naturezaOp: input.naturezaOp || 'VENDA DE MERCADORIA',
                tipoOp: input.tipoOp ?? 1,
                company: companyBuilderData,
                customer: resolvedCustomer!,
                items: input.items,
                payments: input.payments,
                additionalInfo: input.infCpl
            })
        } else {
            buildResult = buildNFCeXml({
                series,
                number: nextNumber,
                naturezaOp: input.naturezaOp || 'VENDA A CONSUMIDOR',
                company: companyBuilderData,
                customer: resolvedCustomer,
                items: input.items,
                payments: input.payments,
                vTroco: input.vTroco,
                cscIdToken: fiscalConfig.cscIdToken!,
                cscToken: fiscalConfig.cscToken!,
                tpEmis: input.isContingency ? 9 : 1,
                dhCont: input.isContingency ? new Date() : undefined,
                xJust: input.contingencyReason,
                additionalInfo: input.infCpl
            })
        }

        // 8. Assinatura Digital Nativa XMLDSig (ICP-Brasil)
        const signResult = signXml({
            xml: buildResult.xml,
            privateKeyPem: certInfo.privateKeyPem,
            certPem: certInfo.certPem
        })

        // 9. Validação Estrutural Local XSD
        assertValidFiscalXml(signResult.signedXml)

        // 10. Persistência Atômica no Banco Dedicado do Tenant
        const persistedDoc = await tenantPrisma.$transaction(async (tx) => {
            // Avança o número sequencial da filial
            if (input.model === '55') {
                await tx.fiscalConfig.update({
                    where: { id: fiscalConfig.id },
                    data: { nfeNextNumber: { increment: 1 } }
                })
            } else {
                await tx.fiscalConfig.update({
                    where: { id: fiscalConfig.id },
                    data: { nfceNextNumber: { increment: 1 } }
                })
            }

            // Garante existência dos produtos para vincular às chaves estrangeiras
            const resolvedItemProductIds: number[] = []
            for (const item of input.items) {
                let pId = item.productId
                if (!pId) {
                    const existingProduct = await tx.product.findUnique({ where: { sku: item.sku } })
                    if (existingProduct) {
                        pId = existingProduct.id
                    } else {
                        const newProduct = await tx.product.create({
                            data: {
                                sku: item.sku,
                                description: item.description,
                                ncm: item.ncm,
                                unit: item.unit,
                                price: item.unitPrice,
                                cfopDefault: item.cfop,
                                taxReformClass: item.taxReformClass ?? 'PADRAO',
                                isSubjectToIS: item.isSubjectToIS ?? false,
                                cstIbsCbsDefault: item.cstIbsCbs ?? '01'
                            }
                        })
                        pId = newProduct.id
                    }
                }
                resolvedItemProductIds.push(pId)
            }

            // Cria o cabeçalho do documento fiscal
            const doc = await tx.fiscalDocument.create({
                data: {
                    companyId: company.id,
                    model: input.model === '55' ? 'NFE_55' : 'NFCE_65',
                    series,
                    number: nextNumber,
                    accessKey: buildResult.accessKey,
                    naturezaOp: input.naturezaOp || (input.model === '55' ? 'VENDA DE MERCADORIA' : 'VENDA A CONSUMIDOR'),
                    tipoOp: input.tipoOp ?? 1,
                    status: 'SIGNED',
                    customerId,
                    totalProducts: input.items.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0),
                    totalDiscount: input.items.reduce((acc, it) => acc + (it.discount || 0), 0),
                    totalInvoice: buildResult.totalInvoice,
                    totalIbs: buildResult.totalIbs,
                    totalIbsEstadual: buildResult.totalIbs / 2,
                    totalIbsMunicipal: buildResult.totalIbs / 2,
                    totalCbs: buildResult.totalCbs,
                    totalIS: buildResult.totalIS,
                    xmlSigned: signResult.signedXml
                }
            })

            // Cria os itens apurados do documento
            for (let idx = 0; idx < input.items.length; idx++) {
                const item = input.items[idx]
                const prodId = resolvedItemProductIds[idx]
                const totalPrice = (item.quantity * item.unitPrice) - (item.discount || 0)

                await tx.fiscalDocumentItem.create({
                    data: {
                        documentId: doc.id,
                        itemNumber: idx + 1,
                        productId: prodId,
                        description: item.description,
                        ncm: item.ncm,
                        cfop: item.cfop,
                        unit: item.unit,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice,
                        discount: item.discount || 0,
                        taxReformClass: item.taxReformClass ?? 'PADRAO'
                    }
                })
            }

            // Cria os registros de pagamento
            for (const payment of input.payments) {
                await tx.fiscalPayment.create({
                    data: {
                        documentId: doc.id,
                        paymentType: payment.tPag === '01' ? 'DINHEIRO_01' : payment.tPag === '17' ? 'PIX_17' : 'OUTROS_99',
                        amount: payment.vPag
                    }
                })
            }

            return doc
        })

        return {
            documentId: persistedDoc.id,
            accessKey: buildResult.accessKey,
            model: input.model,
            series,
            number: nextNumber,
            status: 'SIGNED',
            totalInvoice: buildResult.totalInvoice,
            totalIbs: buildResult.totalIbs,
            totalCbs: buildResult.totalCbs,
            totalIS: buildResult.totalIS,
            xmlSigned: signResult.signedXml,
            qrCodeUrl: buildResult.qrCodeUrl
        }
    }
}

export const fiscalEmissionService = new FiscalEmissionService()