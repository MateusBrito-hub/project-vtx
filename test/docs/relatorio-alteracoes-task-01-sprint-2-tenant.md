# Relatório de Alterações — TASK 01 (Sprint 2 - Tenant)
## Motor de Cálculo Tributário Híbrido com Zod DTOs (`tax-calculator.ts`)

---

### 1. Identificação da Tarefa
* **Projeto:** `project-vtx`
* **Fase:** 2 (VTX Tenant — Sistema Fiscal Cloud e Multi-Filial)
* **Sprint:** 2 (Motor Tributário e Cadastros Operacionais da Reforma Tributária)
* **Task:** 01 — Motor de Cálculo Tributário Híbrido (`tax-calculator.ts`)
* **Data:** 14/09/2026
* **Status:** 🟢 **Concluído e Aprovado**

---

### 2. Objetivo da Alteração
Implementar o motor de apuração e inteligência tributária (`src/modules/tenant/fiscal/engine/tax-calculator.ts`) baseado em validações estritas por Zod DTOs (`taxCalculationItemSchema` e `documentTaxCalculationSchema`), capaz de processar simultaneamente os impostos do período de transição (ICMS, PIS, COFINS, IPI) e as regras da Reforma Tributária (Emenda Constitucional 132/2023 - IVA Dual: IBS Estadual, IBS Municipal, CBS Federal e Imposto Seletivo).

---

### 3. Contexto e Justificativa
A Emenda Constitucional 132/2023 e o PLP 68/2024 estabelecem a transição progressiva do sistema tributário brasileiro (2026 a 2032), onde tributos legados coexistirão com o IBS e a CBS calculados "por fora" (não integrando sua própria base).
Adicionalmente, atendendo à diretriz arquitetural do projeto, a tipagem do motor foi estruturada sobre **DTOs Zod com `.strict()`**, garantindo validação em tempo de execução contra valores monetários negativos, `NaN`, quantidades inválidas e tentativas de injeção de parâmetros (Mass Assignment).

---

### 4. Arquivos Modificados/Criados

| Tipo | Caminho do Arquivo | Descrição |
|:---:|---|---|
| **[NEW]** | `src/modules/tenant/fiscal/engine/tax-calculator.ts` | Motor de apuração tributária híbrida com DTOs Zod e regras da Reforma |
| **[NEW]** | `test/tax.calculator.test.ts` | Suíte de testes unitários cobrindo alíquotas cheias, reduções, isenções, IS e DTOs |

---

### 5. Detalhamento das Alterações Técnicas

1. **Definição de DTOs e Validação em Tempo de Execução:**
   * `taxReformClassEnum`: Validação das classes `PADRAO`, `REDUZIDA_60`, `REDUZIDA_30`, `CESTA_BASICA_ISENTA`, `IMPOSTO_SELETIVO`, `IMUNE_ISENTO`;
   * `taxCalculationItemSchema`: Schema Zod `.strict()` que valida `quantity > 0`, `unitPrice >= 0`, `discount >= 0`, código IBGE de 7 dígitos e preenche alíquotas padrão automaticamente;
   * Tipos TypeScript inferidos via `z.infer<typeof ...>` (zero duplicação de interfaces soltas).

2. **Cálculo da Base e Desonerações:**
   * $\text{Base} = (\text{Quantidade} \times \text{Preço Unitário}) - \text{Desconto} + \text{Frete} + \text{Outras Despesas}$;
   * Arredondamento monetário estrito de 2 casas decimais (`roundCurrency`).

3. **Regras da Reforma Tributária (IVA Dual):**
   * **`PADRAO`**: 100% da alíquota base (CBS: 8,80%, IBS Estadual: 12,00%, IBS Municipal: 5,70%);
   * **`REDUZIDA_60`**: Redução de 60% (alíquota efetiva de 40%) com CST `20` (saúde, educação);
   * **`REDUZIDA_30`**: Redução de 30% (alíquota efetiva de 70%) com CST `20` (profissões regulamentadas);
   * **`CESTA_BASICA_ISENTA` / `IMUNE_ISENTO`**: Alíquota 0% com CST `40`;
   * **`IMPOSTO_SELETIVO`**: Apuração adicional do IS (`1.50%` padrão) para itens nocivos à saúde/meio ambiente (`isSubjectToIS = true`).

4. **Partilha Federativa do IBS (Princípio do Destino):**
   * Segregação explícita entre `valorIbsEstadual` (UF de destino) e `valorIbsMunicipal` (município de destino), consolidando em `valorIbsTotal`.

5. **Consolidação Documental (`calculateDocumentTaxes`):**
   * Consolidação totalizadora para o cabeçalho de NF-e (55) e NFC-e (65).

---

### 6. Impactos Arquiteturais e em Outros Módulos
* **Reaproveitamento no Pipeline de Emissão:** Os DTOs Zod serão reutilizados diretamente pelos controllers da Sprint 3 para validação dos payloads HTTP de emissão.
* **Isolamento de Domínio:** O motor de cálculo é uma biblioteca pura (sem dependências de I/O ou banco), garantindo altíssima velocidade e zero efeito colateral.

---

### 7. Validação e Testes Realizados

#### A. Testes Unitários da Task 01 (`test/tax.calculator.test.ts`)
* **10 testes implementados e 100% aprovados:**
  * ✅ Alíquota padrão (`PADRAO` com CST `01` e apuração plena de IBS e CBS);
  * ✅ Redução de 60% (`REDUZIDA_60` com CST `20`);
  * ✅ Redução de 30% (`REDUZIDA_30` com CST `20`);
  * ✅ Isenção total para Cesta Básica Nacional (`CESTA_BASICA_ISENTA` com CST `40`);
  * ✅ Apuração de Imposto Seletivo (`IMPOSTO_SELETIVO` / `isSubjectToIS`);
  * ✅ Dedução de descontos e inclusão de frete na base tributável;
  * ✅ Bloqueio Zod para quantidades ou preços unitários negativos;
  * ✅ Bloqueio Zod contra injeção de propriedades não mapeadas (Mass Assignment);
  * ✅ Bloqueio de documentos sem itens;
  * ✅ Consolidação de múltiplos itens com classes distintas no documento.

#### B. Regressão Geral
* **Execução global de testes (`vitest --run`):**
  * `14 passed (14 test files)`
  * `107 passed (107 total tests)`
  * Duração: ~14.7s.
* **Compilação TypeScript (`npm run build`):**
  * `tsc` executado sem erros (código 0).

---

### 8. Riscos Identificados e Mitigações

| Risco | Severidade | Mitigação Aplicada |
|---|:---:|---|
| **Erros de arredondamento cumulativo de centavos** | Alta | Aplicação da função utilitária `roundCurrency` com `Number.EPSILON` em todas as etapas de multiplicação e divisão. |
| **Injeção de alíquotas inválidas via API externa** | Média | Zod DTO com `.nonnegative()`, `.positive()` e `.strict()`. |

---

### 9. Próximos Passos
* **TASK 02 (Sprint 2 - Tenant) — Catálogo de Produtos com Classificação da Reforma (`Product`):**
  * Desenvolver schemas Zod, service, controller e rotas de CRUD de produtos no banco dedicado (`vtx_<slug>`).
  * Validações estritas de NCM (8 dígitos) e CEST (7 dígitos).
  * Criar suíte de testes `test/tenant.product.test.ts`.

---

### 10. Parecer do Product Owner (PO)
* **Veredicto:** 🟢 **APROVADO PARA HOMOLOGAÇÃO**
* **Comentário do PO:** A transição de interfaces para DTOs Zod proposta pelo desenvolvedor enriqueceu consideravelmente a arquitetura. O motor calcula com precisão matemática os cenários da Reforma Tributária e todos os 107 testes da plataforma estão verdes.
