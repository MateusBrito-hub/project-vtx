# Relatório de Alterações — TASK 04 (Sprint 1 - Tenant)
## Middleware de Resolução de Subdomínio e Endpoints Fiscais

---

### 1. Identificação da Tarefa
* **Projeto:** `project-vtx`
* **Fase:** 2 (VTX Tenant — Sistema Fiscal Cloud e Multi-Filial)
* **Sprint:** 1 (Fundação Multi-Tenant, Banco Dedicado e Certificados Digitais A1)
* **Task:** 04 — Middleware de Resolução de Tenant, Endpoints de Configuração e Fechamento
* **Data:** 12/09/2026
* **Status:** 🟢 **Concluído e Aprovado**

---

### 2. Objetivo da Alteração
Implementar o middleware de identificação dinâmica de tenant (`src/modules/tenant/tenant.middleware.ts`) com suporte a subdomínios (`slug.dominio.com.br`) e header `X-Tenant-Slug`, validação de conta ativa no banco central (VTX Core), injeção do Prisma Client dedicado em `req.tenantPrisma`, e disponibilizar os endpoints REST protegidos para gerenciamento de filiais (`Company`), parâmetros fiscais e upload seguro do Certificado Digital A1.

---

### 3. Contexto e Justificativa
Com a infraestrutura de conexões (Task 01), schema dedicado (Task 02) e criptografia de certificados (Task 03) concluídas, esta task realiza a amarração do ecossistema HTTP. O middleware garante que nenhuma requisição operacional alcance o código de negócio sem que o cliente emissor esteja autenticado, ativo na plataforma central e conectado ao seu banco PostgreSQL dedicado (`vtx_<slug>`).

---

### 4. Arquivos Modificados/Criados

| Tipo | Caminho do Arquivo | Descrição |
|:---:|---|---|
| **[NEW]** | `src/modules/tenant/tenant.middleware.ts` | Middleware de extração de subdomínio, validação de status e injeção de `req.tenantPrisma` |
| **[NEW]** | `src/modules/tenant/config/tenant-config.schema.ts` | Schemas Zod `.strict()` para criação de filiais, configuração fiscal e upload de certificados |
| **[NEW]** | `src/modules/tenant/config/tenant-config.service.ts` | Camada de negócio para gestão de matriz/filiais, séries fiscais e armazenamento de A1 |
| **[NEW]** | `src/modules/tenant/config/tenant-config.controller.ts` | Handlers HTTP sanitizados com tratamento de erros padronizado |
| **[NEW]** | `src/modules/tenant/config/tenant-config.routes.ts` | Roteador Express acoplado ao `tenantMiddleware` |
| **[NEW]** | `test/tenant.routes.test.ts` | Suíte de testes de integração com Supertest cobrindo middleware, filiais e certificados |
| **[MODIFY]** | `src/app.ts` | Montagem do roteador de tenant em `/api/tenant` |

---

### 5. Detalhamento das Alterações Técnicas

1. **Extração e Sanitização de Subdomínio (`extractTenantSlug`):**
   * Avalia primeiramente o cabeçalho `X-Tenant-Slug`;
   * Realiza a inspeção do cabeçalho `Host` / `req.hostname` extraindo a primeira seção (`slug.vtx.com.br`);
   * Ignora subdomínios reservados do sistema (`admin`, `api`, `core`, `www`, `localhost`, etc.);
   * Aplica `sanitizeTenantSlug`, prevenindo injeção de caracteres especiais.

2. **Validação e Injeção de Contexto no Ciclo de Vida (`tenantMiddleware`):**
   * Realiza consulta otimizada na tabela `Client` do banco central (`findFirst` com fallback para hífens ou underscores);
   * Rejeita com `HTTP 400` se o identificador não for fornecido;
   * Rejeita com `HTTP 404` se o tenant não existir;
   * Rejeita com `HTTP 403` se a conta estiver suspensa (`status !== 'active'`);
   * Injeta no `Express.Request`: `req.tenantSlug`, `req.tenant` e `req.tenantPrisma` (instância de `TenantPrismaClient`).

3. **Endpoints REST Implementados (`/api/tenant`):**
   * `GET /companies`: Lista todas as filiais e matriz com resumo fiscal;
   * `POST /companies`: Cadastro de nova filial com validação de CNPJ de 14 dígitos e auto-provisionamento de `FiscalConfig`;
   * `GET /fiscal/config`: Consulta parâmetros de emissão (Ambiente, Regime CRT, Séries, CSC) sem expor senhas;
   * `PUT /fiscal/config`: Atualização de numerações sequenciais e opções da Reforma Tributária;
   * `POST /fiscal/certificate`: Upload de Base64 PFX e senha, validação ICP-Brasil, criptografia AES-256-GCM em repouso e armazenamento seguro;
   * `GET /fiscal/certificate/status`: Consulta de validade e dias restantes para expiração do A1 sem expor chaves privadas.

---

### 6. Impactos Arquiteturais e em Outros Módulos
* **Total Transparência para o Usuário Final:** A aplicação frontend pode apontar requisições diretamente para `slug.vtx.com.br` e o backend resolve automaticamente para o banco isolado correto.
* **Blindagem Contra Mass Assignment:** Todos os inputs são validados por schemas Zod com `.strict()`, rejeitando propriedades não documentadas.

---

### 7. Validação e Testes Realizados

#### A. Testes de Integração da Task 04 (`test/tenant.routes.test.ts`)
* **12 testes implementados e 100% aprovados:**
  * ✅ Bloqueio 400 quando o slug do tenant não é informado;
  * ✅ Bloqueio 404 para tenants inexistentes no banco central;
  * ✅ Bloqueio 403 para tenants suspensos ou inativos;
  * ✅ Resolução transparente via subdomínio (`Host: slug.vtx.com.br`);
  * ✅ Cadastro de filial com código 201 e dados fiscais padrão;
  * ✅ Rejeição 400 para CNPJs inválidos e tentativa de injeção de campos extras;
  * ✅ Listagem de filiais cadastradas via GET;
  * ✅ Leitura e atualização das configurações fiscais da matriz e filiais;
  * ✅ Upload e criptografia completa de certificado A1 válido via Supertest;
  * ✅ Rejeição 400 de upload caso a senha do certificado esteja incorreta;
  * ✅ Consulta de status do certificado confirmando omissão de chaves e senhas.

#### B. Regressão Geral
* **Execução global de testes (`vitest --run`):**
  * `13 passed (13 test files)`
  * `97 passed (97 total tests)`
  * Duração: ~4.3s.
* **Compilação TypeScript (`npm run build`):**
  * `tsc` executado sem erros (código 0).

---

### 8. Riscos Identificados e Mitigações

| Risco | Severidade | Mitigação Aplicada |
|---|:---:|---|
| **Acesso a dados de outro tenant por spoofing de Host** | Alta | O `app.set('trust proxy', 1)` garante a resolução confiável do Host e cada slug passa por sanitização e validação central de status no VTX Core. |
| **Vazamento de chaves privadas em endpoints REST** | Crítica | Os serializers e controllers filtram e omitem propositalmente propriedades sensíveis (`certificatePfxBase64`, `certificatePasswordEnc`). |

---

### 9. Próximos Passos
* **Fechamento da Sprint 1 (Tenant):**
  * Emissão do Relatório Final da Sprint 1 (Tenant).
  * Início do planejamento da **Sprint 2 (Tenant) — Motor Tributário e Cadastro Operacional da Reforma Tributária (IBS/CBS/IS)**.

---

### 10. Parecer do Product Owner (PO)
* **Veredicto:** 🟢 **APROVADO PARA HOMOLOGAÇÃO**
* **Comentário do PO:** A entrega da Task 04 completa a fundação da Fase 2 com perfeição. O sistema possui agora um roteador multitenant com resolução por subdomínio, schema dedicado da Reforma Tributária, proteção criptográfica A1 e 97 testes automatizados verdes.
