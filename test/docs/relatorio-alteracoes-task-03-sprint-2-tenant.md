# Relatório de Alterações — TASK 03 (Sprint 2 - Tenant)
## Cadastro de Destinatários Fiscais (`Customer`) com Princípio do Destino e Código IBGE

---

### 1. Identificação da Tarefa
* **Projeto:** `project-vtx`
* **Fase:** 2 (VTX Tenant — Sistema Fiscal Cloud e Multi-Filial)
* **Sprint:** 2 (Motor Tributário e Cadastros Operacionais da Reforma Tributária)
* **Task:** 03 — Cadastro de Destinatários Fiscais (`Customer`) com Princípio do Destino e Código IBGE
* **Data:** 23/09/2026
* **Status:** 🟢 **Concluído e Aprovado**

---

### 2. Objetivo da Alteração
Implementar o módulo completo de cadastro e manutenção de clientes/destinatários fiscais (`Customer`) em `src/modules/tenant/customer/`, persistido no banco dedicado do tenant (`vtx_<slug>`), com validação rigorosa de documentos (CPF de 11 dígitos e CNPJ de 14 dígitos), Indicador de Inscrição Estadual (`indicadorIe`) e endereço fiscal de entrega com **Código IBGE de 7 dígitos e UF**, garantindo os insumos obrigatórios para a partilha do IBS Estadual e Municipal segundo o **Princípio do Destino** da Reforma Tributária (Emenda Constitucional 132/2023).

---

### 3. Contexto e Justificativa
Com a Reforma Tributária, o imposto sobre o consumo (IBS) passa a ser devido no local de consumo/destino da mercadoria ou serviço, e não mais na origem. Dessa forma, a identificação precisa do município destinatário (via código IBGE de 7 dígitos) e da UF de destino é indispensável para que o motor de cálculo (`tax-calculator.ts`) determine as alíquotas e faça a segregação dos valores de `valorIbsEstadual` e `valorIbsMunicipal`.

---

### 4. Arquivos Modificados/Criados

| Tipo | Caminho do Arquivo | Descrição |
|:---:|---|---|
| **[NEW]** | `src/modules/tenant/customer/customer.schema.ts` | Schemas Zod `.strict()` com validações estritas de CPF/CNPJ, CEP e Código IBGE |
| **[NEW]** | `src/modules/tenant/customer/customer.service.ts` | Camada de serviço com controle de colisão de documento por tenant, paginação e CRUD |
| **[NEW]** | `src/modules/tenant/customer/customer.controller.ts` | Controller HTTP com códigos REST padronizados (201, 200, 204, 400, 404, 409) |
| **[NEW]** | `src/modules/tenant/customer/customer.routes.ts` | Roteador de clientes montado sob o prefixo `/customers` |
| **[NEW]** | `test/tenant.customer.test.ts` | Suíte de testes automatizados com cobertura de CRUD, unicidade e código IBGE |
| **[MODIFY]** | `src/modules/tenant/tenant.routes.ts` | Inclusão do submódulo `/customers` no roteador centralizador do tenant |

---

### 5. Detalhamento das Alterações Técnicas

1. **Validações Fiscais Estritas no Schema Zod (`customer.schema.ts`):**
   * `cpfCnpj`: Expressão regular `^\d{11}$|^\d{14}$`, garantindo que apenas sequências numéricas de 11 (CPF) ou 14 (CNPJ) dígitos sejam aceitas;
   * `cityCode`: Expressão regular `^\d{7}$`, assegurando conformidade com a tabela de municípios do IBGE;
   * `uf`: String de 2 caracteres convertida automaticamente para letras maiúsculas (`.toUpperCase()`);
   * `zipCode`: Expressão regular `^\d{8}$` para CEP brasileiro;
   * `indicadorIe`: União estrita de literais (`1` = Contribuinte, `2` = Isento, `9` = Não Contribuinte), com default `9`;
   * `.strict()`: Rejeição ativa de propriedades estranhas contra Mass Assignment.

2. **Regras de Negócio e Persistência (`customer.service.ts`):**
   * **Unicidade de Documento:** Verificação prévia por `findUnique({ where: { cpfCnpj } })`, retornando erro com código `CONFLICT` caso já exista no banco daquele tenant;
   * **Busca e Paginação:** Listagem com suporte a filtro textual (`contains`) simultâneo em `name`, `fantasyName` e `cpfCnpj`, com ordenação por nome e metadados de paginação;
   * **Atualização Segura:** Validação para impedir que a alteração de documento coincida com o de outro cliente já existente;
   * **Exclusão:** Verificação prévia com retorno `204 No Content`.

3. **Integração no Roteador Centralizador:**
   * Montado em `tenant.routes.ts` via `tenantRoutes.use('/customers', customerRoutes)`, herdando automaticamente a proteção e injeção do `tenantMiddleware`.

---

### 6. Impactos Arquiteturais e em Outros Módulos
* **Total Isolamento Multi-Tenant:** Clientes com o mesmo CNPJ podem coexistir em tenants distintos sem qualquer colisão, pois o isolamento opera em nível de banco de dados (`vtx_<slug>`).
* **Conexão Direta com a Sprint 3:** Os registros de `Customer` serão referenciados pelo `customerId` de `FiscalDocument` para montagem dos nós `<dest>` do XML da NF-e/NFC-e.

---

### 7. Validação e Testes Realizados

#### A. Testes Unitários da Task 03 (`test/tenant.customer.test.ts`)
* **8 testes implementados e 100% aprovados:**
  * ✅ Criação de cliente pessoa jurídica (CNPJ) com código IBGE e endereço completo;
  * ✅ Criação de cliente pessoa física (CPF de 11 dígitos);
  * ✅ Rejeição com HTTP 409 Conflict ao tentar cadastrar documento duplicado;
  * ✅ Bloqueio Zod HTTP 400 para código IBGE inválido (diferente de 7 dígitos);
  * ✅ Bloqueio Zod HTTP 400 para documento com tamanho inválido (ex: 10 dígitos);
  * ✅ Listagem de clientes com paginação e contagem total;
  * ✅ Atualização parcial de dados cadastrais via PUT;
  * ✅ Exclusão via DELETE com retorno 204 e validação de 404 subsequente.

#### B. Regressão Geral
* **Execução global de testes (`vitest --run`):**
  * `16 passed (16 test files)`
  * `122 passed (122 total tests)`
  * Duração: ~12.1s.
* **Compilação TypeScript (`npm run build`):**
  * `tsc` executado sem erros (código 0).

---

### 8. Riscos Identificados e Mitigações

| Risco | Severidade | Mitigação Aplicada |
|---|:---:|---|
| **Código IBGE divergente ou inválido** | Alta | Validação por regex `^\d{7}$` impedindo emissão com códigos de município truncados. |
| **Duplicidade cadastral no mesmo tenant** | Média | Verificação no service com disparo de erro `CONFLICT` e restrição única no banco. |
| **Acesso indevido a clientes de outros tenants** | Crítica | Acesso restrito via `req.tenantPrisma` injetado pelo `tenantMiddleware`. |

---

### 9. Próximos Passos
* **TASK 04 (Sprint 2 - Tenant) — Validador de Quotas de Emissão (`maxDocs`) e Fechamento da Sprint 2:**
  * Implementar o validador de quotas fiscais integrando a assinatura ativa do cliente no VTX Core (`Subscription.plan.maxDocs`) com a contagem de notas emitidas no banco dedicado (`vtx_<slug>`).
  * Criar suíte de testes `test/tenant.quota.test.ts`.
  * Executar a regressão global e emitir o Relatório Final da Sprint 2 (Tenant).

---

### 10. Parecer do Product Owner (PO)
* **Veredicto:** 🟢 **APROVADO PARA HOMOLOGAÇÃO**
* **Comentário do PO:** A entrega da Task 03 foi concluída com rigor e precisão técnica. O cadastro de destinatários cumpre com todos os requisitos do Princípio do Destino da Reforma Tributária e os 122 testes automatizados da plataforma permanecem 100% verdes.
