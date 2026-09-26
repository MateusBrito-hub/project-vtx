import { describe, it, expect, beforeAll } from 'vitest'
import forge from 'node-forge'
import {
    buildSoapEnvelope,
    extractSoapBody,
    resolveSefazUrl,
    buildEnviNFe,
    buildConsReciNFe,
    buildConsStatServ,
    createSefazHttpsAgent,
    sendSoapRequest
} from '../src/modules/tenant/fiscal/engine/soap-client'

describe('Native SEFAZ SOAP/WSDL Client (Task 01 - Sprint 4)', () => {
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
            { name: 'commonName', value: 'EMPRESA TESTE SOAP LTDA:11222333000181' },
            { name: 'organizationName', value: 'VTX Test Authority' }
        ]
        cert.setSubject(attrs)
        cert.setIssuer(attrs)
        cert.sign(keys.privateKey)

        testCertPem = pki.certificateToPem(cert)
        testPrivateKeyPem = pki.privateKeyToPem(keys.privateKey)
    })

    describe('1. Montagem do Envelope SOAP 1.2', () => {
        it('deve montar envelope SOAP 1.2 com o namespace oficial da SEFAZ e nfeDadosMsg', () => {
            const payload = '<consStatServ><xServ>STATUS</xServ></consStatServ>'
            const envelope = buildSoapEnvelope('NFeStatusServico4', payload)

            expect(envelope).toContain('soap12:Envelope')
            expect(envelope).toContain('xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"')
            expect(envelope).toContain('<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">')
            expect(envelope).toContain('<xServ>STATUS</xServ>')
            expect(envelope).toContain('</soap12:Envelope>')
        })

        it('deve extrair o conteúdo interno de soap12:Body', () => {
            const rawResponse = `<?xml version="1.0" encoding="utf-8"?>
            <soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
                <soap12:Body>
                    <nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
                        <retConsStatServ versao="4.00">
                            <cStat>107</cStat>
                            <xMotivo>Servico em Operacao</xMotivo>
                        </retConsStatServ>
                    </nfeResultMsg>
                </soap12:Body>
            </soap12:Envelope>`

            const body = extractSoapBody(rawResponse)
            expect(body).toContain('<retConsStatServ versao="4.00">')
            expect(body).toContain('<cStat>107</cStat>')
            expect(body).not.toContain('<soap12:Envelope>')
        })
    })

    describe('2. Resolução de URLs Oficiais da SEFAZ', () => {
        it('deve resolver URLs de Homologação e Produção para SP (Modelo 55)', () => {
            const urlHomolog = resolveSefazUrl({
                uf: 'SP',
                model: '55',
                environment: 'HOMOLOGATION',
                service: 'NFeAutorizacao4'
            })
            expect(urlHomolog).toBe('https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx')

            const urlProd = resolveSefazUrl({
                uf: 'SP',
                model: '55',
                environment: 'PRODUCTION',
                service: 'NFeAutorizacao4'
            })
            expect(urlProd).toBe('https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx')
        })

        it('deve resolver URLs da SVRS para UFs atendidas pelo ambiente compartilhado (ex: RJ, SC, ES)', () => {
            const urlRj = resolveSefazUrl({
                uf: 'RJ',
                model: '55',
                environment: 'HOMOLOGATION',
                service: 'NFeAutorizacao4'
            })
            expect(urlRj).toContain('svrs.rs.gov.br')

            const urlSc = resolveSefazUrl({
                uf: 'SC',
                model: '65',
                environment: 'HOMOLOGATION',
                service: 'NFeAutorizacao4'
            })
            expect(urlSc).toContain('nfce-homologacao.svrs.rs.gov.br')
        })
    })

    describe('3. Construtores de Mensagens SEFAZ (enviNFe, consReciNFe, consStatServ)', () => {
        it('deve montar XML enviNFe com idLote e envio síncrono', () => {
            const xml = '<NFe><infNFe Id="NFe123"></infNFe></NFe>'
            const enviNFe = buildEnviNFe([xml], '1001', true)

            expect(enviNFe).toContain('<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">')
            expect(enviNFe).toContain('<idLote>1001</idLote>')
            expect(enviNFe).toContain('<indSinc>1</indSinc>')
            expect(enviNFe).toContain('<NFe><infNFe Id="NFe123"></infNFe></NFe>')
        })

        it('deve montar XML consReciNFe com o número do recibo', () => {
            const consReci = buildConsReciNFe('351000000000001', 2)
            expect(consReci).toContain('<consReciNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">')
            expect(consReci).toContain('<tpAmb>2</tpAmb>')
            expect(consReci).toContain('<nRec>351000000000001</nRec>')
        })

        it('deve montar XML consStatServ com código da UF e status', () => {
            const consStat = buildConsStatServ('35', 2)
            expect(consStat).toContain('<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">')
            expect(consStat).toContain('<cUF>35</cUF>')
            expect(consStat).toContain('<xServ>STATUS</xServ>')
        })
    })

    describe('4. Configuração de mTLS e Envio com Mock Transport', () => {
        it('deve criar https.Agent configurado com certificado A1 e TLS 1.2 estrito', () => {
            const agent = createSefazHttpsAgent(testCertPem, testPrivateKeyPem)
            expect(agent).toBeDefined()
            expect(agent.options.minVersion).toBe('TLSv1.2')
            expect(agent.options.maxVersion).toBe('TLSv1.2')
            expect(agent.options.cert).toBe(testCertPem)
            expect(agent.options.key).toBe(testPrivateKeyPem)
        })

        it('deve enviar requisição SOAP utilizando transporte injetado e processar retorno', async () => {
            const mockTransport = async (url: string, options: any, body: string) => {
                expect(url).toContain('fazenda.sp.gov.br')
                expect(options.headers['Content-Type']).toContain('application/soap+xml')
                expect(options.headers['Content-Type']).toContain('NFeStatusServico4')
                expect(body).toContain('<xServ>STATUS</xServ>')

                return {
                    statusCode: 200,
                    data: `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
                        <soap12:Body>
                            <retConsStatServ versao="4.00">
                                <cStat>107</cStat>
                                <xMotivo>Servico em Operacao</xMotivo>
                            </retConsStatServ>
                        </soap12:Body>
                    </soap12:Envelope>`,
                    headers: { 'content-type': 'application/soap+xml' }
                }
            }

            const response = await sendSoapRequest({
                url: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
                serviceName: 'NFeStatusServico4',
                payloadXml: '<consStatServ><xServ>STATUS</xServ></consStatServ>',
                certPem: testCertPem,
                privateKeyPem: testPrivateKeyPem,
                transport: mockTransport
            })

            expect(response.statusCode).toBe(200)
            expect(response.soapBody).toContain('<retConsStatServ versao="4.00">')
            expect(response.soapBody).toContain('<cStat>107</cStat>')
            expect(response.soapBody).toContain('Servico em Operacao')
        })
    })
})