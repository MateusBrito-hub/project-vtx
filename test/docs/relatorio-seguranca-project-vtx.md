# Relatório de Análise de Segurança — project-vtx

| | |
|---|---|
| **Repositório** | MateusBrito-hub/project-vtx |
| **Branch analisada** | `development` |
| **Stack** | Node.js + Express 5 + TypeScript + Prisma (multi-tenant) + PostgreSQL |
| **Data** | 26/08/2026 |
| **Metodologia** | Revisão estática de código-fonte, análise de configuração de infraestrutura (Docker/Compose), `npm audit` e execução da suíte de testes existente |

---

## Sumário executivo

| Prioridade | Qtde | Itens |
|---|---|---|
| 🔴 Crítico | 3 | Credenciais DB fracas/expostas, sem rate limit no login, CORS aberto |
| 🟠 Alto | 3 | Mass assignment em subscriptions, vazamento de `error.message`, Dockerfile inseguro |
| 🟡 Médio | 3 | Testes quebrados, sem revogação de token, PII exposta a role baixa |
| 🟢 Baixo | 3 | Dependência `crypto` órfã, sem helmet, `npm audit` limpo |

---

## 🔴 Crítico

### 1. Credenciais fracas e hardcoded do PostgreSQL + porta exposta
**Arquivo:** `docker-compose.yml` (linhas 6-11)

```yaml
POSTGRES_USER: postgres
POSTGRES_PASSWORD: postgres
...
ports:
  - "5432:5432"
```

Usuário/senha padrão (`postgres`/`postgres`) e a porta do banco publicada diretamente no host. Se essa stack for implantada em qualquer servidor com IP acessível externamente (sem firewall adicional), o banco fica exposto à internet com credenciais triviais de adivinhar.

**Recomendação:** senha forte via variável de ambiente/secret manager; remover o mapeamento `ports` do serviço Postgres em produção (deixar acessível apenas na rede interna do Docker); restringir por firewall/security group quando a exposição for necessária.

### 2. Ausência de rate limiting no login
**Arquivos:** `src/modules/auth/auth.routes.ts`, `auth.controller.ts`

Não há nenhum middleware de limitação de tentativas no `POST /auth/login`. O projeto não possui `express-rate-limit` nem equivalente entre as dependências.

**Recomendação:** aplicar rate limiting por IP/e-mail (ex.: `express-rate-limit` com backoff progressivo) e considerar bloqueio temporário de conta após N tentativas falhas.

### 3. CORS totalmente aberto
**Arquivo:** `src/app.ts:7`

```ts
app.use(cors())
```

Sem `origin` configurado, a lib `cors` reflete qualquer origem que fizer a requisição. Como a API lida com dados de clientes (CNPJ, endereço) e tokens JWT, isso amplia a superfície para ataques cross-origin caso o token seja manuseado de forma insegura no frontend.

**Recomendação:** whitelist explícita de origens permitidas (`origin: [...]`); usar `credentials: true` somente se estritamente necessário.

---

## 🟠 Alto

### 4. Mass assignment em `PATCH /subscriptions/:id`
**Arquivos:** `subscription.controller.ts:130-139` → `subscription.service.ts` → `subscription.repository.ts:27-32`

```ts
async updateById(id: number, data: Partial<ISubscription>) {
    return await prisma.subscription.update({ where: { id }, data })
}
```

O `body` da requisição é repassado **sem validação em runtime** diretamente ao Prisma — a interface `ISubscription` é apenas um tipo TypeScript, que não protege nada em tempo de execução. Um usuário com role `ADMIN` pode enviar qualquer campo (`clientId`, `status`, `startDate` etc.) e alterá-lo livremente, contornando as regras de negócio já existentes no módulo `client` (que bloqueia explicitamente a alteração do campo `database`). É inconsistente com o restante do projeto, que usa Zod em `client.schema.ts`.

**Recomendação:** criar um schema Zod restrito (ex.: apenas `amount`) para esse endpoint, seguindo o padrão já usado em `client.schema.ts`.

### 5. Vazamento de mensagens de erro internas ao cliente
**Padrão repetido em:** `client.controller.ts`, `plan.controller.ts`, `subscription.controller.ts`

```ts
return res.status(500).json({ error: error.message || 'Erro interno' })
```

Erros crus do Prisma/banco (nomes de coluna, constraints, detalhes de schema) podem vazar para o cliente da API, facilitando reconhecimento da estrutura interna do sistema.

**Recomendação:** logar o erro completo internamente (`console.error` ou logger estruturado) e retornar sempre uma mensagem genérica ao cliente em respostas 5xx.

### 6. Dockerfile de produção com práticas inseguras
**Arquivo:** `Dockerfile`

```dockerfile
RUN apk add --no-cache bash git openssh
...
CMD ["sh", "-c", "npx prisma migrate dev --name init && npm run dev"]
```

- Container roda como **root** (sem diretiva `USER`).
- Instala `git`/`openssh`/`bash` desnecessariamente, ampliando a superfície de ataque da imagem final.
- Não há build multi-stage — `devDependencies` e ferramentas de build permanecem na imagem final.
- `prisma migrate dev` é um comando **de desenvolvimento** (interativo/não determinístico); em produção deve-se usar `prisma migrate deploy`.
- O `CMD` roda `npm run dev` (servidor com hot-reload via `ts-node-dev`, stack traces mais verbosos) como entrypoint, em vez de um build compilado.

**Recomendação:** multi-stage build; usuário não-root; `prisma migrate deploy`; `CMD ["node", "dist/index.js"]` em produção.

---

## 🟡 Médio

### 7. Suíte de testes quebrada (não executa)
**Arquivo:** `test/client.test.ts`

Os imports apontam para caminhos que não existem mais na branch atual (`../src/service/client`, `../src/shared/interface/client`, `../src/utils/databse-manager`), enquanto o código real está em `src/modules/client/*` e `src/shared/database/database-manager`. Ao rodar `npx vitest run`, a suíte falha por completo:

```
FAIL test/client.test.ts
Error: Cannot find module '/src/service/client'
```

Isso significa que a refatoração para a estrutura modular atual não atualizou os testes — inclusive o teste que valida a regra de segurança "não é permitido alterar o campo `database` do client" **não está mais rodando**, dando falsa sensação de cobertura.

**Recomendação:** atualizar os imports do teste para `src/modules/client/...`; adicionar testes equivalentes para `plan` e `subscription` (especialmente cobrindo o mass assignment do item 4).

### 8. Sem revogação de token / logout server-side
**Arquivo:** `src/shared/auth/jwt.ts`

Gera apenas access token de 15 min, sem refresh token nem blacklist/allowlist. Não existe endpoint de logout que invalide um token antes da expiração. Para uma API administrativa multi-tenant, isso limita a resposta a um vazamento de token — é preciso esperar a expiração natural.

**Recomendação:** considerar uma lista de revogação (Redis) ou refresh tokens rotativos com possibilidade de invalidação.

### 9. Exposição de PII sensível para role `OPERATOR`
**Arquivo:** `client.routes.ts`

`GET /clients` e `GET /clients/:id` (liberados para `OPERATOR`) retornam o objeto completo do client, incluindo `CPF_CNPJ`, `ownerDocument` e endereço completo.

**Recomendação:** avaliar se esse nível de acesso é realmente necessário para a role mais baixa, ou introduzir um DTO reduzido específico para `OPERATOR`.

---

## 🟢 Baixo / Informativo

### 10. Dependência `crypto` órfã (pacote npm deprecado)
`package.json` lista `"crypto": "^1.0.1"` como dependência direta, mas não há nenhum `import`/`require('crypto')` externo no código — o Node já possui o módulo nativo `crypto`, que sempre tem precedência sobre pacotes de `node_modules` com o mesmo nome. O próprio registro do npm alerta que o pacote está "abandonado" e é mantido pela equipe do npm apenas para evitar uso malicioso do nome. Risco prático baixo, mas deve ser removido do `package.json`.

### 11. Ausência de cabeçalhos de segurança HTTP
Não há `helmet` (ou equivalente) configurado — faltam headers como `X-Content-Type-Options`, `Strict-Transport-Security` etc.

### 12. `npm audit` — nenhuma vulnerabilidade conhecida
`npm audit` sobre o `package-lock.json` atual não reportou vulnerabilidades nas 129 dependências de produção. Ponto positivo — recomenda-se monitoramento contínuo (ex.: Dependabot/Renovate).

---

## ✅ Pontos positivos identificados

- Uso consistente de **Zod com `.strict()`** para validação de entrada no módulo `client` (bloqueia campos extras / mass assignment).
- Implementação de JWT correta: algoritmo fixado (`HS256`), `issuer` validado, exige `JWT_SECRET` configurado (falha explícita se ausente).
- Senhas com **bcryptjs**; a mensagem de erro de login **não diferencia** "e-mail inexistente" de "senha incorreta" — boa prática contra enumeração de usuários.
- **Nenhuma query SQL bruta** (`$queryRaw`/`$executeRaw`) encontrada em todo o código.
- A criação dinâmica de banco por tenant (`createClientDatabase`) sanitiza rigorosamente o nome antes de usá-lo em `CREATE DATABASE ${dbName}`, prevenindo injeção via identificador SQL.
- Controle de acesso por papel (`requireRole`) aplicado de forma consistente nas rotas de `clients` e `plans`.
- `.env` corretamente listado no `.gitignore`; nenhum segredo hardcoded encontrado no código-fonte ou nas migrations.

---

## Plano de correção priorizado

| # | Item | Prioridade | Esforço estimado | Responsável sugerido |
|---|---|---|---|---|
| 1 | Rotacionar credenciais do Postgres e remover exposição de porta em produção | Crítico | Baixo | DevOps/Infra |
| 2 | Adicionar rate limiting no `/auth/login` | Crítico | Baixo | Backend |
| 3 | Restringir CORS a origens conhecidas | Crítico | Baixo | Backend |
| 4 | Criar schema Zod para `PATCH /subscriptions/:id` | Alto | Baixo | Backend |
| 5 | Padronizar tratamento de erros (nunca expor `error.message` bruto) | Alto | Médio | Backend |
| 6 | Reescrever Dockerfile (multi-stage, non-root, `migrate deploy`) | Alto | Médio | DevOps/Infra |
| 7 | Corrigir imports da suíte de testes e ampliar cobertura para `plan`/`subscription` | Médio | Médio | Backend/QA |
| 8 | Avaliar estratégia de revogação de token (refresh token / blacklist) | Médio | Alto | Backend |
| 9 | Revisar payload retornado para role `OPERATOR` | Médio | Baixo | Backend |
| 10 | Remover dependência `crypto` não utilizada | Baixo | Trivial | Backend |
| 11 | Adicionar `helmet` | Baixo | Trivial | Backend |

---

*Relatório gerado a partir de análise estática do código-fonte na branch `development`. Recomenda-se complementar com testes dinâmicos (DAST) e revisão de configuração do ambiente de produção real, que pode diferir do `docker-compose.yml` do repositório.*
