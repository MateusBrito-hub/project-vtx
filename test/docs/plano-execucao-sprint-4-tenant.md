# Plano de Execução — Sprint 4 (Tenant) do `project-vtx`
## Transmissão SEFAZ (mTLS 1.2), DANFE/DANFCE em PDF, Eventos Fiscais e Sincronização de Quota com o Core

| Metadado | Detalhe |
|---|---|
| **Sprint** | 4 (Tenant) — Transmissão SEFAZ, Processamento de Retorno, DANFE e Fechamento da Fase 2 |
| **Projeto** | `MateusBrito-hub/project-vtx` (Módulo `src/modules/tenant/`) |
| **Branch base** | `master` |
| **Papel do Assistente** | Product Owner (PO) & Arquiteto Técnico (Edição restrita a `test/docs/` e `relatorios/`) |
| **Papel do Usuário** | Desenvolvedor Responsável (Implementação de código em `src/`, `prisma/` e `test/`) |
| **Duração de referência** | 1 semana |
| **Marco Regulatório** | MOC SEFAZ v4.00, NT 2020.006, Manual do DANFE v3.0, EC 132/2023 |

---

## 1. Objetivo da Sprint 4 (Tenant)

Concluir a **Fase 2 (VTX Tenant)**, conectando o motor fiscal gerador e assinador construído na Sprint 3 aos webservices da **SEFAZ** via comunicação SOAP com **mTLS 1.2 (Mutual TLS)** utilizando o Certificado A1 da empresa, processar autorizações em lote e síncronas (`cStat 100`), gerar o XML de distribuição protocolado (`<nfeProc>`), renderizar os documentos auxiliares impressos (**DANFE** e **DANFCE**) em formato PDF com código de barras e QR-Code, gerenciar eventos fiscais (Cancelamento e Carta de Correção Eletrônica - CC-e) e consolidar o abatimento de quota de documentos (`maxDocs`) entre o banco dedicado e a assinatura do VTX Core.

---

## 2. Forma de Trabalho e Governança

1. **Separação Rígida de Papéis:**
   * O **Product Owner (PO)** especifica os requisitos de negócio, arquitetura, protocolos SOAP, DTOs, critérios de aceite, audita os resultados, executa os comandos de teste/build e emite os relatórios formais em `test/docs/` e `relatorios/`.
   * O **Desenvolvedor (Usuário)** implementa o código-fonte em `src/` e os arquivos de teste em `test/`.
2. **Ciclo por Task:**
   * PO apresenta o detalhamento da Task com schemas, endpoints e cenários de teste;
   * Desenvolvedor implementa os arquivos correspondentes;
   * PO executa `npm run build` e `vitest` para auditoria estrita;
   * Se houver falhas, PO orienta os ajustes cirúrgicos;
   * Se aprovado, PO gera o relatório de alterações de 10 seções e o desenvolvedor realiza o commit;
   * Avança-se para a próxima task.

---

## 3. Ordem de Execução das Tasks da Sprint 4 (Tenant)

| Ordem | Task | Foco | Prioridade | Esforço | Dependências |
|:---:|---|---|:---:|:---:|:---:|
| **1** | **TASK 01 (Tenant)** | Cliente SOAP/WSDL Nativo com SEFAZ (mTLS 1.2 com Certificado A1 e Endpoints SVRS/Estaduais) | 🔴 Alta | Alto | Sprint 3 |
| **2** | **TASK 02 (Tenant)** | Processador de Autorização SEFAZ, Recibos e Montador do `nfeProc` / `protNFe` | 🟠 Alta | Médio-Alto | Task 01 |
| **3** | **TASK 03 (Tenant)** | Gerador de DANFE (NF-e Modelo 55) e DANFCE (NFC-e Modelo 65) em PDF com Barcode e QR-Code | 🟠 Alta | Médio-Alto | Task 02 |
| **4** | **TASK 04 (Tenant)** | Eventos Fiscais (Cancelamento e CC-e), Sincronização de Quota com o Core e Homologação Final | 🔴 Alta | Alto | Tasks 01 a 03 |

---

# Detalhamento das Tasks da Sprint 4 (Tenant)

## TASK 01 (Tenant) — Cliente SOAP/WSDL Nativo com SEFAZ (mTLS 1.2)
* **Objetivo:** Criar o cliente HTTP/SOAP nativo em `src/modules/tenant/fiscal/engine/soap-client.ts` configurado com `https.Agent` para negociação mTLS (Mutual Authentication TLS 1.2) injetando o par `certPem` e `privateKeyPem` do Certificado A1, montagem de envelopes SOAP 1.2 (`soap12:Envelope`) para os serviços `NFeAutorizacao4` e `NFeRetAutorizacao4`, e tabela de Web Services oficiais por UF (SVRS, SVAN, SP, PR, etc.).
* **Testes:** `test/soap-client.test.ts`.

## TASK 02 (Tenant) — Processador de Autorização SEFAZ e Montador do `nfeProc`
* **Objetivo:** Criar o parser e montador de protocolo em `src/modules/tenant/fiscal/engine/sefaz-processor.ts`:
  * Tratamento do retorno de lote (`cStat 103` - Lote recebido, `cStat 104` - Lote processado, `cStat 100` - Autorizado o uso);
  * Montagem do XML oficial de distribuição `<nfeProc versao="4.00">` contendo o `<NFe>` assinado original e o nó `<protNFe versao="4.00">` com número de protocolo, digest e digestValue da SEFAZ;
  * Atualização relacional do `FiscalDocument` no banco dedicado: `status = AUTHORIZED`, `authorizationDate = now()`, `protocolNumber`, `cStat`, `xMotivo` e `xmlDistribution`.
* **Testes:** `test/sefaz-processor.test.ts`.

## TASK 03 (Tenant) — Gerador de DANFE e DANFCE em PDF
* **Objetivo:** Criar os renderizadores nativos de Documento Auxiliar em `src/modules/tenant/danfe/nfe-danfe.ts` e `src/modules/tenant/danfe/nfce-danfe.ts`:
  * DANFE Retrato A4 para NF-e Modelo 55 com código de barras CODE128 da Chave de Acesso de 44 dígitos, quadro de emitente, destinatário, dados da Reforma Tributária (IBS/CBS/IS) e itens;
  * DANFCE formato bobina térmica (80mm) para NFC-e Modelo 65 com renderização do QR-Code Versão 2.0;
  * Retorno do binário do PDF e rota REST `GET /api/tenant/fiscal/documents/:id/pdf`.
* **Testes:** `test/danfe-generator.test.ts`.

## TASK 04 (Tenant) — Eventos Fiscais, Sincronização de Quota e Fechamento da Fase 2
* **Objetivo:** Finalizar a operação fiscal completa:
  * Emissão de Eventos Fiscais: Cancelamento homologado (`tpEvento = 110111`) e Carta de Correção Eletrônica (`tpEvento = 110110`);
  * Registro na tabela `FiscalEvent`;
  * Sincronização do consumo de quota `maxDocs` no banco central com o VTX Core;
  * Execução da regressão global (100% verde) e emissão do **Relatório Executivo Final da Fase 2 (VTX Tenant)**.
* **Testes:** `test/tenant.events.test.ts`.
