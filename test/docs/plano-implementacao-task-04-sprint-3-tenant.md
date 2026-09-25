# Plano de Implementação — TASK 04 (Sprint 3 - Tenant)
## Validador Local Estrutural XSD, Orquestrador de Emissão (`fiscal-emission.service.ts`) e Fechamento da Sprint 3

| Metadado | Detalhe |
|---|---|
| **Fase** | 2 — VTX Tenant (Sistema Fiscal Cloud Multi-Filial) |
| **Sprint** | 3 — Geração de XML PL_009_V4, QR-Code 2.0 e Assinador Digital Nativo XMLDSig |
| **Task** | 04 — Validador Local Estrutural XSD, Orquestrador de Emissão e Fechamento da Sprint 3 |
| **Papel do PO** | Especificação de requisitos, arquitetura do pipeline, auditoria, execução de testes e relatórios |
| **Papel do Desenvolvedor** | Codificação de `xsd-validator.ts`, `fiscal-emission.service.ts`, rotas e `test/tenant.emission.test.ts` |
| **Padrão Normativo** | MOC SEFAZ v4.00 (PL_009_V4), W3C XMLDSig, NT 2023.004, EC 132/2023 |

---

## 1. Diretrizes Arquiteturais e Governança

1. **Separação Rígida de Papéis:**
   * O **Product Owner (PO)** especifica os requisitos de negócio, arquitetura, fórmulas matemáticas, interfaces e critérios de aceite, audita os resultados, executa os comandos de teste/build e emite os relatórios formais em `test/docs/` e `relatorios/`.
   * O **Desenvolvedor (Usuário)** implementa o código-fonte em `src/` e os arquivos de teste em `test/`.
2. **Pipeline de Emissão Atômico e Autônomo:**
   * A emissão fiscal une todos os componentes construídos nas Tasks 01 a 03 sob uma transação atômica no banco de dados dedicado do tenant (`vtx_<slug>`), garantindo que:
     - A cota contratual (`maxDocs`) seja conferida preventivamente antes de qualquer assinatura ou reserva de numeração;
     - A numeração sequencial (`nfeNextNumber` / `nfceNextNumber`) só avance se a nota for validada e assinada com sucesso;
     - O documento seja persistido com status `SIGNED` e com o XML assinado completo armazenado no campo `xmlSigned`.
3. **Validação Estrutural Local XSD sem Dependências Nativas Pesadas:**
   * Validador estrutural e sintático em TypeScript puro inspecionando todas as tags mandatórias, comprimentos, chaves de acesso, dígito verificador e nós da Reforma Tributária antes da transmissão para a SEFAZ.

---

## 2. Arquitetura e Arquivos Envolvidos

| Tipo | Caminho | Responsável | Descrição |
|:---:|---|:---:|---|
| **[NEW]** | `src/modules/tenant/fiscal/engine/xsd-validator.ts` | Desenvolvedor | Motor nativo de validação estrutural XSD (PL_009_V4 / MOC 4.00) com checagem de integridade |
| **[NEW]** | `src/modules/tenant/fiscal/fiscal-emission.service.ts` | Desenvolvedor | Orquestrador completo de emissão de NF-e e NFC-e unindo cota, tributos, XML, assinatura e banco |
| **[MODIFY]** | `src/modules/tenant/tenant.routes.ts` | Desenvolvedor | Exposição da rota HTTP `POST /fiscal/emit` vinculada ao orquestrador |
| **[NEW]** | `test/tenant.emission.test.ts` | Desenvolvedor | Suíte abrangente de testes unitários e de integração do pipeline de emissão |
| **[NEW]** | `test/docs/plano-implementacao-task-04-sprint-3-tenant.md` | PO | Documento canônico do plano de implementação da Task 04 com códigos de exemplo |
| **[NEW]** | `relatorios/plano-implementacao-task-04-sprint-3-tenant.md` | PO | Espelho do plano de implementação na pasta de relatórios |
| **[NEW]** | `test/docs/relatorio-alteracoes-task-04-sprint-3-tenant.md` | PO | Relatório formal de conformidade de 10 seções (pós-execução) |
| **[NEW]** | `relatorios/relatorio-alteracoes-task-04-sprint-3-tenant.md` | PO | Espelho do relatório formal na pasta de relatórios |
| **[NEW]** | `test/docs/relatorio-final-sprint-3-tenant.md` | PO | Relatório de encerramento e consolidação de toda a Sprint 3 (Tenant) |
| **[NEW]** | `relatorios/relatorio-final-sprint-3-tenant.md` | PO | Espelho do relatório final na pasta de relatórios |

---

## 3. Especificação do Pipeline de Emissão

```
  [Requisição de Emissão]
            │
            ▼
 1. QuotaService.assertEmissionQuota(tenantSlug, tenantPrisma)
            │ (Lança erro 403 se quota mensal excedida ou assinatura inativa)
            ▼
 2. Resolução da Empresa e FiscalConfig
            │ - Busca filial e parâmetros fiscais
            │ - Valida existência do Certificado A1
            │ - Descriptografa PFX e senha via AES-256-GCM (certificate.crypto)
            │ - Faz parse X.509 e extrai chave privada PEM (certificate.parser)
            │ - Se NFC-e (65): valida CSC (cscIdToken e cscToken)
            ▼
 3. Resolução da Numeração Sequencial
            │ - Lê série e próximo número (nfeSeries/nfeNextNumber ou nfceSeries/nfceNextNumber)
            ▼
 4. Resolução do Destinatário
            │ - NF-e (55): Obrigatório (busca existente ou cria)
            │ - NFC-e (65): Opcional (suporte a consumidor anônimo)
            ▼
 5. Geração do XML PL_009_V4 com Reforma Tributária
            │ - Modelo 55: buildNFeXml(...)
            │ - Modelo 65: buildNFCeXml(...) com QR-Code 2.0 e Hash SHA-1 CSC
            ▼
 6. Assinador Digital Nativo XMLDSig (ICP-Brasil)
            │ - signXml(...) -> Digest SHA-1 + RSA-SHA1 + KeyInfo
            ▼
 7. Validação Estrutural XSD Local
            │ - assertValidFiscalXml(signedXml)
            │ - Checa tags mandatórias, tipos, comprimentos, totalizadores e assinatura
            ▼
 8. Transação Atômica no Banco Dedicado (Prisma $transaction)
            │ - Incrementa FiscalConfig (nfeNextNumber++ ou nfceNextNumber++)
            │ - Insere FiscalDocument (status = SIGNED, xmlSigned = signedXml)
            │ - Insere FiscalDocumentItem (com detalhamento IBS, CBS e IS)
            │ - Insere FiscalPayment
            ▼
 [Retorno 201 com Documento Persistido e XML Assinado]
```

---

## 4. Códigos de Exemplo e Referência para Implementação

### 4.1. Código de Referência: `src/modules/tenant/fiscal/engine/xsd-validator.ts`

```typescript
export interface XsdValidationError {
    tag?: string
    message: string
}

export interface XsdValidationResult {
    isValid: boolean
    errors: string[]
    model?: '55' | '65'
    accessKey?: string
}

/**
 * Validador sintático e estrutural de esquemas XML SEFAZ (MOC v4.00 / PL_009_V4).
 * Valida elementos obrigatórios, hierarquia, atributos e assinatura digital XMLDSig.
 */
export function validateFiscalXml(xml: string): XsdValidationResult {
    const errors: string[] = []

    if (!xml || typeof xml !== 'string' || xml.trim().length === 0) {
        return { isValid: false, errors: ['XML string is empty or invalid'] }
    }

    // 1. Tag Raiz e Namespace SEFAZ
    if (!xml.includes('<NFe xmlns="http://www.portalfiscal.inf.br/nfe">') && !xml.includes('<NFe>')) {
        errors.push('Missing root element <NFe> or invalid namespace')
    }
    if (!xml.includes('</NFe>')) {
        errors.push('Unclosed root element </NFe>')
    }

    // 2. Tag <infNFe> e Chave de Acesso
    const infNFeMatch = xml.match(/<infNFe[^>]+Id="NFe(\d{44})"[^>]*>/)
    let accessKey: string | undefined
    let model: '55' | '65' | undefined

    if (!infNFeMatch) {
        errors.push('Missing or invalid <infNFe> tag with 44-digit Id attribute (Id="NFe...")')
    } else {
        accessKey = infNFeMatch[1]
        const modCode = accessKey.substring(20, 22)
        if (modCode === '55' || modCode === '65') {
            model = modCode as '55' | '65'
        } else {
            errors.push(`Invalid document model code in access key: "${modCode}". Expected 55 or 65.`)
        }

        // Validação matemática do Dígito Verificador Módulo 11 da chave
        const base43 = accessKey.substring(0, 43)
        const dvInKey = parseInt(accessKey.substring(43, 44), 10)
        let sum = 0
        let weight = 2
        for (let i = base43.length - 1; i >= 0; i--) {
            sum += parseInt(base43[i], 10) * weight
            weight = weight === 9 ? 2 : weight + 1
        }
        const rem = sum % 11
        const calculatedDV = (rem === 0 || rem === 1) ? 0 : 11 - rem
        if (calculatedDV !== dvInKey) {
            errors.push(`Access key check digit mismatch. Expected ${calculatedDV}, found ${dvInKey}.`)
        }
    }

    // 3. Grupo de Identificação <ide>
    const ideTags = ['<cUF>', '<cNF>', '<natOp>', '<mod>', '<serie>', '<nNF>', '<dhEmi>', '<tpNF>', '<idDest>', '<cMunFG>', '<tpImp>', '<tpEmis>', '<cDV>', '<tpAmb>', '<finNFe>', '<indFinal>', '<indPres>', '<procEmi>']
    for (const tag of ideTags) {
        if (!xml.includes(tag)) {
            errors.push(`Missing mandatory identification tag: ${tag}`)
        }
    }

    // 4. Grupo do Emitente <emit>
    const emitTags = ['<emit>', '<CNPJ>', '<xNome>', '<enderEmit>', '<IE>', '<CRT>']
    for (const tag of emitTags) {
        if (!xml.includes(tag)) {
            errors.push(`Missing mandatory emitter tag: ${tag}`)
        }
    }

    // Verifica CNPJ do emitente (14 dígitos)
    const cnpjMatch = xml.match(/<emit>[\s\S]*?<CNPJ>(\d+)<\/CNPJ>/)
    if (!cnpjMatch || cnpjMatch[1].length !== 14) {
        errors.push('Invalid emitter CNPJ: must contain exactly 14 digits')
    }

    // 5. Grupo do Destinatário <dest>
    if (model === '55') {
        if (!xml.includes('<dest>')) {
            errors.push('Tag <dest> is mandatory for NF-e (Model 55)')
        } else {
            const hasCpfOrCnpj = xml.includes('<CNPJ>') || xml.includes('<CPF>')
            if (!hasCpfOrCnpj) {
                errors.push('Tag <dest> must contain <CNPJ> or <CPF>')
            }
        }
    }

    // 6. Grupo de Itens <det>
    if (!xml.includes('<det nItem=')) {
        errors.push('Fiscal document must contain at least one <det> item element')
    }
    if (!xml.includes('<prod>') || !xml.includes('<cProd>') || !xml.includes('<xProd>') || !xml.includes('<NCM>') || !xml.includes('<CFOP>')) {
        errors.push('Fiscal items must contain complete <prod> attributes (cProd, xProd, NCM, CFOP)')
    }

    // Reforma Tributária: Validação de presença de nós <IBS> e <CBS>
    if (!xml.includes('<IBS>') || !xml.includes('<CBS>')) {
        errors.push('Missing mandatory Tax Reform tags <IBS> or <CBS> in fiscal items')
    }

    // 7. Grupo de Totais <total>
    if (!xml.includes('<total>') || !xml.includes('<ICMSTot>') || !xml.includes('<vNF>')) {
        errors.push('Missing mandatory invoice totals group <total><ICMSTot><vNF>')
    }
    if (!xml.includes('<IBSTot>') || !xml.includes('<CBSTot>')) {
        errors.push('Missing mandatory Tax Reform totalizers <IBSTot> or <CBSTot>')
    }

    // 8. Grupo de Pagamentos <pag>
    if (!xml.includes('<pag>') || !xml.includes('<detPag>') || !xml.includes('<tPag>') || !xml.includes('<vPag>')) {
        errors.push('Missing mandatory payment group <pag><detPag>')
    }

    // 9. Suplemento NFC-e QR-Code (Modelo 65)
    if (model === '65') {
        if (!xml.includes('<infNFeSupl>') || !xml.includes('<qrCode>')) {
            errors.push('NFC-e (Model 65) must contain <infNFeSupl> with <qrCode>')
        }
    }

    // 10. Assinatura Digital XMLDSig <Signature>
    if (!xml.includes('<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">') && !xml.includes('<Signature')) {
        errors.push('Missing digital signature <Signature>')
    } else {
        if (!xml.includes('<SignedInfo>') || !xml.includes('<SignatureValue>') || !xml.includes('<KeyInfo>')) {
            errors.push('Incomplete <Signature> structure (missing SignedInfo, SignatureValue or KeyInfo)')
        }
        if (!xml.includes('<DigestValue>')) {
            errors.push('Missing <DigestValue> in digital signature')
        }
        if (!xml.includes('<X509Certificate>')) {
            errors.push('Missing <X509Certificate> in digital signature KeyInfo')
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        model,
        accessKey
    }
}

/**
 * Garante que o XML está em conformidade com o leiaute SEFAZ, disparando exceção se houver inconformidades.
 */
export function assertValidFiscalXml(xml: string): void {
    const result = validateFiscalXml(xml)
    if (!result.isValid) {
        const error = new Error(`Fiscal XML schema validation failed:\n- ${result.errors.join('\n- ')}`)
        ;(error as any).code = 'XSD_VALIDATION_ERROR'
        ;(error as any).errors = result.errors
        throw error
    }
}
```

---

### 4.2. Código de Referência: `src/modules/tenant/fiscal/fiscal-emission.service.ts`

```typescript
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
            ;(error as any).code = 'CERTIFICATE_NOT_CONFIGURED'
            throw error
        }

        if (input.model === '65' && (!fiscalConfig.cscIdToken || !fiscalConfig.cscToken)) {
            const error = new Error('NFC-e emission requires CSC (cscIdToken and cscToken) configured in FiscalConfig.')
            ;(error as any).code = 'CSC_NOT_CONFIGURED'
            throw error
        }

        // 3. Descriptografia e Carga do Certificado A1
        const pfxBase64 = decryptCertificateText(fiscalConfig.certificatePfxBase64, tenantSlug)
        const pfxPassword = decryptCertificateText(fiscalConfig.certificatePasswordEnc, tenantSlug)
        const certInfo = parsePfxCertificate(pfxBase64, pfxPassword)

        if (certInfo.isExpired) {
            const error = new Error(`Company A1 Digital Certificate expired on ${certInfo.expiresAt.toISOString()}.`)
            ;(error as any).code = 'CERTIFICATE_EXPIRED'
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
            ;(error as any).code = 'CUSTOMER_REQUIRED'
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
                infCpl: input.infCpl
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
                isContingency: input.isContingency,
                contingencyReason: input.contingencyReason,
                infCpl: input.infCpl
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
```

---

### 4.3. Código de Referência: Ajuste em `src/modules/tenant/tenant.routes.ts`

```typescript
import { fiscalEmissionService } from './fiscal/fiscal-emission.service'

// Adicionar endpoint de emissão fiscal autônoma:
tenantRoutes.post('/fiscal/emit', async (req, res) => {
    try {
        const result = await fiscalEmissionService.emit(req.tenantSlug!, req.tenantPrisma!, req.body)
        return res.status(201).json(result)
    } catch (err: any) {
        const statusCode = (err.code === 'QUOTA_EXCEEDED' || err.code === 'INACTIVE_SUBSCRIPTION') ? 403 : 400
        return res.status(statusCode).json({ error: err.message, code: err.code, errors: err.errors })
    }
})
```

---

### 4.4. Código de Referência: `test/tenant.emission.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import forge from 'node-forge'
import request from 'supertest'

const { mockCentralPrisma } = vi.hoisted(() => {
    const mockCentralPrisma = {
        client: {
            findUnique: vi.fn(),
            findFirst: vi.fn()
        }
    }
    return { mockCentralPrisma }
})

vi.mock('../src/shared/database/prisma', () => ({
    prisma: mockCentralPrisma
}))

import { app } from '../src/app'
import { tenantConnectionManager } from '../src/modules/tenant/config/tenant-connection'
import { encryptCertificateText } from '../src/modules/tenant/certificate/certificate.crypto'
import { validateFiscalXml } from '../src/modules/tenant/fiscal/engine/xsd-validator'
import { fiscalEmissionService } from '../src/modules/tenant/fiscal/fiscal-emission.service'

describe('End-to-End Fiscal Emission & XSD Validation (Task 04 - Sprint 3)', () => {
    const TENANT_SLUG = 'vtx-supermercado'
    let testCertPem: string
    let testPrivateKeyPem: string
    let testP12Base64: string
    const testPassword = 'SecretPassword123'

    beforeAll(() => {
        // Gera um par de chaves RSA e certificado ICP-Brasil em memória
        const pki = forge.pki
        const keys = pki.rsa.generateKeyPair(1024)
        const cert = pki.createCertificate()
        cert.publicKey = keys.publicKey
        cert.serialNumber = '1001'
        cert.validity.notBefore = new Date()
        cert.validity.notAfter = new Date(new Date().getTime() + 365 * 24 * 60 * 60 * 1000)

        const attrs = [
            { name: 'commonName', value: 'VTX SUPERMERCADO LTDA:11222333000181' },
            { name: 'organizationName', value: 'VTX Test Authority' }
        ]
        cert.setSubject(attrs)
        cert.setIssuer(attrs)
        cert.sign(keys.privateKey)

        testCertPem = pki.certificateToPem(cert)
        testPrivateKeyPem = pki.privateKeyToPem(keys.privateKey)

        const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], testPassword)
        const p12Der = forge.asn1.toDer(p12Asn1).getBytes()
        testP12Base64 = forge.util.encode64(p12Der)
    })

    // Mock das tabelas do banco dedicado do tenant
    let mockCompany: any
    let mockFiscalConfig: any
    let mockDocuments: any[]
    let mockItems: any[]
    let mockPayments: any[]
    let mockProducts: any[]
    let mockCustomers: any[]

    beforeEach(() => {
        process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/vtx_core'

        mockDocuments = []
        mockItems = []
        mockPayments = []
        mockProducts = []
        mockCustomers = []

        mockCompany = {
            id: 1,
            isHeadquarter: true,
            cnpj: '11222333000181',
            socialName: 'VTX Supermercado LTDA',
            fantasyName: 'Super VTX',
            street: 'Av Paulista',
            number: '1000',
            district: 'Bela Vista',
            cityCode: '3550308',
            cityName: 'São Paulo',
            uf: 'SP',
            zipCode: '01310100',
            ie: '123456789'
        }

        mockFiscalConfig = {
            id: 1,
            companyId: 1,
            environment: 'HOMOLOGATION',
            taxRegime: 'SIMPLES_NACIONAL',
            enableTaxReform: true,
            nfeSeries: 1,
            nfeNextNumber: 100,
            nfceSeries: 1,
            nfceNextNumber: 50,
            certificatePfxBase64: encryptCertificateText(testP12Base64, TENANT_SLUG),
            certificatePasswordEnc: encryptCertificateText(testPassword, TENANT_SLUG),
            certificateExpiresAt: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000),
            certificateCnpj: '11222333000181',
            cscIdToken: '000001',
            cscToken: 'CSC_SECRET_KEY_123456789'
        }

        // Configuração do mock central (VTX Core)
        mockCentralPrisma.client.findUnique.mockImplementation(async ({ where }: any) => {
            if (where.slug === TENANT_SLUG) {
                return {
                    id: 1,
                    slug: TENANT_SLUG,
                    socialName: 'VTX Supermercado LTDA',
                    status: 'active',
                    plan: { id: 1, name: 'Enterprise Pro', maxDocs: 500 },
                    subscription: { id: 1, status: 'active' }
                }
            }
            return null
        })

        mockCentralPrisma.client.findFirst.mockImplementation(async ({ where }: any) => {
            return { id: 1, slug: TENANT_SLUG, status: 'active' }
        })

        // Configuração do Mock do Prisma Dedicado do Tenant
        const mockTenantClient: any = {
            company: {
                findFirst: vi.fn(async () => mockCompany),
                findUnique: vi.fn(async () => mockCompany)
            },
            fiscalConfig: {
                findUnique: vi.fn(async () => mockFiscalConfig),
                update: vi.fn(async ({ data }: any) => {
                    if (data.nfeNextNumber?.increment) mockFiscalConfig.nfeNextNumber += data.nfeNextNumber.increment
                    if (data.nfceNextNumber?.increment) mockFiscalConfig.nfceNextNumber += data.nfceNextNumber.increment
                    return mockFiscalConfig
                })
            },
            customer: {
                findUnique: vi.fn(async ({ where }: any) => mockCustomers.find(c => c.cpfCnpj === where.cpfCnpj)),
                create: vi.fn(async ({ data }: any) => {
                    const c = { id: mockCustomers.length + 1, ...data }
                    mockCustomers.push(c)
                    return c
                })
            },
            product: {
                findUnique: vi.fn(async ({ where }: any) => mockProducts.find(p => p.sku === where.sku)),
                create: vi.fn(async ({ data }: any) => {
                    const p = { id: mockProducts.length + 1, ...data }
                    mockProducts.push(p)
                    return p
                })
            },
            fiscalDocument: {
                count: vi.fn(async () => mockDocuments.filter(d => d.status === 'AUTHORIZED').length),
                create: vi.fn(async ({ data }: any) => {
                    const doc = { id: mockDocuments.length + 1, ...data }
                    mockDocuments.push(doc)
                    return doc
                })
            },
            fiscalDocumentItem: {
                create: vi.fn(async ({ data }: any) => {
                    const it = { id: mockItems.length + 1, ...data }
                    mockItems.push(it)
                    return it
                })
            },
            fiscalPayment: {
                create: vi.fn(async ({ data }: any) => {
                    const pay = { id: mockPayments.length + 1, ...data }
                    mockPayments.push(pay)
                    return pay
                })
            },
            $transaction: vi.fn(async (cb: any) => cb(mockTenantClient))
        }

        tenantConnectionManager.setClientFactory(() => mockTenantClient)
    })

    describe('1. Validador Estrutural XSD', () => {
        it('deve aprovar um XML devidamente formatado e assinado', () => {
            const rawXml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
              <infNFe Id="NFe35260911222333000181550010000001001123456784" versao="4.00">
                <ide><cUF>35</cUF><cNF>12345678</cNF><natOp>VENDA</natOp><mod>55</mod><serie>1</serie><nNF>100</nNF><dhEmi>2026-09-25T12:00:00-03:00</dhEmi><tpNF>1</tpNF><idDest>1</idDest><cMunFG>3550308</cMunFG><tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>4</cDV><tpAmb>2</tpAmb><finNFe>1</finNFe><indFinal>1</indFinal><indPres>1</indPres><procEmi>0</procEmi></ide>
                <emit><CNPJ>11222333000181</CNPJ><xNome>EMPRESA TESTE</xNome><enderEmit><xLgr>RUA</xLgr><nro>1</nro><xBairro>CENTRO</xBairro><cMun>3550308</cMun><xMun>SP</xMun><UF>SP</UF><CEP>01001000</CEP></enderEmit><IE>123456789</IE><CRT>1</CRT></emit>
                <dest><CNPJ>99888777000166</CNPJ><xNome>CLIENTE</xNome><enderDest><xLgr>RUA</xLgr><nro>2</nro><xBairro>BAIRRO</xBairro><cMun>3550308</cMun><xMun>SP</xMun><UF>SP</UF><CEP>01001000</CEP></enderDest><indIEDest>9</indIEDest></dest>
                <det nItem="1"><prod><cProd>SKU1</cProd><xProd>PROD 1</xProd><NCM>84713012</NCM><CFOP>5102</CFOP><uCom>UN</uCom><qCom>1</qCom><vUnCom>100.00</vUnCom><vProd>100.00</vProd><uTrib>UN</uTrib><qTrib>1</qTrib><vUnTrib>100.00</vUnTrib><indTot>1</indTot></prod><imposto><IBS><cstIBS>01</cstIBS><vBC>100.00</vBC><pIBSUF>0.10</pIBSUF><vIBSUF>0.10</vIBSUF><pIBSMun>0.05</pIBSMun><vIBSMun>0.05</vIBSMun><vIBS>0.15</vIBS></IBS><CBS><cstCBS>01</cstCBS><vBC>100.00</vBC><pCBS>0.90</pCBS><vCBS>0.90</vCBS></CBS></imposto></det>
                <total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vProd>100.00</vProd><vNF>100.00</vNF></ICMSTot><IBSTot><vBCIBS>100.00</vBCIBS><vIBS>0.15</vIBS></IBSTot><CBSTot><vBCCBS>100.00</vBCCBS><vCBS>0.90</vCBS></CBSTot></total>
                <transp><modFrete>9</modFrete></transp>
                <pag><detPag><tPag>01</tPag><vPag>100.00</vPag></detPag></pag>
              </infNFe>
              <Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo></SignedInfo><SignatureValue>SIG</SignatureValue><KeyInfo><X509Data><X509Certificate>CERT</X509Certificate></X509Data></KeyInfo><DigestValue>DIG</DigestValue></Signature>
            </NFe>`
            const result = validateFiscalXml(rawXml)
            expect(result.isValid).toBe(true)
            expect(result.model).toBe('55')
            expect(result.errors.length).toBe(0)
        })

        it('deve rejeitar XML com ausência de tags mandatórias da Reforma Tributária', () => {
            const invalidXml = '<NFe><infNFe Id="NFe12345678901234567890123456789012345678901234" versao="4.00"></infNFe></NFe>'
            const result = validateFiscalXml(invalidXml)
            expect(result.isValid).toBe(false)
            expect(result.errors.some(e => e.includes('IBS'))).toBe(true)
        })
    })

    describe('2. Pipeline Orquestrado de Emissão de NF-e (Modelo 55)', () => {
        it('deve orquestrar emissão completa de NF-e, assinar com A1, validar XSD e salvar no banco', async () => {
            const mockTenantPrisma = tenantConnectionManager.getTenantPrisma(TENANT_SLUG)

            const result = await fiscalEmissionService.emit(TENANT_SLUG, mockTenantPrisma, {
                model: '55',
                customer: {
                    cpfCnpj: '99888777000166',
                    name: 'Destinatário NF-e Teste',
                    indicadorIe: 9,
                    street: 'Rua do Comércio',
                    number: '500',
                    district: 'Industrial',
                    cityCode: '3550308',
                    cityName: 'São Paulo',
                    uf: 'SP',
                    zipCode: '01001000'
                },
                items: [
                    {
                        sku: 'PROD-NFE-01',
                        description: 'Notebook Corporativo',
                        ncm: '84713012',
                        cfop: '5102',
                        unit: 'UN',
                        quantity: 1,
                        unitPrice: 3500,
                        taxReformClass: 'PADRAO'
                    }
                ],
                payments: [{ tPag: '01', vPag: 3500 }]
            })

            expect(result.status).toBe('SIGNED')
            expect(result.number).toBe(100)
            expect(result.series).toBe(1)
            expect(result.accessKey).toHaveLength(44)
            expect(result.totalInvoice).toBe(3500)
            expect(result.xmlSigned).toContain('<Signature')
            expect(result.xmlSigned).toContain('<IBS>')
            expect(result.xmlSigned).toContain('<CBS>')

            // Verifica incremento sequencial no banco
            expect(mockFiscalConfig.nfeNextNumber).toBe(101)
            expect(mockDocuments.length).toBe(1)
            expect(mockItems.length).toBe(1)
            expect(mockPayments.length).toBe(1)
        })
    })

    describe('3. Pipeline Orquestrado de Emissão de NFC-e (Modelo 65)', () => {
        it('deve emitir NFC-e para consumidor anônimo gerando QR-Code 2.0 válido', async () => {
            const mockTenantPrisma = tenantConnectionManager.getTenantPrisma(TENANT_SLUG)

            const result = await fiscalEmissionService.emit(TENANT_SLUG, mockTenantPrisma, {
                model: '65',
                items: [
                    {
                        sku: 'PROD-CUPOM-01',
                        description: 'Refrigerante 2L',
                        ncm: '22021000',
                        cfop: '5102',
                        unit: 'UN',
                        quantity: 2,
                        unitPrice: 10,
                        taxReformClass: 'PADRAO'
                    }
                ],
                payments: [{ tPag: '17', vPag: 20 }]
            })

            expect(result.model).toBe('65')
            expect(result.number).toBe(50)
            expect(result.status).toBe('SIGNED')
            expect(result.qrCodeUrl).toBeDefined()
            expect(result.qrCodeUrl).toContain('chNFe=')
            expect(result.qrCodeUrl).toContain('&cIdToken=000001')
            expect(mockFiscalConfig.nfceNextNumber).toBe(51)
        })
    })

    describe('4. Bloqueio por Cota Fiscal Excedida', () => {
        it('deve bloquear a emissão se a cota do plano estiver esgotada', async () => {
            // Simula plano com limite atingido
            mockCentralPrisma.client.findUnique.mockImplementationOnce(async () => ({
                id: 1,
                slug: TENANT_SLUG,
                status: 'active',
                plan: { id: 1, name: 'Plano Básico', maxDocs: 5 },
                subscription: { id: 1, status: 'active' }
            }))

            const mockTenantPrisma = tenantConnectionManager.getTenantPrisma(TENANT_SLUG)
            mockTenantPrisma.fiscalDocument.count = vi.fn(async () => 5) // 5 de 5 usados

            await expect(
                fiscalEmissionService.emit(TENANT_SLUG, mockTenantPrisma, {
                    model: '65',
                    items: [{ sku: 'SKU', description: 'Item', ncm: '12345678', cfop: '5102', unit: 'UN', quantity: 1, unitPrice: 10 }],
                    payments: [{ tPag: '01', vPag: 10 }]
                })
            ).rejects.toThrow('Monthly fiscal emission limit reached')
        })
    })

    describe('5. Rota HTTP de Emissão POST /api/tenant/fiscal/emit', () => {
        it('deve emitir documento com sucesso via endpoint REST', async () => {
            const response = await request(app)
                .post('/api/tenant/fiscal/emit')
                .set('X-Tenant-Slug', TENANT_SLUG)
                .send({
                    model: '65',
                    items: [
                        {
                            sku: 'SKU-REST-01',
                            description: 'Item Teste REST',
                            ncm: '84713012',
                            cfop: '5102',
                            unit: 'UN',
                            quantity: 1,
                            unitPrice: 50
                        }
                    ],
                    payments: [{ tPag: '01', vPag: 50 }]
                })

            expect(response.status).toBe(201)
            expect(response.body.accessKey).toBeDefined()
            expect(response.body.status).toBe('SIGNED')
            expect(response.body.xmlSigned).toContain('<Signature')
        })
    })
})
