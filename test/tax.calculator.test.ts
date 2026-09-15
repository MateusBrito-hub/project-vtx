import { describe, it, expect } from 'vitest'
import {
    calculateItemTaxes,
    calculateDocumentTaxes,
    DEFAULT_RATES
} from '../src/modules/tenant/fiscal/engine/tax-calculator.ts'

describe('Tax Calculator Engine — Hybrid & Tax Reform (Task 01)', () => {
    describe('calculateItemTaxes', () => {
        it('should calculate standard rate (PADRAO) with full IBS and CBS', () => {
            const item = calculateItemTaxes({
                quantity: 2,
                unitPrice: 100.00, // Total = 200.00
                taxReformClass: 'PADRAO'
            })

            expect(item.baseValue).toBe(200.00)
            expect(item.taxReform.cstIbsCbs).toBe('01')

            // IBS Estadual: 12% de 200 = 24.00
            expect(item.taxReform.aliqIbsEstadual).toBe(12.00)
            expect(item.taxReform.valorIbsEstadual).toBe(24.00)

            // IBS Municipal: 5.7% de 200 = 11.40
            expect(item.taxReform.aliqIbsMunicipal).toBe(5.70)
            expect(item.taxReform.valorIbsMunicipal).toBe(11.40)

            // Total IBS = 35.40
            expect(item.taxReform.valorIbsTotal).toBe(35.40)

            // CBS: 8.8% de 200 = 17.60
            expect(item.taxReform.aliqCbs).toBe(8.80)
            expect(item.taxReform.valorCbs).toBe(17.60)

            // Não sujeito ao IS
            expect(item.taxReform.valorIS).toBe(0)
            expect(item.taxReform.totalTaxReform).toBe(53.00) // 35.40 + 17.60
        })

        it('should apply 60% reduction for REDUZIDA_60 classification (Health / Education)', () => {
            const item = calculateItemTaxes({
                quantity: 1,
                unitPrice: 100.00,
                taxReformClass: 'REDUZIDA_60'
            })

            expect(item.taxReform.cstIbsCbs).toBe('20')
            // Alíquota efetiva CBS: 8.8 * 0.40 = 3.52% -> 3.52
            expect(item.taxReform.aliqCbs).toBe(3.52)
            expect(item.taxReform.valorCbs).toBe(3.52)

            // Alíquota efetiva IBS Estadual: 12 * 0.40 = 4.80% -> 4.80
            expect(item.taxReform.aliqIbsEstadual).toBe(4.80)
            expect(item.taxReform.valorIbsEstadual).toBe(4.80)

            // Alíquota efetiva IBS Municipal: 5.7 * 0.40 = 2.28% -> 2.28
            expect(item.taxReform.aliqIbsMunicipal).toBe(2.28)
            expect(item.taxReform.valorIbsMunicipal).toBe(2.28)
        })

        it('should apply 30% reduction for REDUZIDA_30 classification', () => {
            const item = calculateItemTaxes({
                quantity: 1,
                unitPrice: 100.00,
                taxReformClass: 'REDUZIDA_30'
            })

            expect(item.taxReform.cstIbsCbs).toBe('20')
            // 8.8 * 0.70 = 6.16%
            expect(item.taxReform.aliqCbs).toBe(6.16)
            expect(item.taxReform.valorCbs).toBe(6.16)
        })

        it('should result in zero tax for CESTA_BASICA_ISENTA and IMUNE_ISENTO', () => {
            const itemCesta = calculateItemTaxes({
                quantity: 5,
                unitPrice: 20.00,
                taxReformClass: 'CESTA_BASICA_ISENTA'
            })

            expect(itemCesta.taxReform.cstIbsCbs).toBe('40')
            expect(itemCesta.taxReform.valorIbsTotal).toBe(0)
            expect(itemCesta.taxReform.valorCbs).toBe(0)
            expect(itemCesta.taxReform.totalTaxReform).toBe(0)
        })

        it('should calculate Selective Tax (IS) when isSubjectToIS is true', () => {
            const item = calculateItemTaxes({
                quantity: 1,
                unitPrice: 100.00,
                taxReformClass: 'IMPOSTO_SELETIVO',
                isSubjectToIS: true
            })

            expect(item.taxReform.aliqIS).toBe(DEFAULT_RATES.IMPOSTO_SELETIVO)
            expect(item.taxReform.valorIS).toBe(1.50)
            expect(item.taxReform.totalTaxReform).toBe(8.80 + 17.70 + 1.50)
        })

        it('should subtract discount and add freight to the tax base', () => {
            const item = calculateItemTaxes({
                quantity: 1,
                unitPrice: 100.00,
                discount: 20.00,
                freight: 10.00,
                otherExpenses: 5.00,
                taxReformClass: 'PADRAO'
            })

            // Base = 100 - 20 + 10 + 5 = 95.00
            expect(item.baseValue).toBe(95.00)
            expect(item.taxReform.baseIbs).toBe(95.00)
            expect(item.taxReform.valorIbsEstadual).toBe(11.40) // 12% de 95
        })

        it('should reject invalid item payload with negative quantity or price via DTO validation', () => {
            expect(() => calculateItemTaxes({
                quantity: -1,
                unitPrice: 10.00
            })).toThrow()

            expect(() => calculateItemTaxes({
                quantity: 1,
                unitPrice: -50.00
            })).toThrow()
        })

        it('should reject unexpected extra properties (Mass Assignment protection via strict DTO)', () => {
            expect(() => calculateItemTaxes({
                quantity: 1,
                unitPrice: 100.00,
                maliciousField: 'exploit'
            })).toThrow()
        })

        it('should reject document calculation with empty item array', () => {
            expect(() => calculateDocumentTaxes([])).toThrow()
        })
    })

    describe('calculateDocumentTaxes (Consolidação do Documento)', () => {
        it('should aggregate taxes of multiple items with different tax reform classes', () => {
            const doc = calculateDocumentTaxes([
                {
                    quantity: 1,
                    unitPrice: 100.00,
                    taxReformClass: 'PADRAO'
                },
                {
                    quantity: 1,
                    unitPrice: 100.00,
                    taxReformClass: 'CESTA_BASICA_ISENTA'
                },
                {
                    quantity: 1,
                    unitPrice: 100.00,
                    taxReformClass: 'REDUZIDA_60'
                }
            ])

            expect(doc.totalProducts).toBe(300.00)
            expect(doc.totalInvoice).toBe(300.00)

            // CBS: 8.80 (PADRAO) + 0 (ISENTO) + 3.52 (REDUZIDA_60) = 12.32
            expect(doc.totalTaxReform.totalCbs).toBe(12.32)

            // IBS Estadual: 12.00 + 0 + 4.80 = 16.80
            expect(doc.totalTaxReform.totalIbsEstadual).toBe(16.80)

            // IBS Municipal: 5.70 + 0 + 2.28 = 7.98
            expect(doc.totalTaxReform.totalIbsMunicipal).toBe(7.98)

            // IBS Total: 16.80 + 7.98 = 24.78
            expect(doc.totalTaxReform.totalIbs).toBe(24.78)
        })
    })
})