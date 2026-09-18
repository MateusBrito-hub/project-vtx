# Relatório de Alterações — TASK 02 (Sprint 2 - Tenant)
## Catálogo de Produtos com Classificação da Reforma e Roteador Centralizado

---

### 1. Identificação da Tarefa
* **Projeto:** `project-vtx`
* **Fase:** 2 (VTX Tenant — Sistema Fiscal Cloud e Multi-Filial)
* **Sprint:** 2 (Motor Tributário e Cadastros Operacionais da Reforma Tributária)
* **Task:** 02 — Catálogo de Produtos com Classificação da Reforma (`Product`)
* **Data:** 17/09/2026
* **Status:** 🟢 **Concluído e Aprovado**

---

### 2. Objetivo da Alteração
Implementar o CRUD completo do catálogo de produtos em `src/modules/tenant/product/` operando sobre o banco de dados dedicado do tenant (`vtx_<slug>`), com validações fiscais estritas via Zod DTOs para atributos da Reforma Tributária (NCM, CEST, CFOP, `taxReformClass`, `isSubjectToIS` e CST), além de estruturar o **Roteador Centralizador do Tenant** (`src/modules/tenant/tenant.routes.ts`) para desacoplar a esteira HTTP e aplicar o middleware em ponto único.

---

### 3. Contexto e Justificativa
Na emissão de NF-e (55) e NFC-e (65), o produto é a entidade central que dita a tributação aplicada pelo motor de cálculo desenvolvido na Task 01. O cadastro precisava garantir a unicidade de SKU por tenant, validação estrutural de NCM de 8 dígitos, CEST de 7 dígitos e a correta categorização da Reforma Tributária (Emenda Constitucional 132/2023).
Adicionalmente, por sugestão do desenvolvedor aprovada pelo PO, centralizou-se o registro de rotas em `src/modules/tenant/tenant.routes.ts`, aplicando o `tenantMiddleware` uma única vez na raiz do tenant e mantendo o `src/app.ts` desacoplado e aderente à Clean Architecture.

---

### 4. Arquivos Modificados/Criados

| Tipo | Caminho do Arquivo | Descrição |
|:---:|---|---|
| **[NEW]** | `src/modules/tenant/product/product.schema.ts` | Schemas Zod `.strict()` para criação e atualização com validações fiscais |
| **[NEW]** | `src/modules/tenant/product/product.service.ts` | Camada de negócio com controle de SKU único, paginação e CRUD completo |
| **[NEW]** | `src/modules/tenant/product/product.controller.ts` | Controller HTTP com códigos de status padronizados (201, 200, 204, 400, 404, 409) |
| **[NEW]** | `src/modules/tenant/product/product.routes.ts` | Roteador exclusivo de produtos montado sob o prefixo `/products` |
| **[NEW]** | `src/modules/tenant/tenant.routes.ts` | **Roteador Centralizador do Tenant** aplicando `tenantMiddleware` na raiz |
| **[NEW]** | `test/tenant.product.test.ts` | Suíte de testes automatizados com cobertura de CRUD, conflitos e regras fiscais |
| **[MODIFY]** | `src/app.ts` | Montagem unificada do roteador centralizador em `/api/tenant` |

---

### 5. Detalhamento das Alterações Técnicas

1. **Roteador Centralizador do Tenant (`tenant.routes.ts`):**
   * Agrupa todos os submódulos do tenant (`tenantConfigRoutes`, `productRoutes`) sob uma mesma instância;
   * Aplica o `tenantMiddleware` uma única vez na entrada, eliminando redundância em submódulos e simplificando o `src/app.ts`;
   * Prepara o backend para execução desacoplada na porta `5000` em contêiner dedicado sem necessidade de refatoração de rotas.

2. **Validações Fiscais Estritas (`product.schema.ts`):**
   * `sku`: Obrigatório, até 60 caracteres;
   * `ncm`: Regex de 8 dígitos numéricos (`^\d{8}$`);
   * `cest`: Opcional, regex de 7 dígitos numéricos (`^\d{7}$`);
   * `cfopDefault`: Regex de 4 dígitos numéricos (`^\d{4}$`, default `'5102'`);
   * `price`: Número positivo estrito (`z.number().positive()`);
   * `taxReformClass`: Enumeração com as classes da Reforma (`PADRAO`, `REDUZIDA_60`, `REDUZIDA_30`, `CESTA_BASICA_ISENTA`, `IMPOSTO_SELETIVO`, `IMUNE_ISENTO`);
   * `isSubjectToIS`: Booleano para incidência de Imposto Seletivo;
   * `.strict()`: Rejeição de propriedades arbitrárias contra Mass Assignment.

3. **Operações de Serviço (`product.service.ts`):**
   * `create`: Verificação de duplicidade de SKU no banco do tenant (dispara erro com código `CONFLICT`);
   * `list`: Busca com paginação flexível (`page`, `limit`), ordenação alfabética e filtro por termo insensível a maiúsculas (`contains: search, mode: 'insensitive'`);
   * `getById`: Busca por chave primária com tratamento `NOT_FOUND`;
   * `update`: Atualização seletiva com validação de colisão de SKU em outros registros;
   * `delete`: Exclusão física com verificação prévia de existência (retorna 204 No Content).

---

### 6. Impactos Arquiteturais e em Outros Módulos
* **Organização Modular Limpa:** O `app.ts` agora possui apenas duas portas de entrada: `routes` (VTX Core administrativo) e `tenantRoutes` (VTX Tenant operacional).
* **Consistência do Banco Dedicado:** Todas as queries são executadas diretamente sobre `req.tenantPrisma`, garantindo isolamento total do catálogo de produtos de cada empresa contratante.

---

### 7. Validação e Testes Realizados

#### A. Testes Unitários da Task 02 (`test/tenant.product.test.ts`)
* **7 testes implementados e 100% aprovados:**
  * ✅ Criação de produto com classificação de alíquota reduzida da Reforma (`REDUZIDA_60`) e NCM válido;
  * ✅ Rejeição com HTTP 409 Conflict ao tentar cadastrar SKU já existente;
  * ✅ Bloqueio Zod HTTP 400 ao enviar NCM com menos de 8 dígitos;
  * ✅ Listagem com paginação e contagem total de itens;
  * ✅ Consulta por identificador único com retorno dos atributos fiscais;
  * ✅ Atualização parcial via PUT (alteração de preço e enquadramento para `CESTA_BASICA_ISENTA`);
  * ✅ Exclusão via DELETE com retorno 204 e validação de 404 subsequente.

#### B. Regressão Geral
* **Execução global de testes (`vitest --run`):**
  * `15 passed (15 test files)`
  * `114 passed (114 total tests)`
  * Duração: ~19.1s.
* **Compilação TypeScript (`npm run build`):**
  * `tsc` executado sem erros (código 0).

---

### 8. Riscos Identificados e Mitigações

| Risco | Severidade | Mitigação Aplicada |
|---|:---:|---|
| **Colisão de SKU entre produtos da mesma empresa** | Média | Verificação prévia por `findUnique({ where: { sku } })` antes de persistir. |
| **NCM e CEST com formatos inconsistentes** | Alta | Expressões regulares estritas (`^\d{8}$` e `^\d{7}$`) no schema Zod. |
| **Vazamento de produtos entre tenants distintos** | Crítica | Queries executadas exclusivamente via instância injetada em `req.tenantPrisma`. |

---

### 9. Próximos Passos
* **TASK 03 (Sprint 2 - Tenant) — Cadastro de Destinatários Fiscais (`Customer`) com Princípio do Destino e Código IBGE:**
  * Desenvolver schemas Zod, service, controller e rotas sob `/api/tenant/customers`.
  * Validações de CPF/CNPJ com cálculo de dígitos verificadores e Código IBGE de 7 dígitos.
  * Criar suíte de testes `test/tenant.customer.test.ts`.

---

### 10. Parecer do Product Owner (PO)
* **Veredicto:** 🟢 **APROVADO PARA HOMOLOGAÇÃO**
* **Comentário do PO:** A entrega da Task 02 consolida o catálogo fiscal com excelência técnica. A criação do roteador centralizador `tenant.routes.ts` proposta pelo desenvolvedor elevou o padrão arquitetural do projeto, mantendo todas as 114 suítes de teste verdes.
