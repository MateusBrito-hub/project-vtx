import { z } from 'zod'

// Alíquotas de referência nacional (EC 132/2023 e PLP 68/2024)
export const DEFAULT_RATES = {
    CBS: 8.80,
    IBS_ESTADUAL: 12.00,
    IBS_MUNICIPAL: 5.70,
    IMPOSTO_SELETIVO: 1.50,
    LEGACY_ICMS: 18.00,
    LEGACY_PIS: 1.65,
    LEGACY_COFINS: 7.60,
    LEGACY_IPI: 0.00
} as const

// -------------------------------------------------------------
// 1. Schemas Zod de Entrada (DTOs Validados)
// -------------------------------------------------------------

export const taxReformClassEnum = z.enum([
    'PADRAO',
    'REDUZIDA_60',
    'REDUZIDA_30',
    'CESTA_BASICA_ISENTA',
    'IMPOSTO_SELETIVO',
    'IMUNE_ISENTO'
])

export const legacyTaxesInputSchema = z
    .object({
        icmsAliq: z.number().nonnegative().optional().default(DEFAULT_RATES.LEGACY_ICMS),
        pisAliq: z.number().nonnegative().optional().default(DEFAULT_RATES.LEGACY_PIS),
        cofinsAliq: z.number().nonnegative().optional().default(DEFAULT_RATES.LEGACY_COFINS),
        ipiAliq: z.number().nonnegative().optional().default(DEFAULT_RATES.LEGACY_IPI)
    })
    .partial()
    .strict()

export const customRatesInputSchema = z
    .object({
        aliqIbsEstadual: z.number().nonnegative().optional(),
        aliqIbsMunicipal: z.number().nonnegative().optional(),
        aliqCbs: z.number().nonnegative().optional(),
        aliqIS: z.number().nonnegative().optional()
    })
    .strict()

export const taxCalculationItemSchema = z
    .object({
        quantity: z.number().positive('Quantity must be greater than zero'),
        unitPrice: z.number().nonnegative('Unit price cannot be negative'),
        discount: z.number().nonnegative().optional().default(0),
        freight: z.number().nonnegative().optional().default(0),
        otherExpenses: z.number().nonnegative().optional().default(0),
        taxReformClass: taxReformClassEnum.optional().default('PADRAO'),
        isSubjectToIS: z.boolean().optional().default(false),
        destinationUf: z.string().length(2).toUpperCase().optional(),
        destinationCityCode: z.string().regex(/^\d{7}$/, 'City code must be a 7-digit IBGE code').optional(),
        legacyTaxes: legacyTaxesInputSchema.optional().default({}),
        customRates: customRatesInputSchema.optional()
    })
    .strict()

export const documentTaxCalculationSchema = z.array(taxCalculationItemSchema).min(1, 'Document must contain at least one item')

// Tipos Inferidos a partir dos Schemas (Zero duplicação com interfaces manuais)
export type TaxCalculationItemDTO = z.infer<typeof taxCalculationItemSchema>
export type DocumentTaxCalculationDTO = z.infer<typeof documentTaxCalculationSchema>

// -------------------------------------------------------------
// 2. DTOs de Saída (Resultados da Apuração)
// -------------------------------------------------------------

export interface ItemTaxCalculationResultDTO {
    baseValue: number
    totalGross: number
    discount: number
    legacy: {
        baseIcms: number
        aliqIcms: number
        valorIcms: number
        basePis: number
        aliqPis: number
        valorPis: number
        baseCofins: number
        aliqCofins: number
        valorCofins: number
        baseIpi: number
        aliqIpi: number
        valorIpi: number
        totalLegacyTaxes: number
    }
    taxReform: {
        taxReformClass: z.infer<typeof taxReformClassEnum>
        cstIbsCbs: string
        baseIbs: number
        aliqIbsEstadual: number
        valorIbsEstadual: number
        aliqIbsMunicipal: number
        valorIbsMunicipal: number
        valorIbsTotal: number
        baseCbs: number
        aliqCbs: number
        valorCbs: number
        baseIS: number
        aliqIS: number
        valorIS: number
        totalTaxReform: number
    }
    totalItem: number
}

export interface DocumentTaxCalculationResultDTO {
    totalProducts: number
    totalDiscount: number
    totalInvoice: number
    totalLegacy: {
        totalIcms: number
        totalPis: number
        totalCofins: number
        totalIpi: number
    }
    totalTaxReform: {
        totalIbsEstadual: number
        totalIbsMunicipal: number
        totalIbs: number
        totalCbs: number
        totalIS: number
    }
    items: ItemTaxCalculationResultDTO[]
}

// -------------------------------------------------------------
// 3. Funções do Motor de Cálculo
// -------------------------------------------------------------

export function roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Calcula os tributos de um único item com validação e parsing estrito via Zod DTO.
 */
export function calculateItemTaxes(rawInput: unknown): ItemTaxCalculationResultDTO {
    // Valida e aplica defaults via DTO Zod
    const input = taxCalculationItemSchema.parse(rawInput)

    const quantity = input.quantity
    const unitPrice = input.unitPrice
    const discount = roundCurrency(input.discount)
    const freight = roundCurrency(input.freight)
    const otherExpenses = roundCurrency(input.otherExpenses)

    const totalGross = roundCurrency(quantity * unitPrice)
    const baseValue = roundCurrency(Math.max(0, totalGross - discount + freight + otherExpenses))

    // 1. Tributos Legados (Período de Transição)
    const aliqIcms = input.legacyTaxes.icmsAliq ?? DEFAULT_RATES.LEGACY_ICMS
    const aliqPis = input.legacyTaxes.pisAliq ?? DEFAULT_RATES.LEGACY_PIS
    const aliqCofins = input.legacyTaxes.cofinsAliq ?? DEFAULT_RATES.LEGACY_COFINS
    const aliqIpi = input.legacyTaxes.ipiAliq ?? DEFAULT_RATES.LEGACY_IPI

    const valorIcms = roundCurrency((baseValue * aliqIcms) / 100)
    const valorPis = roundCurrency((baseValue * aliqPis) / 100)
    const valorCofins = roundCurrency((baseValue * aliqCofins) / 100)
    const valorIpi = roundCurrency((baseValue * aliqIpi) / 100)
    const totalLegacyTaxes = roundCurrency(valorIcms + valorPis + valorCofins + valorIpi)

    // 2. Reforma Tributária (IBS / CBS / IS)
    const taxClass = input.taxReformClass
    let reductionFactor = 1.0
    let cstIbsCbs = '01'

    switch (taxClass) {
        case 'REDUZIDA_60':
            reductionFactor = 0.40 // 60% de redução
            cstIbsCbs = '20'
            break
        case 'REDUZIDA_30':
            reductionFactor = 0.70 // 30% de redução
            cstIbsCbs = '20'
            break
        case 'CESTA_BASICA_ISENTA':
        case 'IMUNE_ISENTO':
            reductionFactor = 0.00 // Alíquota zero
            cstIbsCbs = '40'
            break
        case 'IMPOSTO_SELETIVO':
            reductionFactor = 1.00
            cstIbsCbs = '01'
            break
        default:
            reductionFactor = 1.00
            cstIbsCbs = '01'
    }

    const baseIbs = baseValue
    const baseCbs = baseValue

    const aliqIbsEstadualBase = input.customRates?.aliqIbsEstadual ?? DEFAULT_RATES.IBS_ESTADUAL
    const aliqIbsMunicipalBase = input.customRates?.aliqIbsMunicipal ?? DEFAULT_RATES.IBS_MUNICIPAL
    const aliqCbsBase = input.customRates?.aliqCbs ?? DEFAULT_RATES.CBS

    const aliqIbsEstadual = roundCurrency(aliqIbsEstadualBase * reductionFactor)
    const aliqIbsMunicipal = roundCurrency(aliqIbsMunicipalBase * reductionFactor)
    const aliqCbs = roundCurrency(aliqCbsBase * reductionFactor)

    const valorIbsEstadual = roundCurrency((baseIbs * aliqIbsEstadual) / 100)
    const valorIbsMunicipal = roundCurrency((baseIbs * aliqIbsMunicipal) / 100)
    const valorIbsTotal = roundCurrency(valorIbsEstadual + valorIbsMunicipal)
    const valorCbs = roundCurrency((baseCbs * aliqCbs) / 100)

    // Imposto Seletivo
    let aliqIS = 0
    let valorIS = 0
    let baseIS = 0

    if (input.isSubjectToIS || taxClass === 'IMPOSTO_SELETIVO') {
        baseIS = baseValue
        aliqIS = input.customRates?.aliqIS ?? DEFAULT_RATES.IMPOSTO_SELETIVO
        valorIS = roundCurrency((baseIS * aliqIS) / 100)
    }

    const totalTaxReform = roundCurrency(valorIbsTotal + valorCbs + valorIS)
    const totalItem = baseValue

    return {
        baseValue,
        totalGross,
        discount,
        legacy: {
            baseIcms: baseValue,
            aliqIcms,
            valorIcms,
            basePis: baseValue,
            aliqPis,
            valorPis,
            baseCofins: baseValue,
            aliqCofins,
            valorCofins,
            baseIpi: baseValue,
            aliqIpi,
            valorIpi,
            totalLegacyTaxes
        },
        taxReform: {
            taxReformClass: taxClass,
            cstIbsCbs,
            baseIbs,
            aliqIbsEstadual,
            valorIbsEstadual,
            aliqIbsMunicipal,
            valorIbsMunicipal,
            valorIbsTotal,
            baseCbs,
            aliqCbs,
            valorCbs,
            baseIS,
            aliqIS,
            valorIS,
            totalTaxReform
        },
        totalItem
    }
}

/**
 * Consolida os tributos de todos os itens validados do documento fiscal.
 */
export function calculateDocumentTaxes(rawItems: unknown): DocumentTaxCalculationResultDTO {
    const items = documentTaxCalculationSchema.parse(rawItems)
    const calculatedItems = items.map((item) => calculateItemTaxes(item))

    let totalProducts = 0
    let totalDiscount = 0
    let totalInvoice = 0

    let totalIcms = 0
    let totalPis = 0
    let totalCofins = 0
    let totalIpi = 0

    let totalIbsEstadual = 0
    let totalIbsMunicipal = 0
    let totalIbs = 0
    let totalCbs = 0
    let totalIS = 0

    for (const item of calculatedItems) {
        totalProducts += item.totalGross
        totalDiscount += item.discount
        totalInvoice += item.totalItem

        totalIcms += item.legacy.valorIcms
        totalPis += item.legacy.valorPis
        totalCofins += item.legacy.valorCofins
        totalIpi += item.legacy.valorIpi

        totalIbsEstadual += item.taxReform.valorIbsEstadual
        totalIbsMunicipal += item.taxReform.valorIbsMunicipal
        totalIbs += item.taxReform.valorIbsTotal
        totalCbs += item.taxReform.valorCbs
        totalIS += item.taxReform.valorIS
    }

    return {
        totalProducts: roundCurrency(totalProducts),
        totalDiscount: roundCurrency(totalDiscount),
        totalInvoice: roundCurrency(totalInvoice),
        totalLegacy: {
            totalIcms: roundCurrency(totalIcms),
            totalPis: roundCurrency(totalPis),
            totalCofins: roundCurrency(totalCofins),
            totalIpi: roundCurrency(totalIpi)
        },
        totalTaxReform: {
            totalIbsEstadual: roundCurrency(totalIbsEstadual),
            totalIbsMunicipal: roundCurrency(totalIbsMunicipal),
            totalIbs: roundCurrency(totalIbs),
            totalCbs: roundCurrency(totalCbs),
            totalIS: roundCurrency(totalIS)
        },
        items: calculatedItems
    }
}