import { describe, it, expect, beforeAll } from 'vitest'
import forge from 'node-forge'
import {
  deriveTenantKey,
  encryptCertificateData,
  decryptCertificateData,
  encryptCertificateText,
  decryptCertificateText
} from '../src/modules/tenant/certificate/certificate.crypto'
import {
  parsePfxCertificate
} from '../src/modules/tenant/certificate/certificate.parser'

describe('Tenant A1 Certificate Crypto & Parser (Task 03)', () => {
  const TENANT_SLUG = 'empresa-matriz'
  const PASSWORD = 'CertPassword123!'

  // Helper para gerar um certificado PKCS#12 ICP-Brasil em memória para testes
  function createTestPfx(options: {
    commonName: string
    password: string
    isExpired?: boolean
  }): { pfxBuffer: Buffer; pfxBase64: string } {
    const pki = forge.pki
    const keys = pki.rsa.generateKeyPair(1024)
    const cert = pki.createCertificate()

    cert.publicKey = keys.publicKey
    cert.serialNumber = '0123456789'

    const now = new Date()
    if (options.isExpired) {
      cert.validity.notBefore = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000)
      cert.validity.notAfter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    } else {
      cert.validity.notBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      cert.validity.notAfter = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
    }

    const attrs = [
      { name: 'commonName', value: options.commonName },
      { name: 'organizationName', value: 'EMPRESA EXEMPLO LTDA' }
    ]
    cert.setSubject(attrs)
    cert.setIssuer(attrs)
    cert.sign(keys.privateKey)

    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], options.password)
    const p12Der = forge.asn1.toDer(p12Asn1).getBytes()
    const pfxBuffer = Buffer.from(p12Der, 'binary')
    const pfxBase64 = forge.util.encode64(p12Der)

    return { pfxBuffer, pfxBase64 }
  }

  describe('Certificate Cryptography (AES-256-GCM & HKDF)', () => {
    it('should derive consistent 32-byte keys for the same tenant and distinct keys for different tenants', () => {
      const key1 = deriveTenantKey('tenant-alpha')
      const key2 = deriveTenantKey('tenant-alpha')
      const key3 = deriveTenantKey('tenant-beta')

      expect(key1).toHaveLength(32)
      expect(key1.equals(key2)).toBe(true)
      expect(key1.equals(key3)).toBe(false)
    })

    it('should encrypt and decrypt binary data cleanly', () => {
      const rawSecret = Buffer.from('Sensitive-Binary-Payload-12345')
      const encrypted = encryptCertificateData(rawSecret, TENANT_SLUG)

      expect(encrypted).toContain(':')
      const decrypted = decryptCertificateData(encrypted, TENANT_SLUG)
      expect(decrypted.equals(rawSecret)).toBe(true)
    })

    it('should encrypt and decrypt text cleanly', () => {
      const secretPassword = 'MySecretCertPassword#2026'
      const encrypted = encryptCertificateText(secretPassword, TENANT_SLUG)
      const decrypted = decryptCertificateText(encrypted, TENANT_SLUG)

      expect(decrypted).toBe(secretPassword)
    })

    it('should fail decryption if auth tag is tampered (Integrity Check)', () => {
      const encrypted = encryptCertificateText('SafePassword', TENANT_SLUG)
      const [iv, authTag, ciphertext] = encrypted.split(':')

      // Modifica o último caractere do authTag
      const tamperedTag = authTag.slice(0, -2) + (authTag.endsWith('0') ? 'ff' : '00')
      const tamperedPayload = `${iv}:${tamperedTag}:${ciphertext}`

      expect(() => decryptCertificateText(tamperedPayload, TENANT_SLUG)).toThrow('Authentication tag mismatch')
    })

    it('should fail decryption if attempted with a different tenant slug (AAD Isolation)', () => {
      const encrypted = encryptCertificateText('ProtectedPassword', 'tenant-a')

      expect(() => decryptCertificateText(encrypted, 'tenant-b')).toThrow('Authentication tag mismatch')
    })

    it('should throw clear error on malformed encrypted payload', () => {
      expect(() => decryptCertificateText('not-a-valid-payload', TENANT_SLUG)).toThrow('expected "iv:authTag:ciphertext"')
    })
  })

  describe('Certificate Parser (PKCS#12 / A1 ICP-Brasil)', () => {
    it('should parse valid PKCS#12 and extract CNPJ, Social Name and validity dates', () => {
      const { pfxBuffer } = createTestPfx({
        commonName: 'SUPERMERCADO CENTRAL LTDA:12345678000195',
        password: PASSWORD
      })

      const info = parsePfxCertificate(pfxBuffer, PASSWORD)

      expect(info.cnpj).toBe('12345678000195')
      expect(info.socialName).toBe('SUPERMERCADO CENTRAL LTDA')
      expect(info.isExpired).toBe(false)
      expect(info.validFrom).toBeInstanceOf(Date)
      expect(info.expiresAt).toBeInstanceOf(Date)
      expect(info.certPem).toContain('-----BEGIN CERTIFICATE-----')
      expect(info.privateKeyPem).toContain('-----BEGIN RSA PRIVATE KEY-----')
    })

    it('should parse certificate from base64 string', () => {
      const { pfxBase64 } = createTestPfx({
        commonName: 'DISTRIBUIDORA NORTE:98765432000188',
        password: PASSWORD
      })

      const info = parsePfxCertificate(pfxBase64, PASSWORD)

      expect(info.cnpj).toBe('98765432000188')
      expect(info.socialName).toBe('DISTRIBUIDORA NORTE')
      expect(info.isExpired).toBe(false)
    })

    it('should detect and flag expired certificates', () => {
      const { pfxBuffer } = createTestPfx({
        commonName: 'AUTO POSTO SUL:11223344000155',
        password: PASSWORD,
        isExpired: true
      })

      const info = parsePfxCertificate(pfxBuffer, PASSWORD)
      expect(info.isExpired).toBe(true)
      expect(info.expiresAt.getTime()).toBeLessThan(Date.now())
    })

    it('should throw error when incorrect password is provided', () => {
      const { pfxBuffer } = createTestPfx({
        commonName: 'LOJA TESTE:12345678000195',
        password: 'CorrectPassword'
      })

      expect(() => parsePfxCertificate(pfxBuffer, 'WrongPassword')).toThrow('Failed to decrypt PKCS#12 certificate')
    })

    it('should throw error on empty or corrupted file', () => {
      expect(() => parsePfxCertificate(Buffer.from([]), 'pass')).toThrow('Certificate PFX data cannot be empty')
      expect(() => parsePfxCertificate(Buffer.from('corrupted data string'), 'pass')).toThrow()
    })
  })
})
