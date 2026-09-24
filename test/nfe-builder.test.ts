import { describe, expect, it } from 'vitest'
import {
    buildNFeXml,
    calculateModulo11,
    generateAccessKey,
    UF_TO_CUF,
    xmlEscape
} from '../src/modules/tenant/fiscal/engine/nfe-builder'

describe('NFe Builder Engine (Task 01 - Sprint 3)', () => {
    const validCompany = {
        cnpj: '12345678000195',
        socialName: 'Empresa Teste & Cia LTDA',
        fantasyName: 'Teste Express',
        ie: '123456789',
        crt: '1' as const,
        street: 'Avenida Paulista',
        number: '1000',
        district: 'Bela Vista',
        cityCode: '3550308',
        cityName: 'São Paulo',
        uf: 'SP',
        zipCode: '01310100',
        phone: '11999999999'
    }

    const validCustomer = {
        cpfCnpj: '98765432000180',
        name: 'Cliente Final <Comércio>',
        indicadorIe: 9,
        street: 'Rua das Flores',
        number: '123',
        district: 'Centro',
        cityCode: '3550308',
        cityName: 'São Paulo',
        uf: 'SP',
        zipCode: '01001000',
        email: 'cliente@exemplo.com'
    }

    describe('1. Algoritmo Módulo 11 e Chave de Acesso', () => {
        it('deve calcular corretamente o dígito verificador com ponderação 2 a 9', () => {
            const base43 = '3526091234567800019555001000000001112345678'
            const dv = calculateModulo11(base43)
            expect(dv).toBeGreaterThanOrEqual(0)
            expect(dv).toBeLessThanOrEqual(9)
        })

        it('deve retornar 0 quando o resto da divisão por 11 for 0 ou 1', () => {
            const base = '1111111111111111111111111111111111111111111'
            expect(() => calculateModulo11(base)).not.toThrow()
        })

        it('deve rejeitar base com comprimento diferente de 43 dígitos numéricos', () => {
            expect(() => calculateModulo11('12345')).toThrow(/must have exactly 43/)
            expect(() => calculateModulo11('352609123456780001955500100000000111234567A')).toThrow()
        })

        it('deve gerar chave de acesso válida de 44 dígitos com cUF correto', () => {
            const result = generateAccessKey({
                uf: 'SP',
                emissionDate: new Date('2026-09-23T10:00:00Z'),
                cnpj: '12345678000195',
                series: 1,
                number: 100,
                cNF: '87654321'
            })

            expect(result.accessKey).toHaveLength(44)
            expect(result.accessKey.startsWith('35')).toBe(true) // SP = 35
            expect(result.accessKey.slice(2, 6)).toBe('2609') // Ano 26, Mês 09
            expect(result.accessKey.slice(6, 20)).toBe('12345678000195') // CNPJ
            expect(result.accessKey.slice(20, 22)).toBe('55') // Mod 55
            expect(result.accessKey.slice(22, 25)).toBe('001') // Serie
            expect(result.accessKey.slice(25, 34)).toBe('000000100') // nNF
            expect(result.cDV).toBe(parseInt(result.accessKey.slice(-1), 10))
        })
    })

    describe('2. Sanitização e Escape XML', () => {
        it('deve escapar caracteres reservados XML', () => {
            const raw = 'Razão & Filhos <Tech> "Super" \'Mega\' '
            const escaped = xmlEscape(raw)
            expect(escaped).toBe('Razão &amp; Filhos &lt;Tech&gt; &quot;Super&quot; &apos;Mega&apos;')
        })
    })

    describe('3. Construtor do XML NF-e com Reforma Tributária', () => {
        it('deve construir XML padrão SEFAZ v4.00 com tags IBS e CBS preenchidas', () => {
            const result = buildNFeXml({
                series: 1,
                number: 1,
                naturezaOp: 'VENDA DE MERCADORIA',
                company: validCompany,
                customer: validCustomer,
                items: [
                    {
                        sku: 'SKU-001',
                        description: 'Notebook & Acessórios',
                        ncm: '84713012',
                        cfop: '5102',
                        unit: 'UN',
                        quantity: 2,
                        unitPrice: 1500,
                        discount: 100,
                        taxReformClass: 'PADRAO'
                    }
                ],
                payments: [
                    { tPag: '01', vPag: 2900 }
                ]
            })

            expect(result.xml).toContain('<NFe xmlns="http://www.portalfiscal.inf.br/nfe">')
            expect(result.xml).toContain(`<infNFe Id="NFe${result.accessKey}" versao="4.00">`)
            expect(result.xml).toContain('<IBS>')
            expect(result.xml).toContain('<cstIBS>01</cstIBS>')
            expect(result.xml).toContain('<CBS>')
            expect(result.xml).toContain('<cstCBS>01</cstCBS>')
            expect(result.xml).toContain('<IBSTot>')
            expect(result.xml).toContain('<CBSTot>')
            expect(result.xml).toContain('<vProd>3000.00</vProd>')
            expect(result.xml).toContain('<vNF>2900.00</vNF>')
            expect(result.totalInvoice).toBe(2900)
            expect(result.totalIbs).toBeGreaterThan(0)
            expect(result.totalCbs).toBeGreaterThan(0)
        })

        it('deve incluir o grupo IS quando o item for sujeito ao Imposto Seletivo', () => {
            const result = buildNFeXml({
                series: 1,
                number: 2,
                company: validCompany,
                customer: validCustomer,
                items: [
                    {
                        sku: 'SKU-BEBIDA',
                        description: 'Bebida Alcoólica Premium',
                        ncm: '22030000',
                        cfop: '5102',
                        unit: 'UN',
                        quantity: 10,
                        unitPrice: 50,
                        taxReformClass: 'IMPOSTO_SELETIVO',
                        isSubjectToIS: true
                    }
                ],
                payments: [
                    { tPag: '17', vPag: 500 }
                ]
            })

            expect(result.xml).toContain('<IS>')
            expect(result.xml).toContain('<pIS>1.50</pIS>')
            expect(result.xml).toContain('<ISTot>')
            expect(result.totalIS).toBe(7.50)
        })

        it('deve gerar alíquotas zero para itens de Cesta Básica Isenta', () => {
            const result = buildNFeXml({
                series: 1,
                number: 3,
                company: validCompany,
                customer: validCustomer,
                items: [
                    {
                        sku: 'SKU-ARROZ',
                        description: 'Arroz Tipo 1 - 5kg',
                        ncm: '10063021',
                        cfop: '5102',
                        unit: 'PCT',
                        quantity: 4,
                        unitPrice: 25,
                        taxReformClass: 'CESTA_BASICA_ISENTA'
                    }
                ],
                payments: [
                    { tPag: '01', vPag: 100 }
                ]
            })

            expect(result.xml).toContain('<cstIBS>40</cstIBS>')
            expect(result.xml).toContain('<vIBS>0.00</vIBS>')
            expect(result.xml).toContain('<vCBS>0.00</vCBS>')
            expect(result.totalIbs).toBe(0)
            expect(result.totalCbs).toBe(0)
        })

        it('deve sanitizar caracteres especiais no XML sem quebrar tags', () => {
            const result = buildNFeXml({
                series: 1,
                number: 4,
                company: validCompany,
                customer: {
                    ...validCustomer,
                    name: 'José & Maria <Comerciantes> "VIP"'
                },
                items: [
                    {
                        sku: 'SKU-002',
                        description: 'Monitor LCD 24" & Suporte <Articulado>',
                        ncm: '85285220',
                        cfop: '5102',
                        unit: 'UN',
                        quantity: 1,
                        unitPrice: 800
                    }
                ],
                payments: [
                    { tPag: '03', vPag: 800 }
                ]
            })

            expect(result.xml).toContain('José &amp; Maria &lt;Comerciantes&gt; &quot;VIP&quot;')
            expect(result.xml).toContain('Monitor LCD 24&quot; &amp; Suporte &lt;Articulado&gt;')
            expect(result.xml).not.toContain('<Comerciantes>')
        })

        it('deve rejeitar entrada com DTO inválido disparando erro Zod', () => {
            expect(() => {
                buildNFeXml({
                    series: 1,
                    number: 5,
                    company: {
                        ...validCompany,
                        cnpj: '123'
                    },
                    customer: validCustomer,
                    items: [],
                    payments: []
                })
            }).toThrow()
        })
    })
})