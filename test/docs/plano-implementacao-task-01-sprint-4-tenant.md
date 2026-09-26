# Plano de Implementação — TASK 01 (Sprint 4 - Tenant)
## Cliente SOAP/WSDL Nativo com SEFAZ (mTLS 1.2 com Certificado A1 e Endpoints SVRS/Estaduais)

| Metadado | Detalhe |
|---|---|
| **Fase** | 2 — VTX Tenant (Sistema Fiscal Cloud Multi-Filial) |
| **Sprint** | 4 — Transmissão SEFAZ, DANFE e Sincronização de Quota com o Core |
| **Task** | 01 — Cliente SOAP/WSDL Nativo com SEFAZ (mTLS 1.2) |
| **Papel do PO** | Especificação de arquitetura, envelopes SOAP 1.2, tabela de endpoints SEFAZ, testes e relatórios |
| **Papel do Desenvolvedor** | Codificação de `src/modules/tenant/fiscal/engine/soap-client.ts` e `test/soap-client.test.ts` |
| **Padrão Normativo** | MOC SEFAZ v4.00 (Visão Geral e Webservices), W3C SOAP 1.2, IETF RFC 5246 (TLS 1.2) |

---

## 1. Diretrizes Arquiteturais e Governança

1. **Separação Rígida de Papéis:**
   * O **Product Owner (PO)** especifica os requisitos de negócio, arquitetura, contratos SOAP, interfaces e critérios de aceite, audita os resultados, executa os comandos de teste/build e emite os relatórios formais em `test/docs/` e `relatorios/`.
   * O **Desenvolvedor (Usuário)** implementa o código-fonte em `src/` e os arquivos de teste em `test/`.
2. **Autenticação Mútua TLS 1.2 (mTLS) 100% Nativa:**
   * A SEFAZ exige que a conexão HTTPS utilize autenticação mútua de cliente (mTLS), onde o cliente apresenta o Certificado Digital ICP-Brasil A1 (chave pública e privada) durante o handshake TLS.
   * Utilizar exclusivamente os módulos nativos do Node.js (`node:https` e `node:tls`) com configuração restrita a `minVersion: 'TLSv1.2'`, sem dependência de ferramentas externas como Java bridges ou wrappers C++.
3. **Padrão SOAP 1.2 Oficial SEFAZ:**
   * Namespace SOAP: `http://www.w3.org/2003/05/soap-envelope`;
   * Content-Type: `application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/{serviceName}"`;
   * Tag de dados: `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/{serviceName}">`.
4. **Testabilidade e Injeção de Transporte:**
   * O cliente SOAP deve permitir a injeção opcional de um `transport` customizado para viabilizar testes unitários e de integração determinísticos sem dependência da rede externa ou dos servidores de homologação da SEFAZ.

---

## 2. Arquitetura e Arquivos Envolvidos

| Tipo | Caminho | Responsável | Descrição |
|:---:|---|:---:|---|
| **[NEW]** | `src/modules/tenant/fiscal/engine/soap-client.ts` | Desenvolvedor | Motor nativo de comunicação SOAP 1.2 com mTLS, resolução de URLs SEFAZ e envelopes |
| **[NEW]** | `test/soap-client.test.ts` | Desenvolvedor | Suíte de testes unitários cobrindo mTLS, resolução de endpoints, envelopes e tratamento de falhas |
| **[NEW]** | `test/docs/plano-implementacao-task-01-sprint-4-tenant.md` | PO | Documento canônico do plano de implementação da Task 01 com códigos de exemplo |
| **[NEW]** | `relatorios/plano-implementacao-task-01-sprint-4-tenant.md` | PO | Espelho do plano de implementação na pasta de relatórios |
| **[NEW]** | `test/docs/relatorio-alteracoes-task-01-sprint-4-tenant.md` | PO | Relatório formal de conformidade de 10 seções (pós-execução) |
| **[NEW]** | `relatorios/relatorio-alteracoes-task-01-sprint-4-tenant.md` | PO | Espelho do relatório formal na pasta de relatórios |

---

## 3. Especificação dos Serviços e Envelopes SOAP SEFAZ

### 3.1. Envelope SOAP 1.2 Canônico
```xml
<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/${serviceName}">
      ${payloadXml}
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>
```

### 3.2. Serviços Suportados
1. **`NFeAutorizacao4`:**
   * Envio de lote com `<enviNFe versao="4.00">`;
   * Suporte a envio síncrono (`<indSinc>1</indSinc>`) e assíncrono (`<indSinc>0</indSinc>`);
2. **`NFeRetAutorizacao4`:**
   * Consulta de recibo de lote com `<consReciNFe versao="4.00">`;
3. **`NFeStatusServico4`:**
   * Consulta do status operacional dos servidores SEFAZ com `<consStatServ versao="4.00">`;
4. **`NFeRecepcaoEvento4`:**
   * Envio de eventos (Cancelamento e CC-e) com `<envEvento versao="1.00">`.

---

## 4. Códigos de Exemplo e Referência para Implementação

### 4.1. Código de Referência: `src/modules/tenant/fiscal/engine/soap-client.ts`

```typescript
import https from 'node:https'
import { URL } from 'node:url'

export type SefazService =
    | 'NFeAutorizacao4'
    | 'NFeRetAutorizacao4'
    | 'NFeStatusServico4'
    | 'NFeInutilizacao4'
    | 'NFeRecepcaoEvento4'

export interface SefazEndpointParams {
    uf: string
    model: '55' | '65'
    environment: 'HOMOLOGATION' | 'PRODUCTION'
    service: SefazService
}

export type CustomTransport = (
    url: string,
    options: {
        method: string
        headers: Record<string, string>
        agent?: https.Agent
        timeout?: number
    },
    body: string
) => Promise<{ statusCode: number; data: string; headers: Record<string, string> }>

export interface SoapRequestOptions {
    url: string
    serviceName: SefazService
    payloadXml: string
    certPem: string
    privateKeyPem: string
    timeoutMs?: number
    transport?: CustomTransport
}

export interface SoapResponse {
    statusCode: number
    data: string
    soapBody: string
    headers: Record<string, string>
}

// UFs atendidas pela SEFAZ Virtual do Rio Grande do Sul (SVRS)
export const SVRS_UFS = new Set([
    'AC', 'AL', 'AP', 'DF', 'ES', 'PB', 'PI', 'RJ', 'RN', 'RO', 'RR', 'SC', 'SE', 'TO'
])

// Tabela de Endpoints Oficiais SEFAZ (PL_009_V4 / MOC v4.00)
export const SEFAZ_SERVERS: Record<string, Record<'HOMOLOGATION' | 'PRODUCTION', Record<SefazService, string>>> = {
    // São Paulo (SP) - NF-e (Modelo 55)
    SP_55: {
        HOMOLOGATION: {
            NFeAutorizacao4: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
            NFeRetAutorizacao4: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx',
            NFeStatusServico4: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
            NFeInutilizacao4: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx',
            NFeRecepcaoEvento4: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeevento4.asmx'
        },
        PRODUCTION: {
            NFeAutorizacao4: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
            NFeRetAutorizacao4: 'https://nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx',
            NFeStatusServico4: 'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
            NFeInutilizacao4: 'https://nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx',
            NFeRecepcaoEvento4: 'https://nfe.fazenda.sp.gov.br/ws/nfeevento4.asmx'
        }
    },
    // São Paulo (SP) - NFC-e (Modelo 65)
    SP_65: {
        HOMOLOGATION: {
            NFeAutorizacao4: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
            NFeRetAutorizacao4: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx',
            NFeStatusServico4: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
            NFeInutilizacao4: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx',
            NFeRecepcaoEvento4: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/nfeevento4.asmx'
        },
        PRODUCTION: {
            NFeAutorizacao4: 'https://nfce.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
            NFeRetAutorizacao4: 'https://nfce.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx',
            NFeStatusServico4: 'https://nfce.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
            NFeInutilizacao4: 'https://nfce.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx',
            NFeRecepcaoEvento4: 'https://nfce.fazenda.sp.gov.br/ws/nfeevento4.asmx'
        }
    },
    // SEFAZ Virtual do RS (SVRS) - NF-e (Modelo 55)
    SVRS_55: {
        HOMOLOGATION: {
            NFeAutorizacao4: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
            NFeRetAutorizacao4: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
            NFeStatusServico4: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
            NFeInutilizacao4: 'https://nfe-homologacao.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
            NFeRecepcaoEvento4: 'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx'
        },
        PRODUCTION: {
            NFeAutorizacao4: 'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
            NFeRetAutorizacao4: 'https://nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
            NFeStatusServico4: 'https://nfe.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
            NFeInutilizacao4: 'https://nfe.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
            NFeRecepcaoEvento4: 'https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx'
        }
    },
    // SEFAZ Virtual do RS (SVRS) - NFC-e (Modelo 65)
    SVRS_65: {
        HOMOLOGATION: {
            NFeAutorizacao4: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
            NFeRetAutorizacao4: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
            NFeStatusServico4: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
            NFeInutilizacao4: 'https://nfce-homologacao.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
            NFeRecepcaoEvento4: 'https://nfce-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx'
        },
        PRODUCTION: {
            NFeAutorizacao4: 'https://nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
            NFeRetAutorizacao4: 'https://nfce.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
            NFeStatusServico4: 'https://nfce.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
            NFeInutilizacao4: 'https://nfce.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
            NFeRecepcaoEvento4: 'https://nfce.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx'
        }
    }
}

/**
 * Resolve a URL oficial do Web Service SEFAZ com base na UF, Modelo e Ambiente.
 */
export function resolveSefazUrl(params: SefazEndpointParams): string {
    const ufUpper = params.uf.toUpperCase()
    let serverKey: string

    if (ufUpper === 'SP') {
        serverKey = `SP_${params.model}`
    } else if (SVRS_UFS.has(ufUpper)) {
        serverKey = `SVRS_${params.model}`
    } else {
        // Fallback padrão para demais UFs operadas por SVRS
        serverKey = `SVRS_${params.model}`
    }

    const server = SEFAZ_SERVERS[serverKey]
    if (!server) {
        throw new Error(`SEFAZ server configuration not found for key: ${serverKey}`)
    }

    const envUrls = server[params.environment]
    if (!envUrls) {
        throw new Error(`Environment ${params.environment} not supported for ${serverKey}`)
    }

    const url = envUrls[params.service]
    if (!url) {
        throw new Error(`Service ${params.service} not found for ${serverKey} in ${params.environment}`)
    }

    return url
}

/**
 * Monta o Envelope SOAP 1.2 com a tag <nfeDadosMsg>.
 */
export function buildSoapEnvelope(serviceName: SefazService, payloadXml: string): string {
    const cleanPayload = payloadXml.replace(/<\?xml[^>]*\?>/g, '').trim()
    return `<?xml version="1.0" encoding="utf-8"?>` +
        `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
        `xmlns:xsd="http://www.w3.org/2001/XMLSchema" ` +
        `xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
        `<soap12:Body>` +
        `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/${serviceName}">` +
        `${cleanPayload}` +
        `</nfeDadosMsg>` +
        `</soap12:Body>` +
        `</soap12:Envelope>`
}

/**
 * Extrai o conteúdo XML contido dentro de <soap12:Body> ou <soap:Body>.
 */
export function extractSoapBody(responseXml: string): string {
    const bodyMatch = responseXml.match(/<[^:]*:?Body[^>]*>([\s\S]*?)<\/[^:]*:?Body>/i)
    if (!bodyMatch || !bodyMatch[1]) {
        return responseXml.trim()
    }
    return bodyMatch[1].trim()
}

/**
 * Monta o XML de envio de lote <enviNFe>.
 */
export function buildEnviNFe(xmlList: string[], idLote: string, indSinc: boolean = true): string {
    const xmlsJoined = xmlList.map(x => x.replace(/<\?xml[^>]*\?>/g, '').trim()).join('')
    return `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
        `<idLote>${idLote}</idLote>` +
        `<indSinc>${indSinc ? '1' : '0'}</indSinc>` +
        `${xmlsJoined}` +
        `</enviNFe>`
}

/**
 * Monta o XML de consulta de recibo de lote <consReciNFe>.
 */
export function buildConsReciNFe(nRec: string, tpAmb: 1 | 2 = 2): string {
    return `<consReciNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
        `<tpAmb>${tpAmb}</tpAmb>` +
        `<nRec>${nRec}</nRec>` +
        `</consReciNFe>`
}

/**
 * Monta o XML de consulta de status de serviço <consStatServ>.
 */
export function buildConsStatServ(cUF: string, tpAmb: 1 | 2 = 2): string {
    return `<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
        `<tpAmb>${tpAmb}</tpAmb>` +
        `<cUF>${cUF}</cUF>` +
        `<xServ>STATUS</xServ>` +
        `</consStatServ>`
}

/**
 * Cria o agente HTTPS com autenticação mTLS (Mutual TLS 1.2).
 */
export function createSefazHttpsAgent(certPem: string, privateKeyPem: string): https.Agent {
    return new https.Agent({
        cert: certPem,
        key: privateKeyPem,
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.2',
        rejectUnauthorized: true,
        keepAlive: false
    })
}

/**
 * Executa a requisição SOAP 1.2 mTLS com a SEFAZ.
 */
export async function sendSoapRequest(options: SoapRequestOptions): Promise<SoapResponse> {
    const { url, serviceName, payloadXml, certPem, privateKeyPem, timeoutMs = 30000, transport } = options

    const envelope = buildSoapEnvelope(serviceName, payloadXml)
    const action = `http://www.portalfiscal.inf.br/nfe/wsdl/${serviceName}`
    const headers: Record<string, string> = {
        'Content-Type': `application/soap+xml; charset=utf-8; action="${action}"`,
        'Content-Length': Buffer.byteLength(envelope, 'utf-8').toString(),
        'Accept': 'application/soap+xml, text/xml'
    }

    // Suporte a transporte customizado (injeção em testes unitários)
    if (transport) {
        const res = await transport(url, { method: 'POST', headers, timeout: timeoutMs }, envelope)
        const soapBody = extractSoapBody(res.data)
        return {
            statusCode: res.statusCode,
            data: res.data,
            soapBody,
            headers: res.headers
        }
    }

    const agent = createSefazHttpsAgent(certPem, privateKeyPem)
    const targetUrl = new URL(url)

    return new Promise((resolve, reject) => {
        const req = https.request(
            targetUrl,
            {
                method: 'POST',
                headers,
                agent,
                timeout: timeoutMs
            },
            (res) => {
                let responseData = ''
                res.setEncoding('utf8')

                res.on('data', (chunk) => {
                    responseData += chunk
                })

                res.on('end', () => {
                    const soapBody = extractSoapBody(responseData)
                    resolve({
                        statusCode: res.statusCode || 200,
                        data: responseData,
                        soapBody,
                        headers: res.headers as Record<string, string>
                    })
                })
            }
        )

        req.on('timeout', () => {
            req.destroy()
            const error = new Error(`SEFAZ connection timeout after ${timeoutMs}ms`)
            ;(error as any).code = 'SEFAZ_TIMEOUT'
            reject(error)
        })

        req.on('error', (err) => {
            reject(err)
        })

        req.write(envelope)
        req.end()
    })
}
```

---

### 4.2. Código de Referência: `test/soap-client.test.ts`

```typescript
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
```

---

## 5. Critérios de Aceite da Task 01

- [ ] Motor nativo `soap-client.ts` sem dependências terceiras para comunicação SOAP 1.2 com a SEFAZ;
- [ ] Implementação de `createSefazHttpsAgent` com negociação mTLS restrita a TLS 1.2 (`certPem` e `privateKeyPem`);
- [ ] Tabela de URLs oficiais SEFAZ para NF-e (55) e NFC-e (65) cobrindo ambientes de Homologação e Produção (SP e SVRS);
- [ ] Montadores de envelopes SOAP 1.2 com tag `<nfeDadosMsg>` e extrator de `<soap12:Body>`;
- [ ] Montadores de XMLs auxiliares da SEFAZ: `<enviNFe>`, `<consReciNFe>` e `<consStatServ>`;
- [ ] 100% de aprovação na suíte `test/soap-client.test.ts`;
- [ ] Compilação limpa do projeto com `npm run build` (`tsc 0`).

---

## 6. Comandos de Validação do PO

```powershell
cmd /c npm run build
cmd /c npx vitest run test/soap-client.test.ts
cmd /c npm test -- --run
```
