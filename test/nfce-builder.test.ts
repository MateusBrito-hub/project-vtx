import { describe, expect, it } from 'vitest'
import { buildNFCeXml, generateQRCode2 } from '../src/modules/tenant/fiscal/engine/nfce-builder'

describe('NFCe Builder Engine & QR-Code 2.0 (Task 02 - Sprint 3)', () => {
    const validCompany = {
        cnpj: '12345678000195',
        socialName: 'Mercado Exemplo LTDA',
        fantasyName: 'Mercado Bom Preço',
        ie: '123456789',
        crt: '1' as const,
        street: 'Rua do Comércio',
        number: '500',
        district: 'Centro',
        cityCode: '3550308',
        cityName: 'São Paulo',
        uf: 'SP',
        zipCode: '01001000',
        phone: '11988887777'
    }

    const cscMock = {
        cscIdToken: '000001',
        cscToken: 'A1B2C3D4E5F60718293A4B5C6D7E8F90'
    }

    describe('1. Algoritmo do QR-Code Versão 2.0', () => {
        it('deve gerar a string de parâmetros e o hash SHA-1 autenticado pelo CSC', () => {
            const qrResult = generateQRCode2({
                accessKey: '35260912345678000195650010000000011123456784',
                tpAmb: 2,
                dhEmi: new Date('2026-09-23T15:30:00-03:00'),
                vNF: 150.00,
                cscIdToken: cscMock.cscIdToken,
                cscToken: cscMock.cscToken
            })

            expect(qrResult.paramsString).toContain('chNFe=35260912345678000195650010000000011123456784')
            expect(qrResult.paramsString).toContain('nVersao=2')
            expect(qrResult.paramsString).toContain('tpAmb=2')
            expect(qrResult.paramsString).toContain('vNF=150.00')
            expect(qrResult.paramsString).toContain('cIdToken=000001')
            expect(qrResult.qrCodeHash).toHaveLength(40) // Hash SHA-1 tem 40 hex chars
            expect(qrResult.qrCodeUrl).toContain(`?p=${qrResult.paramsString}|${qrResult.qrCodeHash}`)
        })

        it('deve incluir cDest quando houver consumidor identificado', () => {
            const qrResult = generateQRCode2({
                accessKey: '35260912345678000195650010000000011123456784',
                tpAmb: 2,
                cDest: '12345678909',
                dhEmi: new Date('2026-09-23T15:30:00-03:00'),
                vNF: 50.00,
                cscIdToken: cscMock.cscIdToken,
                cscToken: cscMock.cscToken
            })

            expect(qrResult.paramsString).toContain('cDest=12345678909')
        })
    })

    describe('2. Construtor de XML da NFC-e (Modelo 65)', () => {
        it('deve gerar NFC-e para consumidor anônimo (sem tag <dest>)', () => {
            const result = buildNFCeXml({
                series: 1,
                number: 1,
                cscIdToken: cscMock.cscIdToken,
                cscToken: cscMock.cscToken,
                company: validCompany,
                items: [
                    {
                        sku: 'SKU-CAFE',
                        description: 'Café Torrado 500g',
                        ncm: '09012100',
                        cfop: '5102',
                        unit: 'UN',
                        quantity: 2,
                        unitPrice: 18.50
                    }
                ],
                payments: [
                    { tPag: '01', vPag: 37.00 }
                ]
            })

            expect(result.accessKey).toHaveLength(44)
            expect(result.accessKey.slice(20, 22)).toBe('65') // Modelo 65
            expect(result.xml).toContain('<mod>65</mod>')
            expect(result.xml).toContain('<tpImp>4</tpImp>') // DANFE NFC-e
            expect(result.xml).not.toContain('<dest>')
            expect(result.xml).toContain('<infNFeSupl>')
            expect(result.xml).toContain('<qrCode>')
            expect(result.xml).toContain('<urlChave>')
            expect(result.totalInvoice).toBe(37.00)
        })

        it('deve gerar NFC-e para consumidor identificado (com CPF no <dest>)', () => {
            const result = buildNFCeXml({
                series: 1,
                number: 2,
                cscIdToken: cscMock.cscIdToken,
                cscToken: cscMock.cscToken,
                company: validCompany,
                customer: {
                    cpfCnpj: '12345678909',
                    name: 'Consumidor da Silva'
                },
                items: [
                    {
                        sku: 'SKU-LEITE',
                        description: 'Leite Integral 1L',
                        ncm: '04012010',
                        cfop: '5102',
                        unit: 'UN',
                        quantity: 4,
                        unitPrice: 5.50
                    }
                ],
                payments: [
                    { tPag: '17', vPag: 22.00 }
                ]
            })

            expect(result.xml).toContain('<dest>')
            expect(result.xml).toContain('<CPF>12345678909</CPF>')
            expect(result.xml).toContain('<xNome>Consumidor da Silva</xNome>')
            expect(result.qrCodeUrl).toContain('cDest=12345678909')
        })

        it('deve registrar valor de troco quando informado', () => {
            const result = buildNFCeXml({
                series: 1,
                number: 3,
                cscIdToken: cscMock.cscIdToken,
                cscToken: cscMock.cscToken,
                company: validCompany,
                items: [
                    {
                        sku: 'SKU-PÃO',
                        description: 'Pão Francês KG',
                        ncm: '19059090',
                        cfop: '5102',
                        unit: 'KG',
                        quantity: 1,
                        unitPrice: 15.00
                    }
                ],
                payments: [
                    { tPag: '01', vPag: 20.00 }
                ],
                vTroco: 5.00
            })

            expect(result.xml).toContain('<vTroco>5.00</vTroco>')
        })

        it('deve gerar tags de contingência off-line quando tpEmis = 9', () => {
            const dhCont = new Date('2026-09-23T16:00:00-03:00')
            const result = buildNFCeXml({
                series: 1,
                number: 4,
                tpEmis: 9,
                dhCont,
                xJust: 'Falha de conexao com o servidor da SEFAZ autorizadora',
                cscIdToken: cscMock.cscIdToken,
                cscToken: cscMock.cscToken,
                company: validCompany,
                items: [
                    {
                        sku: 'SKU-AGUA',
                        description: 'Água Mineral 500ml',
                        ncm: '22011000',
                        cfop: '5102',
                        unit: 'UN',
                        quantity: 1,
                        unitPrice: 3.00
                    }
                ],
                payments: [
                    { tPag: '01', vPag: 3.00 }
                ]
            })

            expect(result.xml).toContain('<tpEmis>9</tpEmis>')
            expect(result.xml).toContain('<dhCont>')
            expect(result.xml).toContain('<xJust>Falha de conexao com o servidor da SEFAZ autorizadora</xJust>')
            expect(result.accessKey[34]).toBe('9')
        })

        it('deve rejeitar contingência off-line sem dhCont ou xJust', () => {
            expect(() => {
                buildNFCeXml({
                    series: 1,
                    number: 5,
                    tpEmis: 9,
                    cscIdToken: cscMock.cscIdToken,
                    cscToken: cscMock.cscToken,
                    company: validCompany,
                    items: [
                        {
                            sku: 'SKU-001',
                            description: 'Item Teste',
                            ncm: '12345678',
                            cfop: '5102',
                            unit: 'UN',
                            quantity: 1,
                            unitPrice: 10
                        }
                    ],
                    payments: [
                        { tPag: '01', vPag: 10 }
                    ]
                })
            }).toThrow(/Contingency offline/)
        })

        it('deve calcular corretamente os grupos da Reforma Tributária (IBS e CBS)', () => {
            const result = buildNFCeXml({
                series: 1,
                number: 6,
                cscIdToken: cscMock.cscIdToken,
                cscToken: cscMock.cscToken,
                company: validCompany,
                items: [
                    {
                        sku: 'SKU-ITEM',
                        description: 'Produto Comum com IVA Dual',
                        ncm: '84713012',
                        cfop: '5102',
                        unit: 'UN',
                        quantity: 1,
                        unitPrice: 100.00,
                        taxReformClass: 'PADRAO'
                    }
                ],
                payments: [
                    { tPag: '17', vPag: 100.00 }
                ]
            })

            expect(result.xml).toContain('<IBS>')
            expect(result.xml).toContain('<CBS>')
            expect(result.xml).toContain('<IBSTot>')
            expect(result.xml).toContain('<CBSTot>')
            expect(result.totalIbs).toBeGreaterThan(0)
            expect(result.totalCbs).toBeGreaterThan(0)
        })
    })
})