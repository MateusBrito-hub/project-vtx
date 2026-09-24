# Plano de Execução — Sprint 3 (Tenant) do `project-vtx`
## Geração de XML (PL_009_V4 com Reforma Tributária), QR-Code 2.0 e Assinador Digital Nativo XMLDSig

| Metadado | Detalhe |
|---|---|
| **Sprint** | 3 (Tenant) — Geração de XML, Assinatura Digital e Validação XSD |
| **Projeto** | `MateusBrito-hub/project-vtx` (Módulo `src/modules/tenant/`) |
| **Branch base** | `master` |
| **Papel do Assistente** | Product Owner (PO) & Auditor de Qualidade (Acesso de edição restrito a `test/docs/` e `relatorios/`) |
| **Papel do Usuário** | Desenvolvedor Responsável (Implementação de código em `src/`, `prisma/` e `test/`) |
| **Duração de referência** | 1 semana |
| **Marco Regulatório** | MOC SEFAZ v4.00 (PL_009_V4), Padrão ICP-Brasil (XMLDSig), EC 132/2023, PLP 68/2024 |

---

## 1. Objetivo da Sprint 3 (Tenant)

Construir o **Motor Fiscal Nativo Proprietário** da plataforma VTX, tornando o sistema 100% autônomo (zero taxas com gateways terceiros) para montagem do XML padrão SEFAZ de **NF-e (Modelo 55)** e **NFC-e (Modelo 65)** incluindo os nós da Reforma Tributária (IBS/CBS/IS), algoritmo de **QR-Code 2.0** com token CSC e o assinador criptográfico **XMLDSig** utilizando o Certificado Digital A1.

---

## 2. Forma de Trabalho e Governança

1. **Separação Rígida de Papéis:**
   * O **Product Owner (PO)** especifica os requisitos técnicos e matemáticos, schemas de XML, regras de canonicalização C14N e algoritmos de digest SHA-1, audita as entregas, roda a pipeline de testes e emite os relatórios em `test/docs/` e `relatorios/`.
   * O **Desenvolvedor (Usuário)** implementa o código-fonte em `src/` e as suítes de teste em `test/`.
2. **Critérios de Homologação:**
   * XMLs gerados devem cumprir rigorosamente com a sintaxe do Manual de Orientação do Contribuinte (MOC 4.00);
   * Chave de Acesso de 44 dígitos com dígito verificador calculado por Módulo 11 ponderado;
   * Assinatura XMLDSig com tag `<Signature>` verificável via RSA-SHA1 com o certificado ICP-Brasil em formato PEM;
   * 100% dos testes verdes e compilação TypeScript limpa (`npm run build`).

---

## 3. Ordem de Execução das Tasks da Sprint 3

| Ordem | Task | Foco | Prioridade | Esforço | Dependências |
|:---:|---|---|:---:|:---:|:---:|
| **1** | **TASK 01 (Tenant)** | Construtor do XML NF-e (Mod. 55) Padrão PL_009_V4 com Reforma Tributária | 🔴 Alta | Alto | Sprint 2 |
| **2** | **TASK 02 (Tenant)** | Construtor do XML NFC-e (Mod. 65) e Algoritmo de QR-Code 2.0 (Hash CSC) | 🟠 Alta | Médio-Alto | Task 01 |
| **3** | **TASK 03 (Tenant)** | Assinador Digital Nativo XMLDSig padrão ICP-Brasil (RSA-SHA1 com Certificado A1) | 🔴 Alta | Alto | Tasks 01 e 02 |
| **4** | **TASK 04 (Tenant)** | Validador Local Estrutural XSD, Orquestrador de Emissão e Fechamento | 🟠 Alta | Médio-Alto | Tasks 01, 02 e 03 |

---

# TASK 01 (Tenant) — Construtor do XML NF-e (Modelo 55) Padrão PL_009_V4 com Reforma Tributária

## Prioridade
🔴 **Alta**

## Objetivo
Criar o gerador de XML em `src/modules/tenant/fiscal/engine/nfe-builder.ts` capaz de gerar o documento eletrônico no leiaute oficial da SEFAZ (v4.00) integrando dados da empresa emissora (`Company`), destinatário (`Customer`), catálogo de itens (`Product`), cálculo tributário (`tax-calculator.ts`) e os novos nós de IBS/CBS/IS da Reforma Tributária.

## Regras Técnicas:
1. **Algoritmo da Chave de Acesso (44 dígitos):**
   * $\text{cUF (2)} + \text{AAMM (4)} + \text{CNPJ (14)} + \text{mod (2, '55')} + \text{serie (3)} + \text{nNF (9)} + \text{tpEmis (1, '1')} + \text{cNF (8)} + \text{cDV (1)}$;
   * O `cDV` é o resto ponderado da divisão da soma ponderada (pesos 2 a 9 da direita para a esquerda) por 11 ($11 - \text{resto}$, ou $0$ se resto for 0 ou 1).
2. **Estrutura Hierárquica SEFAZ:**
   * `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">`
     * `<infNFe Id="NFe{chave44}" versao="4.00">`
       * `<ide>`, `<emit>`, `<dest>`, `<det>`, `<total>`, `<transp>`, `<pag>`, `<infAdic>`.
3. **Nós da Reforma Tributária por Item:**
   * Dentro de `<det><imposto>`:
     * `<IBS>`: `<cstIBS>`, `<vBC>`, `<pIBSUF>`, `<vIBSUF>`, `<pIBSMun>`, `<vIBSMun>`, `<vIBS>`;
     * `<CBS>`: `<cstCBS>`, `<vBC>`, `<pCBS>`, `<vCBS>`;
     * `<IS>`: `<vBC>`, `<pIS>`, `<vIS>` (se aplicável).

---

# TASK 02 (Tenant) — Construtor do XML NFC-e (Modelo 65) e Algoritmo de QR-Code 2.0

## Prioridade
🟠 **Alta**

## Objetivo
Criar o gerador de XML de Nota Fiscal de Consumidor Eletrônica em `src/modules/tenant/fiscal/engine/nfce-builder.ts` com suporte a consumidor não identificado (ou identificado no `<dest>`), contingência offline (`tpEmis = 9`) e geração da URL e hash SHA-1 do **QR-Code Versão 2.0**.

## Regras Técnicas:
1. Modelo fiscal: `65`;
2. Algoritmo de QR-Code 2.0 da NFC-e:
   * String de parâmetros: `chNFe={chave}&nVersao=2&tpAmb={tpAmb}&cDest={cpfCnpj}&dhEmi={hex}&vNF={total}&vICMS={icms}&digVal={hex}&cIdToken={cscId}`;
   * Hash SHA-1: `sha1(stringParametros + cscToken)`;
   * Nó `<infNFeSupl><qrCode>{url}?p={stringParametros}|{hashSHA1}</qrCode></infNFeSupl>`.

---

# TASK 03 (Tenant) — Assinador Digital Nativo XMLDSig (RSA-SHA1 com Certificado A1)

## Prioridade
🔴 **Alta**

## Objetivo
Implementar o motor de assinatura digital W3C XMLDSig padrão ICP-Brasil em `src/modules/tenant/fiscal/engine/xml-signer.ts` para assinar digitalmente o XML da NF-e e NFC-e utilizando a chave privada RSA do Certificado A1 cadastrado na empresa emissora.

## Regras Técnicas:
1. Canonicalização C14N sem comentários da tag `<infNFe>`;
2. Geração do Digest SHA-1 do conteúdo canonicalizado (`<DigestValue>`);
3. Montagem da tag `<SignedInfo>`;
4. Assinatura RSA com SHA-1 (`rsa-sha1`) da tag `<SignedInfo>` canonicalizada, gerando `<SignatureValue>`;
5. Inclusão de `<KeyInfo><X509Data><X509Certificate>` com o certificado em Base64;
6. Injeção da tag `<Signature>` como filha direta de `<NFe>` logo após `<infNFe>`.

---

# TASK 04 (Tenant) — Validador Local XSD, Orquestrador de Emissão e Fechamento

## Prioridade
🟠 **Alta**

## Objetivo
Construir o validador sintático de esquemas XSD em `src/modules/tenant/fiscal/engine/xsd-validator.ts` e o orquestrador de serviço de emissão em `src/modules/tenant/fiscal/fiscal-emission.service.ts`, unindo:
1. Verificação de Quota (`quotaService.assertEmissionQuota`);
2. Cálculo Tributário (`tax-calculator.ts`);
3. Construção do XML (`nfe-builder.ts` ou `nfce-builder.ts`);
4. Assinatura Digital (`xml-signer.ts`);
5. Persistência do documento no banco dedicado com status `SIGNED` e incremento do número sequencial da filial.
