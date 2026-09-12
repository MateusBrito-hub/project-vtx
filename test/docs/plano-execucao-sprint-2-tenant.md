# Plano de Execução — Sprint 2 (Tenant) do `project-vtx`
## Motor de Tributação Híbrido e Cadastros Operacionais da Reforma Tributária (IBS/CBS/IS)

| Metadado | Detalhe |
|---|---|
| **Sprint** | 2 (Tenant) — Motor Tributário e Cadastros Operacionais da Reforma Tributária |
| **Projeto** | `MateusBrito-hub/project-vtx` (Módulo `src/modules/tenant/`) |
| **Branch base** | `master` |
| **Papel do Assistente** | Product Owner (PO) & Auditor de Qualidade (Acesso de edição restrito a `test/docs/` e `relatorios/`) |
| **Papel do Usuário** | Desenvolvedor Responsável (Implementação de código em `src/`, `prisma/` e `test/`) |
| **Duração de referência** | 1 semana |
| **Marco Legal** | Emenda Constitucional 132/2023, PLP 68/2024 (IVA Dual: IBS / CBS / IS) |

---

## 1. Objetivo da Sprint 2 (Tenant)

Desenvolver a inteligência fiscal da plataforma VTX no banco dedicado de cada tenant, contemplando o motor matemático de cálculo tributário híbrido (coexistência entre ICMS/PIS/COFINS e o novo IVA Dual IBS/CBS/IS), os cadastros operacionais com validações fiscais estritas (Produtos e Clientes com código IBGE de destino) e o validador de quotas de assinatura (`maxDocs`) integrado ao VTX Core.

---

## 2. Forma de Trabalho e Governança

1. **Separação de Papéis:**
   * O **Product Owner (PO)** especifica os requisitos de negócio, arquitetura, fórmulas matemáticas, interfaces e critérios de aceite, audita os resultados, executa os comandos de teste/build e emite os relatórios formais em `test/docs/` e `relatorios/`.
   * O **Desenvolvedor (Usuário)** implementa o código-fonte em `src/` e os arquivos de teste em `test/`.
2. **Ciclo por Task:**
   * PO apresenta o detalhamento da Task com exemplos de código, schemas e cenários de teste;
   * Desenvolvedor implementa os arquivos correspondentes;
   * PO executa `npm run build` e `vitest` para auditoria estrita;
   * Se houver falhas, PO orienta os ajustes;
   * Se aprovado, PO gera o relatório de alterações de 10 seções e o desenvolvedor realiza o commit;
   * Avança-se para a próxima task.

---

## 3. Ordem de Execução das Tasks da Sprint 2

| Ordem | Task | Foco | Prioridade | Esforço | Dependências |
|:---:|---|---|:---:|:---:|:---:|
| **1** | **TASK 01 (Tenant)** | Motor de Cálculo Tributário Híbrido (`tax-calculator.ts`) | 🔴 Alta | Médio-Alto | Sprint 1 |
| **2** | **TASK 02 (Tenant)** | Catálogo de Produtos com Classificação da Reforma (`taxReformClass`) | 🟠 Alta | Médio | Task 01 |
| **3** | **TASK 03 (Tenant)** | Cadastro de Destinatários Fiscais com Código IBGE e Princípio do Destino | 🟠 Alta | Médio | Task 01 |
| **4** | **TASK 04 (Tenant)** | Validador de Quotas de Emissão (`maxDocs`) e Fechamento da Sprint 2 | 🟡 Média | Médio | Tasks 01, 02 e 03 |

---

# TASK 01 (Tenant) — Motor de Cálculo Tributário Híbrido (`tax-calculator.ts`)

## Prioridade
🔴 **Alta**

## Objetivo
Criar o componente central de cálculo de tributos em `src/modules/tenant/fiscal/engine/tax-calculator.ts` capaz de processar os itens de uma venda calculando simultaneamente os tributos tradicionais do período de transição (ICMS, PIS, COFINS, IPI) e os tributos da Reforma Tributária (IBS Estadual, IBS Municipal, CBS Federal e Imposto Seletivo).

## Regras de Negócio e Fórmulas da Reforma Tributária (EC 132/2023):
1. **Base de Cálculo:**
   * $\text{Base} = (\text{Quantidade} \times \text{Preço Unitário}) - \text{Desconto} + \text{Frete} + \text{Outras Despesas}$;
   * O IBS e a CBS são calculados "por fora" (não integram sua própria base de cálculo nem a base um do outro).
2. **Classificações Tributárias (`taxReformClass`):**
   * **`PADRAO`**: 100% da alíquota de IBS e CBS;
   * **`REDUZIDA_60`**: Redução de 60% na alíquota (alíquota efetiva = $0{,}40 \times \text{Alíquota Base}$), aplicável a saúde, educação, dispositivos médicos;
   * **`REDUZIDA_30`**: Redução de 30% na alíquota (alíquota efetiva = $0{,}70 \times \text{Alíquota Base}$), aplicável a serviços de profissões regulamentadas;
   * **`CESTA_BASICA_ISENTA`**: Alíquota zero (0%) para IBS e CBS;
   * **`IMUNE_ISENTO`**: Alíquota zero (0%);
   * **`IMPOSTO_SELETIVO`**: Alíquota padrão de IBS/CBS somada ao cálculo do Imposto Seletivo (`valorIS`).
3. **Partilha Federativa do IBS (Princípio do Destino):**
   * **IBS Estadual:** $\text{Base} \times \text{Alíquota Estadual da UF de Destino}$;
   * **IBS Municipal:** $\text{Base} \times \text{Alíquota Municipal do Município de Destino (via Código IBGE)}$;
   * **IBS Total:** $\text{IBS Estadual} + \text{IBS Municipal}$.
4. **Alíquotas Padrão de Referência para Simulação e Homologação:**
   * CBS Federal de Referência: `8.80%`;
   * IBS Estadual de Referência: `12.00%` (variável por UF);
   * IBS Municipal de Referência: `5.70%` (variável por município);
   * Imposto Seletivo de Referência: `1.50%` (apenas quando `isSubjectToIS = true`).

## Critérios de Aceite
- [ ] O motor calcula com exatidão arredondando para 2 casas decimais (`Decimal`);
- [ ] Produtos marcados com `REDUZIDA_60` possuem redução exata de 60% no valor apurado de IBS e CBS;
- [ ] Produtos marcados com `CESTA_BASICA_ISENTA` resultam em valor zero de IBS/CBS;
- [ ] Partilha entre IBS Estadual e Municipal é calculada e segregada com precisão;
- [ ] Suíte de testes unitários `test/tax.calculator.test.ts` cobrindo todos os regimes e classes da Reforma com 100% de aprovação.

---

# TASK 02 (Tenant) — Catálogo de Produtos com Classificação da Reforma (`Product`)

## Prioridade
🟠 **Alta**

## Objetivo
Implementar os endpoints REST, controller, service e schemas de validação Zod para o cadastro e manutenção de produtos no banco dedicado do tenant, com suporte obrigatório às classificações fiscais da Reforma Tributária.

## Escopo
1. Criar `src/modules/tenant/product/product.schema.ts`:
   * Schema Zod `.strict()` com validação de NCM (8 dígitos numéricos), CEST (7 dígitos opcionais), unidade, preço decimal positivo, CFOP e `taxReformClass`.
2. Criar `src/modules/tenant/product/product.service.ts` e `product.controller.ts`:
   * `POST /api/tenant/products`: Criação com garantia de SKU único no tenant;
   * `GET /api/tenant/products`: Listagem paginada e com filtro por descrição/SKU;
   * `GET /api/tenant/products/:id`: Detalhe do produto;
   * `PUT /api/tenant/products/:id`: Atualização cadastral com validação estrita;
   * `DELETE /api/tenant/products/:id`: Exclusão lógica ou física.
3. Criar `test/tenant.product.test.ts` cobrindo o CRUD e a validação de regras fiscais.

---

# TASK 03 (Tenant) — Cadastro de Destinatários Fiscais (`Customer`)

## Prioridade
🟠 **Alta**

## Objetivo
Implementar o módulo de cadastro de clientes destinatários de documentos fiscais, garantindo a conformidade com o **Princípio do Destino** da Reforma Tributária (local de entrega e código IBGE do município de destino).

## Escopo
1. Criar `src/modules/tenant/customer/customer.schema.ts`:
   * Schema Zod `.strict()` com validação de CPF (11 dígitos) ou CNPJ (14 dígitos), IE/Indicador de IE, endereço completo, UF e Código IBGE de 7 dígitos do município.
2. Criar `src/modules/tenant/customer/customer.service.ts` e `customer.controller.ts`:
   * Endpoints REST sob `/api/tenant/customers`.
3. Criar `test/tenant.customer.test.ts` validando persistência, busca por CPF/CNPJ e integridade do código IBGE.

---

# TASK 04 (Tenant) — Validador de Quotas de Emissão (`maxDocs`) e Fechamento

## Prioridade
🟡 **Média**

## Objetivo
Implementar o validador de limites de emissão fiscal integrado ao VTX Core (`Subscription.plan.maxDocs`) que impede a emissão de novos documentos caso a cota mensal da assinatura do cliente tenha sido atingida, finalizando a homologação da Sprint 2.

## Escopo
1. Criar `src/modules/tenant/fiscal/quota.service.ts`:
   * Busca a assinatura ativa do tenant no banco central (`vtx_core`);
   * Conta os documentos autorizados no mês corrente no banco dedicado (`vtx_<slug>`);
   * Retorna permissão de emissão ou bloqueio (com número restante de notas disponíveis).
2. Criar testes unitários e de integração `test/tenant.quota.test.ts`.
3. Executar regressão global (`npm test -- --run`) e emitir o Relatório Final da Sprint 2.
