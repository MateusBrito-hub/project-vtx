import forge from 'node-forge'

export interface ParsedCertificateInfo {
  cnpj: string
  socialName: string
  validFrom: Date
  expiresAt: Date
  isExpired: boolean
  serialNumber: string
  certPem: string
  privateKeyPem: string
}

/**
 * Faz o parsing de um Certificado Digital A1 (.pfx / .p12) no padrão ICP-Brasil,
 * extraindo CNPJ titular, Razão Social, período de vigência e as chaves em formato PEM.
 */
export function parsePfxCertificate(pfxData: Buffer | string, password: string): ParsedCertificateInfo {
  if (!pfxData || (Buffer.isBuffer(pfxData) && pfxData.length === 0) || (typeof pfxData === 'string' && pfxData.trim().length === 0)) {
    throw new Error('Certificate PFX data cannot be empty')
  }

  // Converte entrada para formato binário exigido pelo node-forge
  let p12Der: string
  if (Buffer.isBuffer(pfxData)) {
    p12Der = forge.util.createBuffer(pfxData.toString('binary')).getBytes()
  } else {
    // String base64
    p12Der = forge.util.decode64(pfxData)
  }

  let p12: forge.pkcs12.Pkcs12Pfx
  try {
    const p12Asn1 = forge.asn1.fromDer(p12Der)
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password || '')
  } catch (err: any) {
    throw new Error(`Failed to decrypt PKCS#12 certificate. Invalid password or corrupted file: ${err.message}`)
  }

  // 1. Extração da bolsa de certificados
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const certBagArray = certBags[forge.pki.oids.certBag]

  if (!certBagArray || certBagArray.length === 0 || !certBagArray[0].cert) {
    throw new Error('No X.509 certificate found inside PKCS#12 container')
  }

  const cert = certBagArray[0].cert

  // 2. Extração da bolsa de chaves privadas
  const keyBags = p12.getBags({
    bagType: forge.pki.oids.pkcs8ShroudedKeyBag
  })
  const keyBagArray = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]

  if (!keyBagArray || keyBagArray.length === 0 || !keyBagArray[0].key) {
    throw new Error('No private key found inside PKCS#12 container')
  }

  const privateKey = keyBagArray[0].key

  // 3. Extração dos atributos do Subject (ICP-Brasil)
  const subjectAttrs = cert.subject.attributes
  const commonNameAttr = subjectAttrs.find((a: any) => a.name === 'commonName' || a.shortName === 'CN')
  const commonName = commonNameAttr ? String(commonNameAttr.value) : ''

  const orgAttr = subjectAttrs.find((a: any) => a.name === 'organizationName' || a.shortName === 'O')
  const organization = orgAttr ? String(orgAttr.value) : ''

  // Padrão ICP-Brasil: "RAZAO SOCIAL:CNPJ" ou "NOME:CPF"
  let cnpj = ''
  let socialName = ''

  if (commonName.includes(':')) {
    const parts = commonName.split(':')
    socialName = parts[0].trim()
    const potentialDoc = parts[parts.length - 1].replace(/\D/g, '')
    if (potentialDoc.length === 14 || potentialDoc.length === 11) {
      cnpj = potentialDoc
    }
  }

  // Fallback: procura por qualquer sequência de 14 dígitos (CNPJ) no Common Name
  if (!cnpj) {
    const match = commonName.match(/\b\d{14}\b/)
    if (match) {
      cnpj = match[0]
    }
  }

  if (!socialName) {
    socialName = organization || commonName
  }

  // 4. Período de vigência
  const validFrom = cert.validity.notBefore
  const expiresAt = cert.validity.notAfter
  const isExpired = expiresAt.getTime() < Date.now()

  // 5. Conversão para PEM (necessário para assinatura XMLDSig via SEFAZ)
  const certPem = forge.pki.certificateToPem(cert)
  const privateKeyPem = forge.pki.privateKeyToPem(privateKey)

  return {
    cnpj,
    socialName,
    validFrom,
    expiresAt,
    isExpired,
    serialNumber: cert.serialNumber,
    certPem,
    privateKeyPem
  }
}
