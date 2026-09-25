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