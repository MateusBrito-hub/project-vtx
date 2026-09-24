import crypto from 'crypto'
import { z } from 'zod'
import {
    calculateModulo11,
    generateAccessKey,
    nfeCompanySchema,
    nfeItemInputSchema,
    nfePaymentSchema,
    UF_TO_CUF,
    xmlEscape
} from './nfe-builder'
import { calculateItemTaxes } from './tax-calculator'

// 1. Schema do Destinatário na NFC-e (Opcional - Consumidor Anônimo ou Identificado)
export const nfceCustomerSchema = z.object({
    cpfCnpj: z.string().regex(/^(\d{11}|\d{14})$/, 'CPF/CNPJ must be 11 or 14 numeric digits'),
    name: z.string().min(2).max(60).optional(),
    street: z.string().max(60).optional(),
    number: z.string().max(60).optional(),
    district: z.string().max(60).optional(),
    cityCode: z.string().regex(/^\d{7}$/).optional(),
    cityName: z.string().max(60).optional(),
    uf: z.string().length(2).toUpperCase().optional(),
    zipCode: z.string().regex(/^\d{8}$/).optional(),
    email: z.string().email().optional()
}).strict()

// 2. Schema de Entrada da NFC-e
export const nfceInputSchema = z.object({
    series: z.number().int().positive().default(1),
    number: z.number().int().positive(),
    naturezaOp: z.string().default('VENDA A CONSUMIDOR FINAL'),
    tpAmb: z.union([z.literal(1), z.literal(2)]).default(2),
    tpEmis: z.union([z.literal(1), z.literal(9)]).default(1), // 1=Normal, 9=Contingência Off-line
    emissionDate: z.date().optional(),
    dhCont: z.date().optional(), // Requerido se tpEmis === 9
    xJust: z.string().min(15).max(256).optional(), // Requerido se tpEmis === 9
    cNF: z.string().regex(/^\d{8}$/).optional(),
    cscIdToken: z.string().min(1).max(6), // Ex: "1" ou "000001"
    cscToken: z.string().min(16).max(36), // Segredo CSC fornecido pela SEFAZ
    urlConsultaQrCode: z.string().url().optional(),
    urlConsultaChave: z.string().url().optional(),
    company: nfeCompanySchema,
    customer: nfceCustomerSchema.optional(), // Opcional para NFC-e
    items: z.array(nfeItemInputSchema).min(1, 'NFC-e must have at least one item'),
    payments: z.array(nfePaymentSchema).min(1, 'NFC-e must have at least one payment'),
    vTroco: z.number().nonnegative().optional().default(0),
    additionalInfo: z.string().max(2000).optional()
}).strict()

export type NFCeInputDTO = z.infer<typeof nfceInputSchema>

export interface NFCeBuildResult {
    xml: string
    accessKey: string
    cDV: number
    cNF: string
    qrCodeUrl: string
    qrCodeHash: string
    totalInvoice: number
    totalIbs: number
    totalCbs: number
    totalIS: number
}

// 3. Algoritmo do QR-Code 2.0 (Hash SHA-1 com Token CSC)
export interface QRCodeParams {
    accessKey: string
    tpAmb: number
    cDest?: string
    dhEmi: Date
    vNF: number
    vICMS?: number
    digVal?: string
    cscIdToken: string
    cscToken: string
    urlConsulta?: string
}

export function generateQRCode2(params: QRCodeParams): { qrCodeUrl: string; qrCodeHash: string; paramsString: string } {
    const nVersao = 2
    const tpAmb = params.tpAmb
    const cDest = params.cDest ? params.cDest.replace(/\D/g, '') : ''
    const dhEmiIso = params.dhEmi.toISOString().replace(/\.\d{3}Z$/, '-03:00')
    const dhEmiHex = Buffer.from(dhEmiIso).toString('hex')
    const vNF = params.vNF.toFixed(2)
    const vICMS = (params.vICMS || 0).toFixed(2)
    const digVal = params.digVal || Buffer.from(params.accessKey.slice(-8)).toString('hex')
    const cIdToken = params.cscIdToken.padStart(6, '0')

    const parts = [
        `chNFe=${params.accessKey}`,
        `nVersao=${nVersao}`,
        `tpAmb=${tpAmb}`
    ]
    if (cDest) {
        parts.push(`cDest=${cDest}`)
    }
    parts.push(`dhEmi=${dhEmiHex}`)
    parts.push(`vNF=${vNF}`)
    parts.push(`vICMS=${vICMS}`)
    parts.push(`digVal=${digVal}`)
    parts.push(`cIdToken=${cIdToken}`)

    const paramsString = parts.join('&')
    const toHash = `${paramsString}${params.cscToken}`
    const qrCodeHash = crypto.createHash('sha1').update(toHash).digest('hex')

    const baseUrl = params.urlConsulta || (tpAmb === 1
        ? 'https://www.nfce.fazenda.sp.gov.br/qrcode'
        : 'https://homologacao.sat.fazenda.sp.gov.br/qrcode')

    const qrCodeUrl = `${baseUrl}?p=${paramsString}|${qrCodeHash}`

    return { qrCodeUrl, qrCodeHash, paramsString }
}

// 4. Construtor Principal da NFC-e (Modelo 65)
export function buildNFCeXml(rawInput: unknown): NFCeBuildResult {
    const input = nfceInputSchema.parse(rawInput)

    if (input.tpEmis === 9 && (!input.dhCont || !input.xJust)) {
        throw new Error('Contingency offline (tpEmis=9) requires dhCont and xJust')
    }

    const emissionDate = input.emissionDate || new Date()
    const { accessKey, cDV, cNF } = generateAccessKey({
        uf: input.company.uf,
        emissionDate,
        cnpj: input.company.cnpj,
        model: '65', // NFC-e
        series: input.series,
        number: input.number,
        tpEmis: input.tpEmis,
        cNF: input.cNF
    })

    const cUF = UF_TO_CUF[input.company.uf]
    const dhEmiIso = emissionDate.toISOString().replace(/\.\d{3}Z$/, '-03:00')

    let totalProducts = 0
    let totalDiscount = 0
    let totalIbsEstadual = 0
    let totalIbsMunicipal = 0
    let totalIbs = 0
    let totalCbs = 0
    let totalIS = 0
    let totalTrib = 0

    const itemsXml = input.items.map((item, index) => {
        const itemNumber = index + 1
        const taxResult = calculateItemTaxes({
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            taxReformClass: item.taxReformClass,
            isSubjectToIS: item.isSubjectToIS,
            destinationUf: input.company.uf,
            destinationCityCode: input.company.cityCode,
            customRates: item.customRates
        })

        const itemTotalGross = item.quantity * item.unitPrice
        totalProducts += itemTotalGross
        totalDiscount += item.discount
        totalIbsEstadual += taxResult.taxReform.valorIbsEstadual
        totalIbsMunicipal += taxResult.taxReform.valorIbsMunicipal
        totalIbs += taxResult.taxReform.valorIbsTotal
        totalCbs += taxResult.taxReform.valorCbs
        totalIS += taxResult.taxReform.valorIS
        totalTrib += taxResult.taxReform.totalTaxReform

        return `
    <det nItem="${itemNumber}">
      <prod>
        <cProd>${xmlEscape(item.sku)}</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>${xmlEscape(item.description)}</xProd>
        <NCM>${item.ncm}</NCM>
        ${item.cest ? `<CEST>${item.cest}</CEST>` : ''}
        <CFOP>${item.cfop}</CFOP>
        <uCom>${xmlEscape(item.unit)}</uCom>
        <qCom>${item.quantity.toFixed(4)}</qCom>
        <vUnCom>${item.unitPrice.toFixed(4)}</vUnCom>
        <vProd>${itemTotalGross.toFixed(2)}</vProd>
        <cEANTrib>SEM GTIN</cEANTrib>
        <uTrib>${xmlEscape(item.unit)}</uTrib>
        <qTrib>${item.quantity.toFixed(4)}</qTrib>
        <vUnTrib>${item.unitPrice.toFixed(4)}</vUnTrib>
        ${item.discount > 0 ? `<vDesc>${item.discount.toFixed(2)}</vDesc>` : ''}
        <indTot>1</indTot>
      </prod>
      <imposto>
        <vTotTrib>${taxResult.taxReform.totalTaxReform.toFixed(2)}</vTotTrib>
        <ICMS>
          <ICMSSN102>
            <orig>0</orig>
            <CSOSN>102</CSOSN>
          </ICMSSN102>
        </ICMS>
        <PIS>
          <PISNT>
            <CST>07</CST>
          </PISNT>
        </PIS>
        <COFINS>
          <COFINSNT>
            <CST>07</CST>
          </COFINSNT>
        </COFINS>
        <IBS>
          <cstIBS>${taxResult.taxReform.cstIbsCbs}</cstIBS>
          <vBC>${taxResult.taxReform.baseIbs.toFixed(2)}</vBC>
          <pIBSUF>${taxResult.taxReform.aliqIbsEstadual.toFixed(2)}</pIBSUF>
          <vIBSUF>${taxResult.taxReform.valorIbsEstadual.toFixed(2)}</vIBSUF>
          <pIBSMun>${taxResult.taxReform.aliqIbsMunicipal.toFixed(2)}</pIBSMun>
          <vIBSMun>${taxResult.taxReform.valorIbsMunicipal.toFixed(2)}</vIBSMun>
          <vIBS>${taxResult.taxReform.valorIbsTotal.toFixed(2)}</vIBS>
        </IBS>
        <CBS>
          <cstCBS>${taxResult.taxReform.cstIbsCbs}</cstCBS>
          <vBC>${taxResult.taxReform.baseCbs.toFixed(2)}</vBC>
          <pCBS>${taxResult.taxReform.aliqCbs.toFixed(2)}</pCBS>
          <vCBS>${taxResult.taxReform.valorCbs.toFixed(2)}</vCBS>
        </CBS>
        ${taxResult.taxReform.valorIS > 0 ? `
        <IS>
          <vBC>${taxResult.taxReform.baseIS.toFixed(2)}</vBC>
          <pIS>${taxResult.taxReform.aliqIS.toFixed(2)}</pIS>
          <vIS>${taxResult.taxReform.valorIS.toFixed(2)}</vIS>
        </IS>` : ''}
      </imposto>
    </det>`
    }).join('')

    const totalInvoice = totalProducts - totalDiscount

    // QR-Code 2.0
    const { qrCodeUrl, qrCodeHash } = generateQRCode2({
        accessKey,
        tpAmb: input.tpAmb,
        cDest: input.customer?.cpfCnpj,
        dhEmi: emissionDate,
        vNF: totalInvoice,
        cscIdToken: input.cscIdToken,
        cscToken: input.cscToken,
        urlConsulta: input.urlConsultaQrCode
    })

    const urlChave = input.urlConsultaChave || (input.tpAmb === 1
        ? 'https://www.nfce.fazenda.sp.gov.br/consulta'
        : 'https://homologacao.sat.fazenda.sp.gov.br/consulta')

    // Destinatário opcional
    let destXml = ''
    if (input.customer) {
        const isPJ = input.customer.cpfCnpj.length === 14
        destXml = `
    <dest>
      ${isPJ ? `<CNPJ>${input.customer.cpfCnpj}</CNPJ>` : `<CPF>${input.customer.cpfCnpj}</CPF>`}
      ${input.customer.name ? `<xNome>${xmlEscape(input.customer.name)}</xNome>` : ''}
      <indIEDest>9</indIEDest>
      ${input.customer.email ? `<email>${xmlEscape(input.customer.email)}</email>` : ''}
    </dest>`
    }

    const paymentsXml = input.payments.map((p) => `
      <detPag>
        <tPag>${p.tPag}</tPag>
        <vPag>${p.vPag.toFixed(2)}</vPag>
      </detPag>`).join('')

    const infCpl = input.additionalInfo
        ? `${xmlEscape(input.additionalInfo)} - Valores de tributos apurados conforme EC 132/2023.`
        : 'Valores de tributos apurados de acordo com a Reforma Tributária (EC 132/2023).'

    const xml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${accessKey}" versao="4.00">
    <ide>
      <cUF>${cUF}</cUF>
      <cNF>${cNF}</cNF>
      <natOp>${xmlEscape(input.naturezaOp)}</natOp>
      <mod>65</mod>
      <serie>${input.series}</serie>
      <nNF>${input.number}</nNF>
      <dhEmi>${dhEmiIso}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>${input.company.cityCode}</cMunFG>
      <tpImp>4</tpImp>
      <tpEmis>${input.tpEmis}</tpEmis>
      <cDV>${cDV}</cDV>
      <tpAmb>${input.tpAmb}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>VTX_1.0</verProc>
      ${input.tpEmis === 9 ? `
      <dhCont>${input.dhCont?.toISOString().replace(/\.\d{3}Z$/, '-03:00')}</dhCont>
      <xJust>${xmlEscape(input.xJust || 'Emissao em contingencia offline')}</xJust>` : ''}
    </ide>
    <emit>
      <CNPJ>${input.company.cnpj}</CNPJ>
      <xNome>${xmlEscape(input.company.socialName)}</xNome>
      ${input.company.fantasyName ? `<xFant>${xmlEscape(input.company.fantasyName)}</xFant>` : ''}
      <enderEmit>
        <xLgr>${xmlEscape(input.company.street)}</xLgr>
        <nro>${xmlEscape(input.company.number)}</nro>
        ${input.company.complement ? `<xCpl>${xmlEscape(input.company.complement)}</xCpl>` : ''}
        <xBairro>${xmlEscape(input.company.district)}</xBairro>
        <cMun>${input.company.cityCode}</cMun>
        <xMun>${xmlEscape(input.company.cityName)}</xMun>
        <UF>${input.company.uf}</UF>
        <CEP>${input.company.zipCode}</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
        ${input.company.phone ? `<fone>${input.company.phone}</fone>` : ''}
      </enderEmit>
      <IE>${input.company.ie}</IE>
      <CRT>${input.company.crt}</CRT>
    </emit>${destXml}${itemsXml}
    <total>
      <ICMSTot>
        <vBC>0.00</vBC>
        <vICMS>0.00</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCPUFDest>0.00</vFCPUFDest>
        <vICMSUFDest>0.00</vICMSUFDest>
        <vICMSUFRemet>0.00</vICMSUFRemet>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${totalProducts.toFixed(2)}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>${totalDiscount.toFixed(2)}</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${totalInvoice.toFixed(2)}</vNF>
        <vTotTrib>${totalTrib.toFixed(2)}</vTotTrib>
      </ICMSTot>
      <IBSTot>
        <vBCIBS>${totalProducts.toFixed(2)}</vBCIBS>
        <vIBSUF>${totalIbsEstadual.toFixed(2)}</vIBSUF>
        <vIBSMun>${totalIbsMunicipal.toFixed(2)}</vIBSMun>
        <vIBS>${totalIbs.toFixed(2)}</vIBS>
      </IBSTot>
      <CBSTot>
        <vBCCBS>${totalProducts.toFixed(2)}</vBCCBS>
        <vCBS>${totalCbs.toFixed(2)}</vCBS>
      </CBSTot>
      ${totalIS > 0 ? `
      <ISTot>
        <vBCIS>${totalProducts.toFixed(2)}</vBCIS>
        <vIS>${totalIS.toFixed(2)}</vIS>
      </ISTot>` : ''}
    </total>
    <transp>
      <modFrete>9</modFrete>
    </transp>
    <pag>${paymentsXml}
      ${input.vTroco > 0 ? `<vTroco>${input.vTroco.toFixed(2)}</vTroco>` : ''}
    </pag>
    <infAdic>
      <infCpl>${infCpl}</infCpl>
    </infAdic>
  </infNFe>
  <infNFeSupl>
    <qrCode>${qrCodeUrl}</qrCode>
    <urlChave>${urlChave}</urlChave>
  </infNFeSupl>
</NFe>`

    return {
        xml,
        accessKey,
        cDV,
        cNF,
        qrCodeUrl,
        qrCodeHash,
        totalInvoice,
        totalIbs,
        totalCbs,
        totalIS
    }
}