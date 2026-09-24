# Plano de Execução — Sprint 3 (Tenant) do `project-vtx`
## Geração de XML PL_009_V4 com Reforma Tributária, QR-Code 2.0 e Assinador Digital Nativo XMLDSig

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
   * O **Product Owner (PO)** especifica os requisitos de negócio, arquitetura, fórmulas matemáticas, interfaces e critérios de aceite, audita os resultados, executa os comandos de teste/build e emite os relatórios formais em `test/docs/` e `relatorios/`.
   * O **Desenvolvedor (Usuário)** implementa o código-fonte em `src/` e os arquivos de teste em `test/`.
2. **Ciclo por Task:**
   * PO apresenta o detalhamento da Task com schemas, fórmulas e cenários de teste;
   * Desenvolvedor implementa os arquivos correspondentes;
   * PO executa `npm run build` e `vitest` para auditoria estrita;
   * Se houver falhas, PO orienta os ajustes;
   * Se aprovado, PO gera o relatório de alterações de 10 seções e o desenvolvedor realiza o commit;
   * Avança-se para a próxima task.

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

## Escopo
1. Implementar `src/modules/tenant/fiscal/engine/nfe-builder.ts`:
   * Tabela de Códigos IBGE de UF (`UF_TO_CUF`);
   * Algoritmo de geração da Chave de Acesso de 44 dígitos com Dígito Verificador Módulo 11 ponderado (`calculateModulo11` e `generateAccessKey`);
   * Schema Zod `.strict()` para validação completa de entrada (`nfeInputSchema`);
   * Montagem canônica do XML da NF-e (Modelo 55) padrão SEFAZ MOC 4.00 / PL_009_V4 com sanitização de caracteres (`xmlEscape`);
   * Integração direta com `calculateItemTaxes` do `tax-calculator.ts` para preenchimento de `<imposto><IBS>`, `<imposto><CBS>`, `<imposto><IS>` e totalizadores `<total><IBSTot>`, `<total><CBSTot>`, `<total><ISTot>`;
   * Função exportada `buildNFeXml(rawInput: unknown): NFeBuildResult`.
2. Criar suíte de testes unitários `test/nfe.builder.test.ts`.

## Regras Técnicas e Fórmulas:
1. **Algoritmo da Chave de Acesso (44 dígitos):**
   * $\text{cUF (2)} + \text{AAMM (4)} + \text{CNPJ (14)} + \text{mod (2, '55')} + \text{serie (3)} + \text{nNF (9)} + \text{tpEmis (1, '1')} + \text{cNF (8)} + \text{cDV (1)}$;
   * Pesos de 2 a 9 da direita para a esquerda sobre os 43 dígitos;
   * Se $\text{soma} \pmod{11} \in \{0, 1\} \implies cDV = 0$; caso contrário, $cDV = 11 - (\text{soma} \pmod{11})$.
2. **Nós da Reforma Tributária por Item:**
   * `<IBS>`: `<cstIBS>`, `<vBC>`, `<pIBSUF>`, `<vIBSUF>`, `<pIBSMun>`, `<vIBSMun>`, `<vIBS>`;
   * `<CBS>`: `<cstCBS>`, `<vBC>`, `<pCBS>`, `<vCBS>`;
   * `<IS>`: `<vBC>`, `<pIS>`, `<vIS>` (apenas se `isSubjectToIS = true` e `valorIS > 0`).
3. **Totalizadores da Reforma Tributária:**
   * `<IBSTot>`, `<CBSTot>`, `<ISTot>` integrados ao grupo `<total>`.

## Critérios de Aceite
- [ ] Chave de Acesso de 44 dígitos gerada com precisão matemática comprovada por testes;
- [ ] Validação estrita via Zod DTO rejeita dados inválidos ou ausentes;
- [ ] Nós `<IBS>` e `<CBS>` gerados corretamente para itens padrão e com redução;
- [ ] Nó `<IS>` gerado apenas para itens sujeitos ao Imposto Seletivo;
- [ ] Totalizadores `<IBSTot>` e `<CBSTot>` conferem com a soma exata dos itens;
- [ ] Caracteres especiais (`&`, `<`, `>`, `"`, `'`) sanitizados adequadamente;
- [ ] 100% de aprovação na suíte `test/nfe.builder.test.ts`.

## Validações Obrigatórias
```bash
npm run build
npx vitest run test/nfe.builder.test.ts
npm test -- --run
```

---

# TASK 02 (Tenant) — Construtor do XML NFC-e (Modelo 65) e Algoritmo de QR-Code 2.0

## Prioridade
🟠 **Alta**

## Objetivo
Criar o gerador de XML de Nota Fiscal de Consumidor Eletrônica em `src/modules/tenant/fiscal/engine/nfce-builder.ts` com suporte a consumidor não identificado (ou identificado no `<dest>`), contingência offline (`tpEmis = 9`) e geração da URL e hash SHA-1 do **QR-Code Versão 2.0** com Token CSC.

## Escopo
1. Implementar `src/modules/tenant/fiscal/engine/nfce-builder.ts`:
   * Modelo fiscal fixo: `65`;
   * Suporte a venda com ou sem CPF do consumidor;
   * Construtor da string de parâmetros canônica do QR-Code 2.0:
     $$\text{chNFe=...&nVersao=2&tpAmb=...&cDest=...&dhEmi=...&vNF=...&vICMS=...&digVal=...&cIdToken=...}$$
   * Geração do hash SHA-1 criptográfico concatenando a string de parâmetros com o CSC (`cscToken`);
   * Nó de suplemento fiscal `<infNFeSupl><qrCode>` e `<urlChave>`.
2. Criar suíte de testes unitários `test/nfce.builder.test.ts`.

## Critérios de Aceite
- [ ] Geração válida de NFC-e para consumidor anônimo e identificado;
- [ ] Cálculo determinístico do hash SHA-1 do QR-Code 2.0;
- [ ] Suporte a emissão em contingência off-line (`tpEmis = 9`);
- [ ] Suíte de testes `test/nfce.builder.test.ts` com 100% de aprovação.

## Validações Obrigatórias
```bash
npm run build
npx vitest run test/nfce.builder.test.ts
npm test -- --run
```

---

# TASK 03 (Tenant) — Assinador Digital Nativo XMLDSig (RSA-SHA1 com Certificado A1)

## Prioridade
🔴 **Alta**

## Objetivo
Implementar o motor de assinatura digital W3C XMLDSig padrão ICP-Brasil em `src/modules/tenant/fiscal/engine/xml-signer.ts` para assinar digitalmente o XML da NF-e e NFC-e utilizando a chave privada RSA do Certificado A1 cadastrado na empresa emissora.

## Escopo
1. Implementar `src/modules/tenant/fiscal/engine/xml-signer.ts`:
   * Canonicalização C14N (W3C Canonical XML sem comentários) da tag `<infNFe>`;
   * Geração do Digest SHA-1 do conteúdo canonicalizado (`<DigestValue>`);
   * Montagem do nó `<SignedInfo>` com `CanonicalizationMethod` e `SignatureMethod` (`http://www.w3.org/2000/09/xmldsig#rsa-sha1`);
   * Assinatura digital RSA com SHA-1 (`rsa-sha1`) da tag `<SignedInfo>` canonicalizada, gerando `<SignatureValue>`;
   * Inclusão do certificado X.509 em Base64 na tag `<KeyInfo><X509Data><X509Certificate>`;
   * Injeção da tag `<Signature>` como filha direta de `<NFe>` imediatamente após `<infNFe>`.
2. Criar suíte de testes unitários `test/xml.signer.test.ts`.

## Critérios de Aceite
- [ ] Canonicalização C14N estrita sem quebras de linha ou espaços espúrios;
- [ ] Assinatura gerada verificável com sucesso através da chave pública do certificado X.509;
- [ ] Suporte a certificados A1 descriptografados pelo módulo `certificate.crypto.ts`;
- [ ] 100% de aprovação na suíte `test/xml.signer.test.ts`.

## Validações Obrigatórias
```bash
npm run build
npx vitest run test/xml.signer.test.ts
npm test -- --run
```

---

# TASK 04 (Tenant) — Validador Local Estrutural XSD, Orquestrador de Emissão e Fechamento

## Prioridade
🟠 **Alta**

## Objetivo
Construir o validador sintático de esquemas XSD em `src/modules/tenant/fiscal/engine/xsd-validator.ts` e o orquestrador de serviço de emissão em `src/modules/tenant/fiscal/fiscal-emission.service.ts`, unindo todo o pipeline de emissão autônoma da plataforma e finalizando a Sprint 3.

## Escopo
1. Criar `src/modules/tenant/fiscal/engine/xsd-validator.ts`:
   * Validação estrutural de tags obrigatórias e tipos de dados do MOC 4.00.
2. Criar `src/modules/tenant/fiscal/fiscal-emission.service.ts`:
   * Pipeline orquestrado:
     1. Verificação de Quota (`quotaService.assertEmissionQuota`);
     2. Apuração Tributária (`tax-calculator.ts`);
     3. Construção do XML (`nfe-builder.ts` ou `nfce-builder.ts`);
     4. Assinatura Digital Nativa (`xml-signer.ts`);
     5. Validação estrutural (`xsd-validator.ts`);
     6. Persistência em `FiscalDocument` no banco dedicado com status `SIGNED` e incremento atômico da numeração sequencial.
3. Criar testes unitários e de integração `test/tenant.emission.test.ts`.
4. Execução da regressão global e emissão do Relatório Final da Sprint 3 (Tenant).

## Critérios de Aceite
- [ ] Pipeline completo executado com sucesso: quota -> tributos -> XML -> assinatura -> persistência;
- [ ] Incremento atômico de numeração sequencial por filial;
- [ ] Regressão global de testes sem falhas;
- [ ] Emissão do Relatório Final da Sprint 3.

## Validações Obrigatórias
```bash
npm run build
npm test -- --run
```

---

## 4. Próximo Passo

Com este plano aprovado, liberamos imediatamente o início do desenvolvimento da **TASK 01 (Tenant) — Construtor do XML NF-e (Modelo 55) Padrão PL_009_V4 com Reforma Tributária**.
