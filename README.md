<div align="center">

# 🏢 Plataforma VTX — Ecossistema Fiscal Multi-Tenant

**Plataforma modular de alta escalabilidade para gestão de clientes, controle de quotas de assinatura e emissão de Documentos Fiscais Eletrônicos (NF-e / NFC-e) com suporte à Reforma Tributária (IBS / CBS / IS)**

![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-53%20passed%20(100%25)-6E9F18?logo=vitest&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Multi--Stage%20Non--Root-2496ED?logo=docker&logoColor=white)
![Security](https://img.shields.io/badge/Security-OWASP%20Certified-success?logo=shieldsdotio&logoColor=white)
![License](https://img.shields.io/badge/license-ISC-blue)

</div>

---

## 📖 Visão Geral do Ecossistema VTX

O projeto **VTX** é um ecossistema corporativo distribuído em três camadas complementares, projetado para aliar governança administrativa centralizada, autonomia operacional por cliente e resiliência de vendas físicas no ponto de venda:

```mermaid
flowchart TD
    subgraph Layer1["1. VTX Core (Backoffice Central & Governança) — CONCLUÍDO ✅"]
        CoreAPI["API Core (Porta 4000)"]
        CoreDB[("PostgreSQL Central: vtx_core")]
        CoreAPI --> CoreDB
    end

    subgraph Layer2["2. VTX Tenant (Motor Fiscal Cloud & Multi-Filial) — EM DESENVOLVIMENTO 🚀"]
        TenantAPI["API Fiscal do Tenant (Porta 5000)"]
        Router["Tenant Connection Router & Subdomain Resolver"]
        TenantAPI --> Router
        
        subgraph DedicatedDBs["Bancos Dedicados Isolados por Tenant"]
            DB1[("vtx_empresa_a")]
            DB2[("vtx_empresa_b")]
            DBN[("vtx_...")]
        end
        Router --> DB1
        Router --> DB2
        Router --> DBN
    end

    subgraph Layer3["3. VTX PDV (Frente de Caixa Desktop & Offline) — PLANEJADO 🛒"]
        PDV["Terminal de Caixa Local (Tauri + TypeScript + SQLite)"]
        Printer["Impressora Térmica 80mm"]
        PDV --> Printer
    end

    subgraph External["SEFAZ & Tributação"]
        SEFAZ["Web Services SEFAZ (SVRS / Estadual)"]
    end

    TenantAPI -.->|"Valida Quota (maxDocs)"| CoreAPI
    TenantAPI -->|"Transmissão NF-e/NFC-e"| SEFAZ
    PDV -->|"1. Sincroniza Catálogo & Preços"| TenantAPI
    PDV -->|"2. Descarrega Vendas Offline (tpEmis = 9)"| TenantAPI
```

### As 3 Camadas do Produto:

1. **VTX Core (Concluído & Homologado ✅):**
   * Backend administrativo central da plataforma (`admin.vtx.com.br` ou porta `4000`).
   * Responsável pelo cadastro de tenants (`Client`), gestão de planos (`Plan`), faturamento de assinaturas (`Subscription`), controle de cotas de emissão (`maxDocs`), auditoria, controle de acessos (RBAC) e provisionamento automatizado de bancos dedicados.
2. **VTX Tenant — Sistema Fiscal & Gerencial (Em Desenvolvimento Ativo - Fase 2 🚀):**
   * Backend operacional e gerencial acessado pelo subdomínio de cada empresa (`slug.dominio.com.br` ou porta `5000`).
   * Opera sobre o banco PostgreSQL dedicado da empresa (`vtx_<slug>`), gerenciando matriz e filiais (`Company`), catálogo compartilhado de produtos, cadastro de clientes, motor de tributação híbrido (ICMS/PIS/COFINS + Reforma Tributária IBS/CBS/IS), emissão de NF-e (55) e NFC-e (65), e mensageria nativa com a SEFAZ.
3. **VTX PDV Desktop (Planejado - Fase 3 🛒):**
   * Aplicação client-side em repositório dedicado (`project-vtx-pdv`) voltada para o computador do caixa no comércio físico.
   * Arquitetura em **Tauri (Rust Core) + TypeScript (UI) + SQLite local**, garantindo **operação 100% offline** através de contingência NFC-e legal (`tpEmis = 9`) e sincronização resiliente (*store-and-forward*).

---

## 📑 Sumário

- [Decisões Estratégicas e Arquiteturais](#-decisões-estratégicas-e-arquiteturais)
- [Status de Desenvolvimento do Projeto](#-status-de-desenvolvimento-do-projeto)
- [Stack e Principais Tecnologias](#-stack-e-principais-tecnologias)
- [Arquitetura de Dados (Core vs Tenant)](#-arquitetura-de-dados-core-vs-tenant)
- [Como Rodar o Projeto](#-como-rodar-o-projeto)
- [Variáveis de Ambiente](#-variáveis-de-ambiente)
- [Scripts Disponíveis](#-scripts-disponíveis)
- [Autenticação, Permissões e Segurança](#-autenticação-permissões-e-segurança)
- [Testes Automatizados e Homologação](#-testes-automatizados-e-homologação)
- [Diretrizes de Colaboração e Governança](#-diretrizes-de-colaboração-e-governança)

---

## 🏛️ Decisões Estratégicas e Arquiteturais

Todas as decisões técnicas do ecossistema foram avaliadas pelo Product Owner e arquitetadas para aliar **produtividade de desenvolvimento**, **custo operacional mínimo** e **escalabilidade elástica**:

1. **Monorepo com Runtime Segregado (Opção A):**
   * O código de `vtx-core` e `vtx-tenant` reside no mesmo repositório Git, facilitando compartilhamento de tipagens TypeScript, DTOs Zod e orquestração Docker Compose.
   * Em produção, operam como **dois serviços independentes em runtime** (`vtx-core` na porta 4000 e `vtx-tenant` na porta 5000), permitindo escalonamento elástico independente (o motor fiscal pode escalar para 20 réplicas durante picos de vendas sem sobrecarregar o Core administrativo).
2. **Database-per-Tenant com Roteamento Dinâmico:**
   * Cada tenant opera em um banco PostgreSQL dedicado (`vtx_<slug>`), criado automaticamente no cadastro.
   * Elimina o problema de concorrência (*Noisy Neighbor Problem*), atende com rigor à LGPD e permite mover o banco de um cliente grande para outra instância sem refatorar código.
3. **Multiempresa (Matriz e Filiais Centralizadas):**
   * O tenant representa a organização/grupo econômico, e a tabela `Company` gerencia as filiais.
   * O usuário acessa uma única URL (`slug.dominio.com.br`), faz login uma única vez e alterna entre filiais pelo topo da tela (*Company Switcher*), compartilhando catálogo de produtos e clientes, mas com séries, numerações e certificados digitais A1 isolados por filial.
4. **Reforma Tributária Nativa (Future-Proof):**
   * O motor fiscal nasce compatível com a Emenda Constitucional 132/2023 e PLP 68/2024.
   * Suporte nativo à coexistência durante a transição (2026–2032): apuração simultânea de ICMS/PIS/COFINS e do novo **IVA Dual: IBS (Estadual/Municipal), CBS (Federal), Imposto Seletivo (IS)** e preparação para **Split Payment**.
5. **Motor Fiscal Proprietário (Zero Custo com Intermediários):**
   * Geração própria de XML padrão PL_009_V4, assinatura digital XMLDSig via Certificado A1 e comunicação direta via SOAP/WSDL com os servidores da SEFAZ, eliminando taxas por nota de gateways terceiros (Focus, PlugNotas, etc.).
6. **Criptografia de Certificados A1 em Repouso:**
   * Certificados PFX e senhas armazenados com criptografia **AES-256-GCM** e chaves derivadas por HKDF vinculadas ao `slug` do tenant.
7. **Conexão por Subdomínio (`slug.dominio.com.br`):**
   * Roteamento automático via subdomínio ou cabeçalho `X-Tenant-Slug`, com suporte a DNS Wildcard e certificados SSL da Let's Encrypt / Cloudflare.

---

## 📊 Status de Desenvolvimento do Projeto

| Fase | Domínio | Escopo / Módulos | Status | Veredicto do PO |
|:---:|---|---|:---:|:---:|
| **Fase 1** | **VTX Core** | Sprints 1 a 4: Contenção de Riscos, Blindagem Zod, PII (LGPD), Logout JWT, Trust Proxy, Deploy Docker e Certificação Geral de Segurança. | 🟢 **100% CONCLUÍDO** | **Homologado com Certificado Executivo de Segurança (53 testes verdes / 0 falhas).** |
| **Fase 2** | **VTX Tenant** | Sprints 1 a 4: Fundação Multi-Tenant, Multi-Filial, Reforma Tributária (IBS/CBS), Emissão NF-e (55) / NFC-e (65), Assinatura A1 e Transmissão SEFAZ. | 🟡 **EM DESENVOLVIMENTO** | **Sprint 1 (Fundação e Banco Dedicado) em andamento.** |
| **Fase 3** | **VTX PDV Desktop** | Repositório `project-vtx-pdv`: Terminal de caixa offline em Tauri + TypeScript + SQLite, contingência `tpEmis = 9` e sincronização bidirecional. | ⚪ **PLANEJADO** | **Início previsto após a conclusão da Fase 2.** |

---

## 🧰 Stack e Principais Tecnologias

| Camada | Tecnologia | Detalhe |
|---|---|---|
| **Runtime** | Node.js 20 LTS (Alpine) | Imagem Docker multi-stage minimalista (161 MB) |
| **Linguagem** | TypeScript 5.9 | Tipagem estrita em modo `strict` |
| **Framework HTTP** | Express 5 | Middlewares customizados e arquitetura modular |
| **ORM / Banco Central** | Prisma 7 + `@prisma/adapter-pg` | PostgreSQL 16 com driver adapter de alta performance |
| **Bancos Dedicados** | PostgreSQL 16 (`vtx_<slug>`) | Provisionamento dinâmico e isolamento total de dados |
| **Segurança & Criptografia** | AES-256-GCM, HKDF, Helmet, JWT, bcryptjs | Envelope Encryption para A1 e sanitização PII |
| **Validação de Entrada** | Zod (`.strict()`) | Proteção contra Mass Assignment em 100% dos controllers |
| **Testes Automatizados** | Vitest 4 | 53 testes automatizados (unitários, integração e segurança) |
| **Containerização** | Docker & Docker Compose | Usuário non-root (`node`), migrações automáticas determinísticas |

---

## 🏗️ Arquitetura de Dados (Core vs Tenant)

O ecossistema divide a persistência em dois esquemas lógicos claros:

### 1. Banco de Dados Central (`vtx_core`)
Controla a administração da plataforma, faturamento e catálogo de tenants:
* **`Client`**: Tenant cadastrado (razão social, CNPJ, `slug` único, status e vínculo com o plano).
* **`Plan`**: Plano contratado, valor da mensalidade e limite de notas (`maxDocs`).
* **`Subscription`**: Assinatura ativa vinculada ao cliente.
* **`User`**: Usuários administrativos centrais (`SUPER_ADMIN`, `ADMIN`, `OPERATOR`).

### 2. Banco de Dados Dedicado do Tenant (`vtx_<slug>`)
Armazena a operação diária e os dados fiscais sensíveis de cada contratante:
* **`Company`**: Matriz e filiais da rede (CNPJ, IE, endereço fiscal, certificado A1 e numerações).
* **`User` / `UserCompany`**: Usuários da empresa (gerentes, caixas, faturistas) com permissões por filial.
* **`Customer`**: Destinatários fiscais com validação do código IBGE do município (Princípio do Destino).
* **`Product`**: Catálogo de itens com NCM, CEST e categorias da Reforma Tributária.
* **`FiscalDocument` / `FiscalDocumentItem`**: Cabeçalho e itens de NF-e e NFC-e com apuração híbrida (ICMS/PIS/COFINS + IBS/CBS/IS).
* **`FiscalPayment`**: Formas de pagamento e dados para **Split Payment**.
* **`FiscalEvent`**: Cancelamentos, Cartas de Correção (CC-e) e Inutilizações.

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos
* Node.js 20+
* Docker e Docker Compose

### Opção 1 — Execução Integrada em Contêineres (Recomendado)
```bash
# 1. Clone o repositório
git clone https://github.com/MateusBrito-hub/project-vtx.git
cd project-vtx

# 2. Configure as variáveis de ambiente
cp .env.example .env

# 3. Suba o banco e a API com compilação multi-stage
docker compose up -d --build
```
A API compila o código TypeScript, executa as migrações do Prisma automaticamente no boot (`prisma migrate deploy`) e sobe sob usuário não-root `node` na porta `4000`.

### Opção 2 — Execução em Desenvolvimento Local
```bash
npm install --legacy-peer-deps
cp .env.example .env

# Gera os artefatos de modelo do Prisma
npx prisma generate

# Executa o servidor de desenvolvimento com hot-reload
npm run dev
```

---

## 🔑 Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|:---:|---|
| `DATABASE_URL` | ✅ | URL de conexão do PostgreSQL central (`postgresql://user:pass@host:5432/vtx_core?schema=public`) |
| `POSTGRES_USER` | ✅ | Usuário do container PostgreSQL no `docker-compose` |
| `POSTGRES_PASSWORD` | ✅ | Senha do container PostgreSQL no `docker-compose` |
| `POSTGRES_DB` | ✅ | Nome da base principal (`vtx_core`) |
| `JWT_SECRET` | ✅ | Chave secreta de alta entropia para assinatura de tokens JWT |
| `JWT_ISSUER` | ❌ | Emissor do token JWT (padrão: `project-vtx`) |
| `PORT` | ❌ | Porta HTTP do Core (padrão: `4000`) |
| `CORS_ALLOWED_ORIGINS`| ❌ | Whitelist de origens autorizadas separadas por vírgula (ex: `https://vtx.com.br`) |
| `AUTH_RATE_LIMIT_WINDOW_MINUTES` | ❌ | Janela de tempo do rate limiting de login em minutos (padrão: `15`) |
| `AUTH_RATE_LIMIT_MAX` | ❌ | Máximo de tentativas falhas de login antes do bloqueio HTTP 429 (padrão: `5`) |

---

## 📜 Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor em modo de desenvolvimento (`ts-node-dev`) |
| `npm run build` | Compila o projeto TypeScript para código de produção em `dist/` (`tsc`) |
| `npm start` | Executa os binários JavaScript compilados em `dist/index.js` |
| `npm test` | Executa a suíte de testes com Vitest em modo watch |
| `npm test -- --run` | Executa todos os 53 testes automatizados de forma unificada |

---

## 🔒 Autenticação, Permissões e Segurança

A API foi auditada e blindada através de um programa formal de segurança (Sprints 1 a 4):
* **Rate Limiting Restrito:** Bloqueio por IP real do cliente via `app.set('trust proxy', 1)` em `POST /auth/login` (HTTP 429 após 5 tentativas falhas consecutivas).
* **Controle de Acesso Baseado em Papéis (RBAC):** Hierarquia estrita (`SUPER_ADMIN` > `ADMIN` > `OPERATOR`).
* **Proteção de Dados PII (LGPD):** Serializador dinâmico suprime CPF/CNPJ, documentos de proprietários e dados de endereço completo para a role `OPERATOR`.
* **Revogação de Tokens & Logout Server-Side:** Endpoint `POST /auth/logout` com blacklist de tokens em memória gerenciada por TTL; tokens revogados são imediatamente bloqueados pelo middleware (HTTP 401).
* **Cabeçalhos de Segurança (Helmet):** HSTS, NoSniff, FrameGuard e supressão de `X-Powered-By`.
* **CORS Restrito:** Rejeição explícita (HTTP 403 Forbidden) para origens não cadastradas na whitelist.

---

## 🧪 Testes Automatizados e Homologação

A suíte de testes utiliza **Vitest** com mocks isolados do Prisma singleton para garantir execução determinística e rápida:

```bash
npm test -- --run
```

```text
 Test Files  9 passed (9)
      Tests  53 passed (53)
   Duration  ~5.0s
```

Suítes validadas na regressão contínua:
* `test/helmet.test.ts` (Cabeçalhos HTTP de segurança)
* `test/cors.test.ts` (Whitelist dinâmica e bloqueio 403)
* `test/auth.limiter.test.ts` (Rate limiting e proteção contra força bruta)
* `test/auth.logout.test.ts` (Revogação de JWT e blacklist de tokens)
* `test/client.pii.test.ts` (Sanitização de dados cadastrais e LGPD)
* `test/client.test.ts` (CRUD de tenants e integridade de planos)
* `test/subscription.schema.test.ts` (Zod `.strict()` em assinaturas)
* `test/plan.schema.test.ts` (Zod `.strict()` em planos)
* `test/error-handling.test.ts` (Tratamento seguro de erros 500 sem vazamento)

---

## 🤝 Diretrizes de Colaboração e Governança

Para manter a consistência e o alto nível técnico do projeto, todo desenvolvedor ou contribuidor deve seguir as seguintes diretrizes:

1. **Governança de Sprints e Tasks:**
   * O projeto opera sob a metodologia de governança orientada pelo Product Owner (PO);
   * Nenhuma task deve ser considerada concluída sem a execução dos testes automatizados e aprovação formal do relatório de alterações em `test/docs/`.
2. **Padrão de Branching:**
   * Crie branches a partir da `master` seguindo o padrão: `feat/nome-da-funcionalidade` ou `fix/nome-da-correcao`.
3. **Validação Estrita de Entrada (Zod):**
   * Todo endpoint que recebe payload no `req.body` ou parâmetros no `req.params` **deve obrigatoriamente** implementar validação via schema Zod com `.strict()`, rejeitando Mass Assignment com HTTP 400.
   * Não utilize interfaces TypeScript soltas para dados externos; prefira tipos inferidos (`z.infer<typeof schema>`).
4. **Camadas Arquiteturais Claras:**
   * Mantenha o desacoplamento estrito: `Routes` ➔ `Controller` ➔ `Service` ➔ `Repository`.
   * Controllers não executam queries no banco; repositories não manipulam objetos `req` ou `res`.
5. **Critérios de Pull Request:**
   * Antes de submeter código, execute localmente:
     ```bash
     npm run build          # Compilação TypeScript limpa (código 0)
     npm test -- --run      # 100% dos testes verdes sem filtros
     ```

---

<div align="center">

Feito com 🛠️, TypeScript e rigor de engenharia de software.

</div>
