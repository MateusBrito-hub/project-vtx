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