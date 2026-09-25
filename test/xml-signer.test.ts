import { describe, expect, it, beforeAll } from 'vitest'
import forge from 'node-forge'
import { buildNFeXml } from '../src/modules/tenant/fiscal/engine/nfe-builder'
import { buildNFCeXml } from '../src/modules/tenant/fiscal/engine/nfce-builder'
import {
    canonicalizeXml,
    extractAccessKeyFromXml,
    signXml,
    verifyXmlSignature
} from '../src/modules/tenant/fiscal/engine/xml-signer'

describe('Native XMLDSig Signer & Verifier (Task 03 - Sprint 3)', () => {
    let testCertPem: string
    let testPrivateKeyPem: string

    beforeAll(() => {
        const pki = forge.pki
        const keys = pki.rsa.generateKeyPair(1024)
        const cert = pki.createCertificate()

        cert.publicKey = keys.publicKey
        cert.serialNumber = '1001'
        cert.validity.notBefore = new Date()
        cert.validity.notAfter = new Date(new Date().getTime() + 365 * 24 * 60 * 60 * 1000)

        const attrs = [
            { name: 'commonName', value: 'EMPRESA TESTE A1 LTDA:12345678000195' },
            { name: 'organizationName', value: 'VTX Test Authority' }
        ]
        cert.setSubject(attrs)
        cert.setIssuer(attrs)
        cert.sign(keys.privateKey)

        testCertPem = pki.certificateToPem(cert)
        testPrivateKeyPem = pki.privateKeyToPem(keys.privateKey)
    })

    const sampleCompany = {
        cnpj: '12345678000195',
        socialName: 'Empresa Teste A1 LTDA',
        fantasyName: 'Teste A1',
        ie: '123456789',
        crt: '1' as const,
        street: 'Av Paulista',
        number: '100',
        district: 'Centro',
        cityCode: '3550308',
        cityName: 'São Paulo',
        uf: 'SP',
        zipCode: '01001000',
        phone: '11999999999'
    }

    const sampleCustomer = {
        cpfCnpj: '98765432000180',
        name: 'Cliente Assinatura',
        indicadorIe: 9,
        street: 'Rua Central',
        number: '200',
        district: 'Bela Vista',
        cityCode: '3550308',
        cityName: 'São Paulo',
        uf: 'SP',
        zipCode: '01310100'
    }

    describe('1. Canonicalização e Extração', () => {
        it('deve extrair a Chave de Acesso de 44 dígitos da tag infNFe', () => {
            const rawXml = '<NFe><infNFe Id="NFe35260912345678000195550010000000011123456784" versao="4.00"></infNFe></NFe>'
            const key = extractAccessKeyFromXml(rawXml)
            expect(key).toBe('35260912345678000195550010000000011123456784')
        })

        it('deve ordenar atributos Id antes de versao na canonicalização C14N', () => {
            const nonCanonical = '<infNFe versao="4.00" Id="NFe12345678901234567890123456789012345678901234">'
            const canonical = canonicalizeXml(nonCanonical)
            expect(canonical).toContain('<infNFe Id="NFe12345678901234567890123456789012345678901234" versao="4.00">')
        })
    })

    describe('2. Assinatura Digital da NF-e (Modelo 55)', () => {
        it('deve assinar o XML da NF-e gerando DigestValue e SignatureValue válidos', () => {
            const nfe = buildNFeXml({
                series: 1,
                number: 10,
                company: sampleCompany,
                customer: sampleCustomer,
                items: [
                    {
                        sku: 'SKU-01',
                        description: 'Produto Assinado',
                        ncm: '84713012',
                        cfop: '5102',
                        unit: 'UN',
                        quantity: 1,
                        unitPrice: 100
                    }
                ],
                payments: [{ tPag: '01', vPag: 100 }]
            })

            const signResult = signXml({
                xml: nfe.xml,
                privateKeyPem: testPrivateKeyPem,
                certPem: testCertPem
            })

            expect(signResult.signedXml).toContain('<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">')
            expect(signResult.signedXml).toContain(`<DigestValue>${signResult.digestValue}</DigestValue>`)
            expect(signResult.signedXml).toContain(`<SignatureValue>${signResult.signatureValue}</SignatureValue>`)
            expect(signResult.signedXml).toContain('<X509Certificate>')

            const verifyResult = verifyXmlSignature(signResult.signedXml)
            expect(verifyResult.isValid).toBe(true)
        })
    })

    describe('3. Assinatura Digital da NFC-e (Modelo 65)', () => {
        it('deve assinar o XML da NFC-e contendo infNFeSupl mantendo a integridade', () => {
            const nfce = buildNFCeXml({
                series: 1,
                number: 20,
                cscIdToken: '000001',
                cscToken: 'SECRET_CSC_TOKEN_1234567890',
                company: sampleCompany,
                items: [
                    {
                        sku: 'SKU-CUPOM',
                        description: 'Item de Cupom Presencial',
                        ncm: '09012100',
                        cfop: '5102',
                        unit: 'UN',
                        quantity: 1,
                        unitPrice: 20
                    }
                ],
                payments: [{ tPag: '17', vPag: 20 }]
            })

            const signResult = signXml({
                xml: nfce.xml,
                privateKeyPem: testPrivateKeyPem,
                certPem: testCertPem
            })

            expect(signResult.signedXml).toContain('<infNFeSupl>')
            expect(signResult.signedXml).toContain('<qrCode>')
            expect(signResult.signedXml).toContain('<Signature')

            const verifyResult = verifyXmlSignature(signResult.signedXml)
            expect(verifyResult.isValid).toBe(true)
        })
    })

    describe('4. Detecção de Adulteração e Segurança', () => {
        it('deve rejeitar e detectar alteração fraudulenta de valores no XML assinado', () => {
            const nfe = buildNFeXml({
                series: 1,
                number: 30,
                company: sampleCompany,
                customer: sampleCustomer,
                items: [
                    {
                        sku: 'SKU-VALOR',
                        description: 'Item Teste',
                        ncm: '84713012',
                        cfop: '5102',
                        unit: 'UN',
                        quantity: 1,
                        unitPrice: 50
                    }
                ],
                payments: [{ tPag: '01', vPag: 50 }]
            })

            const { signedXml } = signXml({
                xml: nfe.xml,
                privateKeyPem: testPrivateKeyPem,
                certPem: testCertPem
            })

            // Tentativa de fraude: alterar o valor de 50.00 para 5.00
            const tamperedXml = signedXml.replace('<vProd>50.00</vProd>', '<vProd>5.00</vProd>')

            const verifyResult = verifyXmlSignature(tamperedXml)
            expect(verifyResult.isValid).toBe(false)
            expect(verifyResult.reason).toContain('Digest mismatch')
        })

        it('deve rejeitar assinatura se a chave privada não corresponder ao certificado', () => {
            const pki = forge.pki
            const secondKeys = pki.rsa.generateKeyPair(1024)
            const mismatchedPrivateKeyPem = pki.privateKeyToPem(secondKeys.privateKey)

            const nfe = buildNFeXml({
                series: 1,
                number: 40,
                company: sampleCompany,
                customer: sampleCustomer,
                items: [
                    {
                        sku: 'SKU-01',
                        description: 'Teste Chave Incorreta',
                        ncm: '84713012',
                        cfop: '5102',
                        unit: 'UN',
                        quantity: 1,
                        unitPrice: 10
                    }
                ],
                payments: [{ tPag: '01', vPag: 10 }]
            })

            const { signedXml } = signXml({
                xml: nfe.xml,
                privateKeyPem: mismatchedPrivateKeyPem,
                certPem: testCertPem
            })

            const verifyResult = verifyXmlSignature(signedXml)
            expect(verifyResult.isValid).toBe(false)
            expect(verifyResult.reason).toContain('Cryptographic signature verification failed')
        })
    })
})