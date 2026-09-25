import crypto from 'crypto'

export interface SignXmlOptions {
    xml: string
    privateKeyPem: string
    certPem: string
}

export interface SignedXmlResult {
    signedXml: string
    signatureValue: string
    digestValue: string
}

export interface VerifySignatureResult {
    isValid: boolean
    reason?: string
}

/**
 * Normaliza o XML para formato canônico C14N básico (sem comentários).
 * Ordena atributos lexicograficamente e padroniza espaçamentos.
 */
export function canonicalizeXml(xmlSnippet: string): string {
    return xmlSnippet
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        // Ordena atributos comuns da tag infNFe: Id antes de versao
        .replace(/<infNFe\s+versao="([^"]+)"\s+Id="([^"]+)">/g, '<infNFe Id="$2" versao="$1">')
        .trim()
}

/**
 * Extrai a Chave de Acesso contida no atributo Id de <infNFe Id="NFe...">
 */
export function extractAccessKeyFromXml(xml: string): string {
    const match = xml.match(/<infNFe[^>]+Id="NFe(\d{44})"/)
    if (!match || !match[1]) {
        throw new Error('Could not find 44-digit access key in <infNFe Id="NFe...">')
    }
    return match[1]
}

/**
 * Assina digitalmente um XML de NF-e ou NFC-e no padrão W3C XMLDSig ICP-Brasil.
 */
export function signXml(options: SignXmlOptions): SignedXmlResult {
    const { xml, privateKeyPem, certPem } = options

    if (!xml || !privateKeyPem || !certPem) {
        throw new Error('xml, privateKeyPem and certPem are required for XML signing')
    }

    // 1. Extração da tag <infNFe> completa
    const infNFeMatch = xml.match(/<infNFe[\s\S]*?<\/infNFe>/)
    if (!infNFeMatch) {
        throw new Error('Invalid XML: <infNFe> element not found')
    }
    const infNFeRaw = infNFeMatch[0]
    const infNFeCanonical = canonicalizeXml(infNFeRaw)

    // 2. Extração da Chave de Acesso
    const accessKey = extractAccessKeyFromXml(infNFeRaw)

    // 3. Cálculo do DigestValue (SHA-1 em Base64)
    const digestValue = crypto
        .createHash('sha1')
        .update(infNFeCanonical, 'utf8')
        .digest('base64')

    // 4. Montagem da tag <SignedInfo>
    const signedInfoRaw = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
        `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
        `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
        `<Reference URI="#NFe${accessKey}">` +
        `<Transforms>` +
        `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
        `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
        `</Transforms>` +
        `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
        `<DigestValue>${digestValue}</DigestValue>` +
        `</Reference>` +
        `</SignedInfo>`

    const signedInfoCanonical = canonicalizeXml(signedInfoRaw)

    // 5. Assinatura RSA-SHA1 de <SignedInfo>
    const signer = crypto.createSign('RSA-SHA1')
    signer.update(signedInfoCanonical, 'utf8')
    const signatureValue = signer.sign(privateKeyPem, 'base64')

    // 6. Extração do certificado em Base64 puro
    const certBase64 = certPem
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/[\r\n\s]/g, '')

    // 7. Montagem da tag <Signature>
    const signatureXml = `
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    ${signedInfoRaw}
    <SignatureValue>${signatureValue}</SignatureValue>
    <KeyInfo>
      <X509Data>
        <X509Certificate>${certBase64}</X509Certificate>
      </X509Data>
    </KeyInfo>
  </Signature>`

    // 8. Injeção da assinatura imediatamente antes do fechamento de </NFe>
    if (!xml.includes('</NFe>')) {
        throw new Error('Invalid XML: closing tag </NFe> not found')
    }

    const signedXml = xml.replace('</NFe>', `${signatureXml}\n</NFe>`)

    return {
        signedXml,
        signatureValue,
        digestValue
    }
}

/**
 * Valida a integridade matemática e criptográfica de um XML assinado no padrão XMLDSig.
 */
export function verifyXmlSignature(signedXml: string): VerifySignatureResult {
    try {
        // 1. Extração do conteúdo assinado <infNFe>
        const infNFeMatch = signedXml.match(/<infNFe[\s\S]*?<\/infNFe>/)
        if (!infNFeMatch) {
            return { isValid: false, reason: '<infNFe> tag not found' }
        }
        const infNFeCanonical = canonicalizeXml(infNFeMatch[0])

        // 2. Extração do DigestValue gravado
        const digestMatch = signedXml.match(/<DigestValue>([\s\S]*?)<\/DigestValue>/)
        if (!digestMatch) {
            return { isValid: false, reason: '<DigestValue> tag not found' }
        }
        const recordedDigest = digestMatch[1].trim()

        // 3. Recálculo do DigestValue
        const calculatedDigest = crypto
            .createHash('sha1')
            .update(infNFeCanonical, 'utf8')
            .digest('base64')

        if (calculatedDigest !== recordedDigest) {
            return {
                isValid: false,
                reason: `Digest mismatch: calculated ${calculatedDigest}, found ${recordedDigest}`
            }
        }

        // 4. Extração de <SignedInfo>
        const signedInfoMatch = signedXml.match(/<SignedInfo[\s\S]*?<\/SignedInfo>/)
        if (!signedInfoMatch) {
            return { isValid: false, reason: '<SignedInfo> tag not found' }
        }
        const signedInfoCanonical = canonicalizeXml(signedInfoMatch[0])

        // 5. Extração da SignatureValue e Certificado
        const sigValueMatch = signedXml.match(/<SignatureValue>([\s\S]*?)<\/SignatureValue>/)
        const certMatch = signedXml.match(/<X509Certificate>([\s\S]*?)<\/X509Certificate>/)

        if (!sigValueMatch || !certMatch) {
            return { isValid: false, reason: '<SignatureValue> or <X509Certificate> missing' }
        }

        const signatureValue = sigValueMatch[1].replace(/[\r\n\s]/g, '')
        const certBase64 = certMatch[1].replace(/[\r\n\s]/g, '')
        const publicKeyPem = `-----BEGIN CERTIFICATE-----\n${certBase64}\n-----END CERTIFICATE-----`

        // 6. Verificação criptográfica RSA-SHA1
        const verifier = crypto.createVerify('RSA-SHA1')
        verifier.update(signedInfoCanonical, 'utf8')
        const isSignatureValid = verifier.verify(publicKeyPem, signatureValue, 'base64')

        if (!isSignatureValid) {
            return { isValid: false, reason: 'Cryptographic signature verification failed' }
        }

        return { isValid: true }
    } catch (err: any) {
        return { isValid: false, reason: `Verification exception: ${err.message}` }
    }
}