<div align="center">

# 🏢 VTX Core

**API de gestão multi-tenant de clientes, planos e assinaturas**

![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Vitest](https://img.shields.io/badge/tested%20with-vitest-6E9F18?logo=vitest&logoColor=white)
![License](https://img.shields.io/badge/license-ISC-blue)

</div>

---

## 📖 Sobre o projeto

O **VTX Core** é o backend responsável por gerenciar o ciclo de vida de **clientes (tenants)**, seus **planos de assinatura** e o **provisionamento automático de banco de dados isolado por cliente**.

Cada cliente cadastrado recebe seu próprio banco PostgreSQL dedicado (`vtx_<slug>`), criado automaticamente pela API no momento do cadastro — a base arquitetural para uma futura evolução multi-tenant com isolamento total de dados.

---

## 📑 Sumário

- [Stack e principais dependências](#-stack-e-principais-dependências)
- [Arquitetura](#-arquitetura)
- [Estrutura de pastas](#-estrutura-de-pastas)
- [Modelo de dados](#-modelo-de-dados)
- [Como rodar o projeto](#-como-rodar-o-projeto)
- [Variáveis de ambiente](#-variáveis-de-ambiente)
- [Scripts disponíveis](#-scripts-disponíveis)
- [Referência da API](#-referência-da-api)
- [Autenticação e permissões](#-autenticação-e-permissões)
- [Testes](#-testes)
- [Roadmap e débito técnico](#-roadmap-e-débito-técnico)
- [Como contribuir](#-como-contribuir)

---

## 🧰 Stack e principais dependências

| Camada | Tecnologia |
| --- | --- |
| Runtime | Node.js 20 |
| Linguagem | TypeScript |
| Framework HTTP | Express 5 |
| ORM | Prisma 7 (`@prisma/client`, `@prisma/adapter-pg`) |
| Banco de dados | PostgreSQL 16 |
| Autenticação | JWT (`jsonwebtoken`) + `bcryptjs` |
| Validação de entrada | Zod (e Yup, em uso pontual) |
| Testes | Vitest |
| Containerização | Docker / Docker Compose |

---

## 🏗️ Arquitetura

O projeto segue uma organização **modular por domínio** (`auth`, `client`, `plan`, `subscription`), cada módulo com suas próprias camadas de **controller → service → repository**, e um núcleo `shared/` com autenticação, validação e acesso a banco reutilizáveis entre módulos.

```mermaid
flowchart LR
    A[Cliente HTTP] --> B["/auth/login"]
    A --> C[Middleware de Auth<br/>JWT]
    C --> D[Middleware de Role<br/>SUPER_ADMIN / ADMIN / OPERATOR]
    D --> E[Controller]
    E --> F[Service]
    F --> G[Repository]
    G --> H[(Prisma)]
    H --> I[(PostgreSQL)]
    F -.provisiona.-> J[("Banco dedicado<br/>vtx_&lt;slug&gt;")]
```

**Fluxo de criação de cliente:** ao criar um `Client`, o `client.service` abre uma transação Prisma para validar o plano e persistir o cliente + assinatura inicial e, em seguida, aciona o `database-manager` para provisionar um banco PostgreSQL isolado (`vtx_<slug>`) para aquele tenant.

---

## 📂 Estrutura de pastas

```
src/
├── app.ts                     # Configuração do Express (middlewares globais, rotas)
├── index.ts                   # Entry point — sobe o servidor HTTP
├── routes/
│   └── index.ts                # Composição das rotas de cada módulo
├── modules/
│   ├── auth/                   # Login e emissão de token
│   ├── client/                 # CRUD e ciclo de vida de clientes (tenants)
│   ├── plan/                   # CRUD de planos de assinatura
│   └── subscription/           # CRUD e ciclo de vida de assinaturas
└── shared/
    ├── auth/                   # jwt.ts, auth.middleware.ts, role.middleware.ts
    ├── database/                # Prisma client + provisionamento de bancos por tenant
    ├── validation/              # Schemas Zod compartilhados
    └── utils/                   # Coleção Insomnia com exemplos de requisições

prisma/
├── schema.prisma               # Modelos: Client, Plan, Subscription, User
└── migrations/                  # Histórico de migrations
```

Cada módulo de domínio segue o mesmo padrão interno:

```
modules/<dominio>/
├── <dominio>.routes.ts       # Definição das rotas + middlewares de autorização
├── <dominio>.controller.ts   # Camada HTTP (request/response)
├── <dominio>.service.ts      # Regras de negócio
├── <dominio>.repository.ts   # Acesso a dados via Prisma
├── <dominio>.schema.ts       # Validação de entrada (Zod), quando aplicável
└── <dominio>.interface.ts    # Tipos TypeScript do domínio
```

---

## 🗃️ Modelo de dados

| Entidade | Descrição |
| --- | --- |
| **Client** | Representa o tenant/cliente: razão social, documentos, endereço, `slug` único e vínculo com um `Plan` |
| **Plan** | Plano de assinatura: nome, preço, limite de documentos (`maxDocs`) e status |
| **Subscription** | Assinatura vigente de um `Client`, vinculada 1:1, com valor e status |
| **User** | Usuário interno da plataforma (`SUPER_ADMIN`, `ADMIN` ou `OPERATOR`) que autentica via `/auth/login` |

---

## 🚀 Como rodar o projeto

### Pré-requisitos

- Node.js 20+
- Docker e Docker Compose (recomendado) **ou** uma instância PostgreSQL local

### Opção 1 — Com Docker Compose (recomendado)

```bash
git clone https://github.com/MateusBrito-hub/project-vtx.git
cd project-vtx
docker compose up --build
```

Isso sobe o Postgres e a API já conectados entre si. A API fica disponível em `http://localhost:4000`.

### Opção 2 — Ambiente local

```bash
git clone https://github.com/MateusBrito-hub/project-vtx.git
cd project-vtx
npm install --legacy-peer-deps

cp .env.example .env   # configure suas variáveis (ver seção abaixo)

npx prisma generate
npx prisma migrate dev

npm run dev
```

A API sobe por padrão na porta `4000` (`GET /health` para verificar se está no ar).

---

## 🔑 Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | String de conexão do PostgreSQL principal (ex.: `postgresql://user:pass@host:5432/vtx`) |
| `JWT_SECRET` | ✅ | Segredo usado para assinar e validar os tokens JWT |
| `JWT_ISSUER` | ❌ | Issuer incluído/validado no token (padrão: `project-vtx`) |
| `PORT` | ❌ | Porta HTTP da API (padrão: `4000`) |

> ⚠️ Nunca versione o arquivo `.env`. Use um cofre de segredos (Vault, AWS Secrets Manager, etc.) em produção.

---

## 📜 Scripts disponíveis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Sobe a API em modo desenvolvimento (`ts-node-dev`, com hot-reload) |
| `npm run build` | Compila o TypeScript para `dist/` |
| `npm start` | Executa a versão compilada (`dist/index.js`) |
| `npm test` | Executa a suíte de testes com Vitest |

---

## 🌐 Referência da API

Todas as rotas abaixo (exceto `/auth/login` e `/health`) exigem o header `Authorization: Bearer <token>`.

### Auth

| Método | Rota | Acesso |
|---|---|---|
| `POST` | `/auth/login` | Público |

### Clients

| Método | Rota | Roles permitidas |
| --- | --- | --- |
| `POST` | `/clients` | `SUPER_ADMIN` |
| `GET` | `/clients` | `SUPER_ADMIN`, `ADMIN`, `OPERATOR` |
| `GET` | `/clients/:id` | `SUPER_ADMIN`, `ADMIN`, `OPERATOR` |
| `PATCH` | `/clients/:id/update` | `SUPER_ADMIN`, `ADMIN` |
| `PATCH` | `/clients/:id/suspend` | `SUPER_ADMIN`, `ADMIN` |
| `PATCH` | `/clients/:id/cancel` | `SUPER_ADMIN`, `ADMIN` |
| `PATCH` | `/clients/:id/active` | `SUPER_ADMIN`, `ADMIN` |
| `GET` | `/clients/:slug/status` | `SUPER_ADMIN`, `ADMIN`, `OPERATOR` |

### Plans

| Método | Rota | Roles permitidas |
| --- | --- | --- |
| `POST` | `/plans` | `SUPER_ADMIN` |
| `GET` | `/plans` | `SUPER_ADMIN`, `ADMIN`, `OPERATOR` |
| `GET` | `/plans/:id` | `SUPER_ADMIN`, `ADMIN`, `OPERATOR` |
| `PATCH` | `/plans/:id` | `SUPER_ADMIN`, `ADMIN` |
| `PATCH` | `/plans/:id/suspend` | `SUPER_ADMIN` |
| `PATCH` | `/plans/:id/activate` | `SUPER_ADMIN` |

### Subscriptions

| Método | Rota | Roles permitidas |
| --- | --- | --- |
| `POST` | `/subscriptions` | `SUPER_ADMIN` |
| `GET` | `/subscriptions` | `SUPER_ADMIN`, `ADMIN`, `OPERATOR` |
| `GET` | `/subscriptions/:id` | `SUPER_ADMIN`, `ADMIN`, `OPERATOR` |
| `GET` | `/subscriptions/client/:clientId` | `SUPER_ADMIN`, `ADMIN`, `OPERATOR` |
| `PATCH` | `/subscriptions/:id` | `SUPER_ADMIN`, `ADMIN` |
| `PATCH` | `/subscriptions/:id/suspend` | `SUPER_ADMIN` |
| `PATCH` | `/subscriptions/:id/activate` | `SUPER_ADMIN` |

### Health check

| Método | Rota | Acesso |
|---|---|---|
| `GET` | `/health` | Público |

> 💡 Uma coleção pronta para o **Insomnia** com exemplos de payload está em `src/shared/utils/Endpoints.yaml`.

---

## 🔐 Autenticação e permissões

- Login em `POST /auth/login` (email + senha) retorna um **access token JWT** válido por 15 minutos, assinado com `HS256`.
- O token carrega `sub` (id do usuário) e `role`.
- Toda rota fora de `/auth` passa pelo `authMiddleware` (valida o token) e, em seguida, pelo `requireRole(...)` (valida a permissão específica do endpoint).
- Hierarquia de papéis: `SUPER_ADMIN` > `ADMIN` > `OPERATOR`.

---

## 🧪 Testes

```bash
npm test
```

Os testes usam **Vitest** com mocks do Prisma Client (via `vi.hoisted`) para isolar a camada de serviço do banco de dados real.

> **Nota para contribuidores:** a suíte em `test/client.test.ts` ainda referencia caminhos de uma estrutura anterior à modularização atual (`src/service/client`, por exemplo) e precisa ser atualizada para importar de `src/modules/client/*`. Ver item correspondente no plano de correções técnicas do projeto antes de confiar no resultado de `npm test`.

---

## 🗺️ Roadmap e débito técnico

Este repositório passou por uma análise de segurança formal, cujos achados e o plano de correção (dividido em sprints) orientam as próximas contribuições prioritárias:

- Rate limiting no login, restrição de CORS e rotação de credenciais de banco.
- Validação estrita (Zod) no endpoint de atualização de assinatura.
- Padronização do tratamento de erros expostos pela API.
- Hardening da imagem Docker de produção (multi-stage, usuário non-root).
- Correção e ampliação da cobertura de testes automatizados.

Consulte o relatório de segurança e o plano de sprints do projeto para o detalhamento completo antes de abrir uma PR relacionada a esses pontos.

---

## 🤝 Como contribuir

1. Crie uma branch a partir de `development`: `git checkout -b feat/minha-contribuicao`
2. Siga o padrão modular já existente (`routes → controller → service → repository`) ao adicionar funcionalidades.
3. Sempre que adicionar um endpoint que recebe body, valide a entrada com um schema Zod `.strict()`, seguindo o padrão de `client.schema.ts`.
4. Rode `npm test` e `npx tsc --noEmit` antes de abrir a PR.
5. Descreva na PR o que foi alterado e, se aplicável, referencie o item do roadmap/plano de sprints correspondente.

---

<div align="center">

Feito com 🛠️ e TypeScript.

</div>
