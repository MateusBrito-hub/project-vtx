import crypto from 'node:crypto'

/**
 * Deriva uma chave simétrica de 256 bits (32 bytes) utilizando HKDF-SHA256,
 * vinculando o segredo mestre ao slug do tenant para garantir isolamento criptográfico.
 */
export function deriveTenantKey(tenantSlug: string): Buffer {
  if (!tenantSlug || typeof tenantSlug !== 'string') {
    throw new Error('Tenant slug is required for key derivation')
  }

  const masterSecret = process.env.CERTIFICATE_MASTER_KEY || process.env.JWT_SECRET || 'vtx-default-master-key-change-in-production'
  const salt = Buffer.from(tenantSlug.trim().toLowerCase(), 'utf-8')
  const info = Buffer.from('vtx-tenant-certificate-aes-256-gcm', 'utf-8')

  const derivedKey = crypto.hkdfSync('sha256', masterSecret, salt, info, 32)
  return Buffer.from(derivedKey)
}

/**
 * Criptografa dados binários ou texto com AES-256-GCM e AAD (Additional Authenticated Data).
 * Retorna payload no formato: <iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encryptCertificateData(data: Buffer | string, tenantSlug: string): string {
  const bufferData = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8')
  const key = deriveTenantKey(tenantSlug)
  const iv = crypto.randomBytes(12) // 96 bits recomendado para GCM

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(tenantSlug.trim().toLowerCase(), 'utf-8'))

  const ciphertext = Buffer.concat([cipher.update(bufferData), cipher.final()])
  const authTag = cipher.getAuthTag() // 128 bits (16 bytes)

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`
}

/**
 * Descriptografa um payload criptografado com AES-256-GCM.
 * Lança erro de autenticidade caso o authTag não coincida ou o slug seja diferente.
 */
export function decryptCertificateData(encryptedPayload: string, tenantSlug: string): Buffer {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') {
    throw new Error('Invalid encrypted payload: must be a non-empty string')
  }

  const parts = encryptedPayload.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format: expected "iv:authTag:ciphertext"')
  }

  const [ivHex, authTagHex, ciphertextHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')

  if (iv.length !== 12) {
    throw new Error('Invalid IV length: expected 12 bytes')
  }
  if (authTag.length !== 16) {
    throw new Error('Invalid AuthTag length: expected 16 bytes')
  }

  const key = deriveTenantKey(tenantSlug)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAAD(Buffer.from(tenantSlug.trim().toLowerCase(), 'utf-8'))
  decipher.setAuthTag(authTag)

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return decrypted
  } catch (err: any) {
    throw new Error(`Failed to decrypt certificate data: Authentication tag mismatch or corrupted data (${err.message})`)
  }
}

/**
 * Criptografa string e retorna o payload autenticado.
 */
export function encryptCertificateText(text: string, tenantSlug: string): string {
  return encryptCertificateData(text, tenantSlug)
}

/**
 * Descriptografa payload e retorna a string UTF-8.
 */
export function decryptCertificateText(encryptedPayload: string, tenantSlug: string): string {
  const buffer = decryptCertificateData(encryptedPayload, tenantSlug)
  return buffer.toString('utf-8')
}
