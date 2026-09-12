# Relatório de Alterações — TASK 01 (Sprint 1 - Tenant)
## Roteador Dinâmico de Conexões Multitenant (`TenantConnectionManager`)

---

### 1. Identificação da Tarefa
* **Projeto:** `project-vtx`
* **Fase:** 2 (VTX Tenant — Sistema Fiscal Cloud e Multi-Filial)
* **Sprint:** 1 (Fundação Multi-Tenant, Banco Dedicado e Certificados Digitais A1)
* **Task:** 01 — Estrutura Modular e Roteador Dinâmico de Conexões (`TenantConnectionManager`)
* **Data:** 12/09/2026
* **Status:** 🟢 **Concluído e Aprovado**

---

### 2. Objetivo da Alteração
Implementar a infraestrutura central de roteamento dinâmico de conexões de banco de dados (`src/modules/tenant/config/tenant-connection.ts`) capaz de derivar, gerenciar e armazenar em cache pools de conexão PostgreSQL (`pg.Pool`) e instâncias do `@prisma/adapter-pg` dedicadas para cada tenant (`vtx_<slug>`), garantindo isolamento total de dados, prevenção contra exaustão de conexões e proteção contra SQL Injection.

---

### 3. Contexto e Justificativa
Na Fase 1 (VTX Core), o provisionamento do banco dedicado foi configurado em `src/shared/database/database-manager.ts` (`createClientDatabase`), criando bancos com o prefixo `vtx_<slug>`.
Na Fase 2, o sistema precisa atender requisições operacionais vindas dos subdomínios dos clientes (`slug.dominio.com.br`) roteando cada chamada para o respectivo banco dedicado. Para viabilizar essa arquitetura com alto desempenho e sem sobrecarregar o servidor PostgreSQL, foi desenvolvido um gerenciador com cache local, controle de pool por cliente, suporte a eviction de conexões inativas (LRU) e fechamento gracioso.

---

### 4. Arquivos Modificados/Criados

| Tipo | Caminho do Arquivo | Descrição |
|:---:|---|---|
| **[NEW]** | `src/modules/tenant/config/tenant-connection.ts` | Roteador e gerenciador dinâmico de pools e adapters do tenant |
| **[NEW]** | `test/tenant.connection.test.ts` | Suíte de testes unitários cobrindo 100% dos fluxos de conexão e ciclo de vida |

---

### 5. Detalhamento das Alterações Técnicas

1. **Sanitização e Validação Estrita de Slug (`sanitizeTenantSlug`):**
   * Normalização com remoção de acentos (NFD) e conversão para lowercase;
   * Substituição de hífens por underscores (`empresa-a` -> `empresa_a`);
   * Remoção de qualquer caractere fora de `[a-z0-9_]`;
   * Rejeição explícita (erro informativo) para slugs vazios ou que excedam o limite máximo de 50 caracteres (impedindo ultrapassar os 63 bytes suportados por identificadores PostgreSQL).

2. **Resolução de Banco Físico (`getTenantDatabaseName`):**
   * Retorna o identificador `vtx_<slug>` padronizado e truncado em 63 caracteres.

3. **Montagem Dinâmica de Connection String (`getTenantConnectionString`):**
   * Utiliza a API `URL` nativa do Node.js sobre a `DATABASE_URL` base;
   * Substitui apenas o `pathname` pelo banco do tenant (`/vtx_<slug>`), mantendo intactos as credenciais de autenticação, host, porta e query parameters (`?schema=public&sslmode=prefer`).

4. **Gerenciador de Conexões (`TenantConnectionManager`):**
   * **Cache de Pools:** Armazena entradas em `Map<string, TenantConnectionEntry>` com `slug`, `dbName`, `pool`, `adapter`, `client`, `createdAt` e `lastAccessedAt`;
   * **Factory Flexível:** Permite injeção de fábrica de clientes Prisma (preparado para receber o cliente dedicado de `prisma/tenant.prisma` na Task 02);
   * **Configuração de Pool:** `maxPoolSize` (default 5 conexões por tenant), `idleTimeoutMillis` (30s) e `connectionTimeoutMillis` (5s);
   * **Ciclo de Vida:** Métodos `closeTenantConnection(slug)` e `closeAllTenantConnections()` para encerramento gracioso via `pool.end()`;
   * **Eviction de Inativos (`evictIdleConnections`):** Permite rotinas de limpeza periódica de tenants ociosos em memória.

---

### 6. Impactos Arquiteturais e em Outros Módulos
* **Zero impacto sobre o VTX Core:** Os módulos centrais (`src/modules/client`, `src/modules/plan`, etc.) continuam utilizando `src/shared/database/prisma.ts` apontando para o banco administrativo `vtx_core`.
* **Desacoplamento Modular:** O módulo `src/modules/tenant/` é auto-contido e modular, permitindo que a API do tenant execute no mesmo processo ou seja iniciada como serviço independente na porta 5000 conforme definido no roadmap.

---

### 7. Validação e Testes Realizados

#### A. Testes Unitários da Task 01 (`test/tenant.connection.test.ts`)
* **16 testes implementados e 100% aprovados:**
  * ✅ Normalização de slugs com hífens e remoção de acentos;
  * ✅ Rejeição de strings vazias, caracteres especiais e injeção maliciosa;
  * ✅ Formatação correta do identificador `vtx_<slug>` e corte em 63 caracteres;
  * ✅ Preservação de parâmetros complexos na connection string;
  * ✅ Criação de pool e cliente sob demanda no primeiro acesso;
  * ✅ Reaproveitamento do cliente em cache (Cache Hit);
  * ✅ Isolamento estrito entre bancos de tenants distintos (`vtx_tenant_a` vs `vtx_tenant_b`);
  * ✅ Fechamento e desalocação individual de conexões;
  * ✅ Encerramento em lote de todas as conexões ativas;
  * ✅ Desalocação automática de conexões ociosas (Idle Eviction).

#### B. Regressão Geral
* **Execução global de testes (`vitest --run`):**
  * `10 passed (10 test files)`
  * `69 passed (69 total tests)`
  * Duração: ~3.7s.
* **Compilação TypeScript (`npm run build`):**
  * `tsc` executado sem erros (código 0).

---

### 8. Riscos Identificados e Mitigações

| Risco | Severidade | Mitigação Aplicada |
|---|:---:|---|
| **SQL Injection no nome do banco** | Alta | Sanitização estrita via regex `[a-z0-9_]` e rejeição de caracteres de escape antes da montagem da connection string. |
| **Exaustão de conexões no PostgreSQL** | Alta | Pool individual limitado por padrão a 5 conexões e método de eviction de conexões ociosas. |
| **Vazamento de memória por cache estático** | Média | Registro de `lastAccessedAt` em cada entrada e suporte a desalocação sob demanda. |

---

### 9. Próximos Passos
* **TASK 02 (Tenant) — Schema do Banco Dedicado e Migrações de Tenant:**
  * Criar `prisma/tenant.prisma` com as entidades fiscais (`Company`, `FiscalConfig`, `Customer`, `Product`, `FiscalDocument`, `FiscalDocumentItem`, `FiscalPayment`, `FiscalEvent`) compatíveis com a Reforma Tributária (IBS/CBS/IS).
  * Gerar o Prisma Client dedicado do tenant em `src/generated/tenant-prisma`.
  * Implementar helper para migrações automatizadas do tenant.

---

### 10. Parecer do Product Owner (PO)
* **Veredicto:** 🟢 **APROVADO PARA HOMOLOGAÇÃO**
* **Comentário do PO:** A entrega da Task 01 atendeu integralmente aos critérios de governança e arquitetura estabelecidos no plano de execução. O isolamento multi-tenant por conexão dinâmica foi comprovado por testes automatizados determinísticos, garantindo base sólida para a modelagem fiscal da Task 02.
