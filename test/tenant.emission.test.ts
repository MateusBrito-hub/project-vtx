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
            mockCentralPrisma.client.findUnique.mockImplementationOnce(async () => ({
                id: 1,
                slug: TENANT_SLUG,
                status: 'active',
                plan: { id: 1, name: 'Plano Básico', maxDocs: 5 },
                subscription: { id: 1, status: 'active' }
            }))

            const mockTenantPrisma = tenantConnectionManager.getTenantPrisma(TENANT_SLUG)
            mockTenantPrisma.fiscalDocument.count = vi.fn(async () => 5) as unknown as typeof mockTenantPrisma.fiscalDocument.count

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