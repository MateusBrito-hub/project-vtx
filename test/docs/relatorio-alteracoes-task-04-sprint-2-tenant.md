# Relatório de Alterações — TASK 04 (Sprint 2 - Tenant)
## Validador de Quotas de Emissão (`maxDocs`) e Fechamento da Sprint 2

---

### 1. Identificação da Tarefa
* **Projeto:** `project-vtx`
* **Fase:** 2 (VTX Tenant — Sistema Fiscal Cloud e Multi-Filial)
* **Sprint:** 2 (Motor Tributário e Cadastros Operacionais da Reforma Tributária)
* **Task:** 04 — Validador de Quotas de Emissão (`maxDocs`) e Fechamento
* **Data:** 23/09/2026
* **Status:** 🟢 **Concluído e Aprovado**

---

### 2. Objetivo da Alteração
Implementar o serviço de controle e auditoria de quotas fiscais (`src/modules/tenant/fiscal/quota.service.ts`), que integra o plano e assinatura contratada no banco administrativo (**VTX Core** via `Client -> Subscription -> Plan.maxDocs`) com a apuração de documentos autorizados no banco dedicado de cada empresa (**VTX Tenant** via `FiscalDocument`), impedindo a emissão de notas fiscais excedentes e fornecendo o endpoint `GET /api/tenant/fiscal/quota` para monitoramento operacional em tempo real.

---

### 3. Contexto e Justificativa
O modelo de monetização SaaS da plataforma VTX baseia-se em planos com limites mensais de emissão fiscal (`Plan.maxDocs`). Sem um gatekeeper centralizado e determinístico, um tenant inadimplente ou com limite esgotado poderia continuar transmitindo lotes para a SEFAZ, gerando custos de infraestrutura e passivos contratuais. O `quotaService` atua como a barreira obrigatória que valida a vigência da assinatura e o saldo restante antes do pipeline de assinatura e transmissão (Sprint 3).

---

### 4. Arquivos Modificados/Criados

| Tipo | Caminho do Arquivo | Descrição |
|:---:|---|---|
| **[NEW]** | `src/modules/tenant/fiscal/quota.service.ts` | Serviço de validação de quotas mensais, janelas de ciclo e asserção de limite |
| **[NEW]** | `test/tenant.quota.test.ts` | Suíte de testes unitários e de integração HTTP cobrindo liberação, bloqueio e auditoria |
| **[MODIFY]** | `src/modules/tenant/tenant.routes.ts` | Inclusão do endpoint protegido `GET /fiscal/quota` |

---

### 5. Detalhamento das Alterações Técnicas

1. **Cálculo da Janela do Ciclo Mensal (`getMonthlyCycleWindow`):**
   * Determina com exatidão a janela temporal do primeiro dia (`00:00:00.000`) ao último dia (`23:59:59.999`) do mês de referência.

2. **Auditoria Centralizada de Saldo (`checkEmissionQuota`):**
   * Consulta a base central (`vtx_core`) pelo `slug` do tenant incluindo a relação com `Subscription` e `Plan`;
   * Valida se a assinatura está com status ativo (`status === 'active'`). Se inativa/suspensa, bloqueia com `reason: 'INACTIVE_SUBSCRIPTION'`;
   * Executa contagem agregada de documentos autorizados no banco dedicado (`vtx_<slug>`):
     ```typescript
     tenantPrisma.fiscalDocument.count({
       where: {
         status: 'AUTHORIZED',
         emissionDate: { gte: cycleStart, lte: cycleEnd }
       }
     })
     ```
   * Retorna metadados completos: `allowed`, `maxDocs`, `usedDocs`, `remainingDocs`, `planName`, `cycleStart`, `cycleEnd`.

3. **Mecanismo de Asserção Rígida (`assertEmissionQuota`):**
   * Dispara exceção tipada (`QUOTA_EXCEEDED` ou `INACTIVE_SUBSCRIPTION`) caso o limite tenha sido atingido, bloqueando a esteira de emissão antes da geração de XML e assinatura digital.

4. **Endpoint REST (`GET /api/tenant/fiscal/quota`):**
   * Disponibilizado sob o roteador unificado `tenant.routes.ts` com proteção do `tenantMiddleware`, permitindo que frentes de caixa e ERPs consultem o saldo de notas disponíveis via HTTP 200.

---

### 6. Impactos Arquiteturais e em Outros Módulos
* **Ponte Segura Core-Tenant:** O serviço exemplifica o modelo híbrido do monorepo: o tenant consulta a governança central sem expor credenciais e apura o consumo na base dedicada.
* **Preparação para a Sprint 3:** O `assertEmissionQuota` será acoplado diretamente aos endpoints de emissão de NF-e (55) e NFC-e (65).

---

### 7. Validação e Testes Realizados

#### A. Testes Unitários e HTTP da Task 04 (`test/tenant.quota.test.ts`)
* **5 testes implementados e 100% aprovados:**
  * ✅ Liberação de emissão quando o consumo é estritamente menor que o limite (`usedDocs < maxDocs`);
  * ✅ Bloqueio de emissão quando o limite mensal é atingido (`usedDocs >= maxDocs`) com motivo `QUOTA_EXCEEDED`;
  * ✅ Disparo de exceção controlada no método `assertEmissionQuota`;
  * ✅ Bloqueio de emissão quando a assinatura central está suspensa (`INACTIVE_SUBSCRIPTION`);
  * ✅ Consulta via Supertest ao endpoint `GET /api/tenant/fiscal/quota` com retorno das métricas operacionais.

#### B. Regressão Geral
* **Execução global de testes (`vitest --run`):**
  * `17 passed (17 test files)`
  * `127 passed (127 total tests)`
  * Duração: ~7.0s.
* **Compilação TypeScript (`npm run build`):**
  * `tsc` executado sem erros (código 0).

---

### 8. Riscos Identificados e Mitigações

| Risco | Severidade | Mitigação Aplicada |
|---|:---:|---|
| **Divergência de fuso horário na janela mensal** | Média | Construção determinística de datas de início e fim no ciclo local com limites em milissegundos. |
| **Tentativa de emissão com assinatura suspensa** | Crítica | Validação em dois níveis (`tenantMiddleware` no roteamento e `quotaService` na emissão). |
| **Inconsistência de concorrência em emissões simultâneas** | Média | Contagem direta no banco relacional indexada por `status` e `emissionDate`. |

---

### 9. Próximos Passos
* **Fechamento da Sprint 2 (Tenant):** Emissão do Relatório Final da Sprint 2.
* **Início da Sprint 3 (Tenant) — Geração de XML, Assinatura Digital e Validação XSD:**
  * Montador de XML PL_009_V4 com nós da Reforma Tributária (IBS/CBS/IS);
  * Algoritmo de QR-Code para NFC-e (versão 2.0 com hash SHA-1 do token CSC);
  * Assinador digital XMLDSig nativo com certificado A1;
  * Validador XSD integrado contra esquemas oficiais da SEFAZ.

---

### 10. Parecer do Product Owner (PO)
* **Veredicto:** 🟢 **APROVADO PARA HOMOLOGAÇÃO**
* **Comentário do PO:** A entrega da Task 04 fecha com excelência a Sprint 2. O controle de quotas garante a sustentabilidade financeira da plataforma e finaliza a camada de regras de negócio, deixando o caminho livre para o motor de mensageria da SEFAZ na Sprint 3.
