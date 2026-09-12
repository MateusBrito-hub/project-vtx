# Relatório de Alterações — TASK 02 (Sprint 1 - Tenant)
## Schema do Banco Dedicado no Prisma e Migrações de Tenant

---

### 1. Identificação da Tarefa
* **Projeto:** `project-vtx`
* **Fase:** 2 (VTX Tenant — Sistema Fiscal Cloud e Multi-Filial)
* **Sprint:** 1 (Fundação Multi-Tenant, Banco Dedicado e Certificados Digitais A1)
* **Task:** 02 — Schema do Banco Dedicado e Migrações de Tenant
* **Data:** 12/09/2026
* **Status:** 🟢 **Concluído e Aprovado**

---

### 2. Objetivo da Alteração
Estruturar a persistência do banco de dados dedicado do tenant (`prisma/tenant.prisma`) com foco em arquitetura multiempresa (Matriz e Filiais via `Company`), suporte integral à Reforma Tributária (EC 132/2023 - IVA Dual IBS/CBS/IS e Split Payment), gerar o cliente tipado em `src/generated/tenant-prisma` e implementar o executor DDL idempotente de migrações (`runTenantMigrations`).

---

### 3. Contexto e Justificativa
O sistema administrativo central (VTX Core) possui seu próprio modelo em `prisma/schema.prisma` gerenciando contratos, planos e quotas. Para a operação fiscal diária nos bancos dedicados `vtx_<slug>`, fazia-se necessária uma modelagem autônoma que não dependesse de conexão com o banco central, capaz de processar emissões de NF-e (55) e NFC-e (65) calculando simultaneamente impostos legados e novos tributos da Reforma Tributária com segregação de séries e certificados A1 por filial.

---

### 4. Arquivos Modificados/Criados

| Tipo | Caminho do Arquivo | Descrição |
|:---:|---|---|
| **[NEW]** | `prisma/tenant.prisma` | Schema declarativo do Prisma dedicado ao tenant com modelos fiscais e multiempresa |
| **[NEW]** | `src/modules/tenant/database/tenant-migration.ts` | DDL estrutural idempotente e helper de migração automática de novos bancos |
| **[NEW]** | `test/tenant.schema.test.ts` | Suíte de testes validando geração do cliente, modelos, enums e migrações |
| **[MODIFY]** | `src/modules/tenant/config/tenant-connection.ts` | Tipagem e injeção do `TenantPrismaClient` recém-gerado como default factory |
| **[MODIFY]** | `package.json` | Adição do script `prisma:tenant:generate` |

---

### 5. Detalhamento das Alterações Técnicas

1. **Modelagem Relacional Multiempresa (`prisma/tenant.prisma`):**
   * **`Company`**: Representa a matriz e as filiais de uma mesma organização, com CNPJ, Inscrição Estadual, endereço e código IBGE do município;
   * **`FiscalConfig`**: Configurações fiscais segregadas por filial (`companyId`), incluindo ambiente (Homologação/Produção), regime tributário (CRT), séries sequenciais independentes para NF-e/NFC-e, tokens CSC e chaves/senhas do Certificado Digital A1;
   * **`Customer`**: Cadastro de destinatários fiscais com validação do código IBGE do município para partilha do IBS (Princípio do Destino);
   * **`Product`**: Catálogo de itens com campos da Reforma Tributária: `taxReformClass` (PADRAO, REDUZIDA_60, REDUZIDA_30, CESTA_BASICA_ISENTA, IMPOSTO_SELETIVO, IMUNE_ISENTO), incidência de IS (`isSubjectToIS`) e CST do IBS/CBS;
   * **`FiscalDocument` & `FiscalDocumentItem`**: Cabeçalho e itens contemplando partilha de IBS Estadual e Municipal (`totalIbsEstadual`, `totalIbsMunicipal`), CBS Federal e Imposto Seletivo, além dos tributos legados (ICMS/PIS/COFINS) para o período de transição (2026-2032);
   * **`FiscalPayment`**: Formas de pagamento com suporte a **Split Payment** (retenção imediata do IBS/CBS na liquidação financeira);
   * **`FiscalEvent`**: Rastreabilidade de cancelamentos, Cartas de Correção Eletrônicas (CC-e) e inutilizações.

2. **Geração do Cliente Prisma Dedicado:**
   * Script automatizado: `"prisma:tenant:generate": "prisma generate --schema=prisma/tenant.prisma"`;
   * Artefatos compilados em `src/generated/tenant-prisma`, garantindo auto-complete e tipagem estrita no TypeScript.

3. **Executor de Migrações Idempotentes (`TENANT_SCHEMA_DDL`):**
   * Script DDL completo utilizando blocos `DO $$ BEGIN CREATE TYPE ... EXCEPTION WHEN duplicate_object THEN null; END $$;` e tabelas com `CREATE TABLE IF NOT EXISTS`, garantindo execução segura durante o provisionamento de novos tenants ou atualizações de schema.

4. **Integração com o Roteador de Conexões:**
   * `TenantConnectionManager` atualizado para instanciar nativamente `TenantPrismaClient` com o adaptador `@prisma/adapter-pg`.

---

### 6. Impactos Arquiteturais e em Outros Módulos
* **Independência Total entre Schemas:** `prisma/schema.prisma` (Core) e `prisma/tenant.prisma` (Tenant) geram clientes isolados (`src/generated/prisma` vs `src/generated/tenant-prisma`), eliminando qualquer risco de colisões de tipos ou dependências circulares.
* **Escalabilidade de Dados:** Permite migrar ou atualizar bancos de tenants de forma assíncrona e desacoplada do banco administrativo.

---

### 7. Validação e Testes Realizados

#### A. Testes Unitários da Task 02 (`test/tenant.schema.test.ts`)
* **5 testes implementados e 100% aprovados:**
  * ✅ Instanciação de `TenantPrismaClient` com adaptador `PrismaPg`;
  * ✅ Verificação de exposição de todos os 8 modelos fiscais e seus métodos de query;
  * ✅ Validação da presença dos enums e classes da Reforma Tributária no DDL;
  * ✅ Validação das tabelas relacionais, chaves estrangeiras e campos de Split Payment;
  * ✅ Rejeição de slugs inválidos no executor de migração `runTenantMigrations`.

#### B. Regressão Geral
* **Execução global de testes (`vitest --run`):**
  * `11 passed (11 test files)`
  * `74 passed (74 total tests)`
  * Duração: ~2.8s.
* **Compilação TypeScript (`npm run build`):**
  * `tsc` executado sem erros (código 0).

---

### 8. Riscos Identificados e Mitigações

| Risco | Severidade | Mitigação Aplicada |
|---|:---:|---|
| **Conflito entre instâncias de Prisma Client** | Alta | Pastas de saída segregadas (`generated/prisma` vs `generated/tenant-prisma`) e injeção do adaptador `PrismaPg` via conexão dinâmica. |
| **Erros na aplicação de migrações em bancos novos** | Média | DDL idempotente com tratamento de tipos existentes e chaves únicas compostas (`companyId, model, series, number`). |

---

### 9. Próximos Passos
* **TASK 03 (Tenant) — Módulo de Certificado Digital A1 com Criptografia em Repouso:**
  * Implementar `certificate.crypto.ts` com **AES-256-GCM** e derivação de chave HKDF associada ao slug do tenant.
  * Implementar `certificate.parser.ts` para leitura de arquivos `.pfx`/`.p12`, extração de CNPJ titular e verificação de vigência.
  * Criar suíte de testes `test/tenant.certificate.test.ts`.

---

### 10. Parecer do Product Owner (PO)
* **Veredicto:** 🟢 **APROVADO PARA HOMOLOGAÇÃO**
* **Comentário do PO:** A modelagem do banco dedicado reflete com precisão os requisitos da Reforma Tributária (IBS/CBS/IS) e a segregação multi-filial alinhada com o stakeholder. O gerador do Prisma e o DDL idempotente garantem autonomia operacional para a emissão de notas.
