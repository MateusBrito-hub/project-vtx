# Plano de Execução — Sprint 2 de Segurança do `project-vtx`

## 1. Objetivo do Sprint

| Metadado | Detalhe |
|---|---|
| **Sprint** | 2 — Blindagem de Validação e Infraestrutura |
| **Projeto** | `MateusBrito-hub/project-vtx` |
| **Branch base** | `master` |
| **Perfil de execução** | Desenvolvedor independente |
| **Duração de referência** | 1 semana (ajustável conforme capacidade do time) |
| **Itens de Origem** | Itens 4, 5 e 6 do Relatório de Análise de Segurança |

### Objetivo do PO

Eliminar as três vulnerabilidades de severidade **Alta (🟠 Alto)** identificadas na auditoria original, focando em integridade de dados na camada de aplicação, proteção contra vazamento de informações de infraestrutura e endurecimento (hardening) dos containers de produção:

1. **Mass Assignment em Subscriptions:** Proteger o endpoint `PATCH /subscriptions/:id` com schema Zod restrito em runtime, impedindo alterações não autorizadas em campos críticos (`clientId`, `status`, `startDate`).
2. **Vazamento de Mensagens de Erro Internas:** Padronizar o tratamento de erros em todos os controllers (`client`, `plan`, `subscription`), garantindo que erros 5xx nunca exponham detalhes de schema, banco de dados ou constraints ao cliente.
3. **Dockerfile de Produção Seguro:** Reescrever o `Dockerfile` com build multi-stage, usuário não-root (`USER node`), exclusão de ferramentas desnecessárias (`git`, `openssh`), remoção de `devDependencies` na imagem final e execução via código compilado com `prisma migrate deploy`.

---

## 2. Forma de Trabalho

Assim como na Sprint 1, a execução segue o modelo de **delegação de PO para um desenvolvedor**:

Cada task possui:
- Objetivo
- Contexto da vulnerabilidade
- Escopo detalhado
- O que NÃO alterar
- Critérios de aceite objetivos
- Comandos de validação
- Entrega obrigatória de Relatório de Alterações

### Regra Principal do Sprint

> ⚠️ **Uma task só deve ser considerada concluída quando o código estiver alterado, as validações forem executadas e o relatório da task for entregue.**
> 
> Não execute todas as tasks simultaneamente. Siga a ordem sequencial: implemente uma task, valide, gere o relatório, obtenha a revisão do PO e prossiga para a seguinte.

---

## 3. Ordem de Execução

| Ordem | Task | Item Original | Prioridade | Esforço | Dependências |
|:---:|---|:---:|:---:|:---:|:---:|
| **1** | **TASK 01 (Sprint 2)** — Schema Zod e Proteção contra Mass Assignment em Subscriptions | Item 4 | 🟠 Alto | Baixo | Nenhuma |
| **2** | **TASK 02 (Sprint 2)** — Padronização de Erros 500 e Eliminação de Vazamentos | Item 5 | 🟠 Alto | Médio | Nenhuma |
| **3** | **TASK 03 (Sprint 2)** — Blindagem do Dockerfile de Produção (Multi-stage / Non-root) | Item 6 | 🟠 Alto | Médio | Nenhuma |
| **4** | **TASK 04 (Sprint 2)** — Validação Integrada e Fechamento da Sprint 2 | — | 🟠 Alto | Baixo | Tasks 01, 02 e 03 |

---

# TASK 01 (Sprint 2) — Schema Zod e Proteção contra Mass Assignment em Subscriptions

## Prioridade
🟠 **Alta**

## Objetivo
Impedir que usuários autenticados realizem **Mass Assignment** (atribuição em massa) no endpoint:
```http
PATCH /subscriptions/:id
```
garantindo que apenas campos explicitamente permitidos pela regra de negócio possam ser atualizados.

## Contexto
O relatório de segurança identificou que em `src/modules/subscription/subscription.controller.ts` (linhas 130–140) o `req.body` é repassado sem validação em runtime diretamente ao Prisma via `updateSubscription(id, body)`:

```typescript
const body = req.body
// ...
const updatedSubscription = await updateSubscription(id, body)
```

A interface TypeScript `ISubscription` protege apenas em tempo de compilação. Em runtime, um usuário pode enviar campos como `clientId` (trocando o dono da assinatura), `status` (contornando o fluxo de suspensão/cancelamento) ou `startDate` (manipulando vigência). O restante do projeto já utiliza Zod com `.strict()` no módulo `client` (`client.schema.ts`), tornando essa rota inconsistente e insegura.

## Escopo
1. Criar o arquivo `src/modules/subscription/subscription.schema.ts`.
2. Definir o schema `updateSubscriptionSchema` com Zod utilizando `.strict()`.
3. Permitir no schema exclusivamente os campos que a regra de negócio autoriza atualização via PATCH (ex.: `amount: z.number().positive().optional()`).
4. Rejeitar qualquer campo extra com HTTP 400 Bad Request e mensagem clara de validação.
5. Aplicar a validação no handler `updateSubscription` em `src/modules/subscription/subscription.controller.ts` (ou via middleware de validação).
6. Criar testes automatizados em `test/subscription.schema.test.ts` cobrindo:
   - Atualização válida com campo permitido (`amount`).
   - Rejeição (HTTP 400) ao tentar alterar `clientId`.
   - Rejeição (HTTP 400) ao tentar alterar `status`.
   - Rejeição (HTTP 400) ao enviar campos inexistentes.

## Não Alterar
- Não modificar os endpoints de suspensão (`PATCH /subscriptions/:id/suspend`) ou cancelamento.
- Não alterar as migrations ou o modelo Prisma `Subscription`.
- Não alterar os métodos do repositório `subscription.repository.ts`.

## Critérios de Aceite
- [ ] Existe `src/modules/subscription/subscription.schema.ts` com schema Zod configurado com `.strict()`.
- [ ] O endpoint `PATCH /subscriptions/:id` valida o corpo da requisição em runtime contra o schema.
- [ ] Envio de `amount` válido é aceito e atualizado com sucesso (HTTP 200).
- [ ] Envio de `clientId`, `status`, `startDate` ou qualquer campo não mapeado é rejeitado com HTTP 400.
- [ ] Envio de body vazio ou tipos incorretos (ex.: `amount` string) é tratado adequadamente com HTTP 400.
- [ ] Suíte de testes automatizados criada e passando no Vitest.
- [ ] Build (`npm run build`) executando sem erros de tipagem.

## Validações Obrigatórias
```bash
npm run build
npx vitest run test/subscription.schema.test.ts
```
Teste manual via cURL/Postman enviando payload com campo não autorizado:
```json
{
  "amount": 150.00,
  "clientId": 999
}
```
*Resultado esperado:* HTTP 400 Bad Request.

## Entrega
Entregar o **Relatório de Alterações da TASK 01 (Sprint 2)** em `test/docs/relatorio-alteracoes-task-01-sprint-2.md`.

---

# TASK 02 (Sprint 2) — Padronização de Erros 500 e Eliminação de Vazamento de Mensagens Internas

## Prioridade
🟠 **Alta**

## Objetivo
Garantir que a API nunca devolva detalhes técnicos internos do banco de dados, nomes de colunas, constraints ou stack traces em respostas de erro com status `500 Internal Server Error`.

## Contexto
O relatório identificou o seguinte padrão repetido nos controllers da aplicação:
```typescript
} catch (error: any) {
    console.error(error)
    return res.status(500).json({
        error: error.message || 'Erro interno'
    })
}
```
Arquivos afetados:
- `src/modules/client/client.controller.ts` (linhas 36, 137, etc.)
- `src/modules/plan/plan.controller.ts` (linhas 36, 50, 119, 148, 177)
- `src/modules/subscription/subscription.controller.ts` (linhas 34, 147, etc.)

Quando o banco de dados falha (ex.: violação de constraint, queda de conexão, erro de sintaxe SQL), o objeto `error.message` contém dados crus da estrutura interna, facilitando o reconhecimento do sistema por atacantes.

## Escopo
1. Revisar todos os blocos `catch` de `client.controller.ts`, `plan.controller.ts` e `subscription.controller.ts`.
2. Em respostas 500, logar o erro detalhado no console do servidor (`console.error`), mas retornar ao cliente estritamente uma mensagem genérica e padronizada:
   ```json
   { "error": "Erro interno do servidor" }
   ```
3. Preservar mensagens de erro descritivas apenas para respostas de validação do cliente (HTTP 400, 401, 403, 404).
4. Opcional recomendado: Criar uma função utilitária centralizada (ex.: `handleInternalError(res, error)`) em `src/shared/errors/` para evitar duplicação de lógica entre controllers.
5. Criar testes automatizados ou verificar regressão garantindo que respostas 500 não exponham propriedades do erro original.

## Não Alterar
- Não alterar as regras de negócio dos serviços (`*.service.ts`).
- Não mascarar erros 400 de validação do Zod (o cliente precisa saber qual campo errou).
- Não alterar os status codes HTTP de retorno de cada fluxo.

## Critérios de Aceite
- [ ] Nenhum endpoint retorna `error.message` cru em respostas com status HTTP 500.
- [ ] Todas as respostas 500 retornam mensagem genérica padronizada (`"Erro interno do servidor"` ou equivalente corporativo).
- [ ] O erro real continua sendo registrado no log interno do servidor para depuração.
- [ ] Erros de validação (400, 404) continuam fornecendo feedbacks claros aos consumidores da API.
- [ ] Build (`npm run build`) compilando sem erros.
- [ ] Testes existentes continuam passando sem quebras.

## Validações Obrigatórias
```bash
npm run build
npx vitest run
```
Simulação de erro forçado (ou teste automatizado) atestando que a resposta HTTP 500 não vaza o texto da exceção.

## Entrega
Entregar o **Relatório de Alterações da TASK 02 (Sprint 2)** em `test/docs/relatorio-alteracoes-task-02-sprint-2.md`.

---

# TASK 03 (Sprint 2) — Blindagem do Dockerfile de Produção (Multi-Stage e Non-Root)

## Prioridade
🟠 **Alta**

## Objetivo
Transformar o [Dockerfile](file:///c:/_Brito/project-vtx/Dockerfile) da aplicação em uma imagem segura para ambientes de produção, aplicando o princípio do menor privilégio, reduzindo a superfície de ataque e otimizando o tamanho final da imagem.

## Contexto
O `Dockerfile` atual apresenta práticas não recomendadas para produção:
```dockerfile
FROM node:20-alpine
WORKDIR /usr/src/app
RUN apk add --no-cache bash git openssh
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps
COPY . .
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
RUN npx prisma generate
EXPOSE 4000
CMD ["npm", "run", "dev"]
```
Problemas identificados:
- O container roda como **root** (risco de container escape / privilégios excessivos).
- Instala utilitários desnecessários (`git`, `openssh`, `bash`) que ampliam a superfície de ataque.
- Não utiliza build multi-stage: dependências de desenvolvimento (`devDependencies`) e ferramentas de compilação permanecem na imagem final.
- Utiliza `npm run dev` (`ts-node-dev` com hot-reload) como entrypoint em vez do código JavaScript compilado (`node dist/index.js`).

## Escopo
1. Reescrever o `Dockerfile` com padrão **Multi-Stage Build**:
   - **Estágio 1 — `builder`:**
     - Base `node:20-alpine`.
     - Instala todas as dependências (`npm ci`).
     - Copia código-fonte e schema do Prisma.
     - Executa `npx prisma generate` e compila o projeto com `npm run build`.
   - **Estágio 2 — `runner` (imagem final de produção):**
     - Base limpa `node:20-alpine` (sem git/openssh/bash adicionais).
     - Instala apenas dependências de produção (`npm ci --omit=dev` ou cópia seletiva).
     - Copia apenas os artefatos compilados (`dist/`) e o cliente Prisma gerado.
     - Define o usuário não-root nativo do Alpine: `USER node`.
     - Expõe a porta 4000.
     - Entrypoint/CMD seguro: executa as migrações com segurança (`npx prisma migrate deploy`) e inicia a aplicação compilada (`node dist/index.js` ou `npm run start`).
2. Revisar o arquivo `.dockerignore` para garantir que `.env`, `node_modules`, `dist`, `.git` e relatórios não sejam enviados desnecessariamente ao daemon do Docker.
3. Garantir permissões de escrita/execução corretas para o usuário `node` caso necessário.

## Não Alterar
- Não alterar a porta padrão da aplicação (`4000`).
- Não remover variáveis de ambiente exigidas pela aplicação em runtime (`DATABASE_URL`, `JWT_SECRET`, etc.).

## Critérios de Aceite
- [ ] Build multi-stage implementado com sucesso.
- [ ] Imagem final de produção não contém dependências de desenvolvimento (`devDependencies`).
- [ ] Container executa com usuário não-root (`USER node`).
- [ ] A aplicação sobe executando o código compilado em JavaScript (`dist/index.js`), não o servidor de desenvolvimento.
- [ ] O comando de inicialização utiliza `prisma migrate deploy` (não `migrate dev`).
- [ ] `docker build` completa sem erros localmente.
- [ ] Container sobe e responde com sucesso ao endpoint `/health`.

## Validações Obrigatórias
```bash
docker build -t vtx-api:prod .
docker run --rm vtx-api:prod whoami
```
*Resultado esperado do whoami:* `node` (não `root`).

Teste de inicialização e healthcheck:
```bash
docker compose config
```

## Entrega
Entregar o **Relatório de Alterações da TASK 03 (Sprint 2)** em `test/docs/relatorio-alteracoes-task-03-sprint-2.md`.

---

# TASK 04 (Sprint 2) — Validação Integrada e Fechamento da Sprint 2

## Prioridade
🟠 **Alta**

## Objetivo
Garantir que as três correções da Sprint 2 funcionem conjuntamente, sem regressões nos itens da Sprint 1 e com validação prática de segurança antes da liberação para a Sprint 3.

## Pré-requisito
Tasks 01, 02 e 03 da Sprint 2 concluídas e com relatórios entregues.

## Validações Obrigatórias
1. **Regressão de Build e Testes:**
   ```bash
   npm run build
   npx vitest run test/auth.limiter.test.ts test/cors.test.ts test/subscription.schema.test.ts
   ```
2. **Validação Prática de Mass Assignment:**
   - Enviar requisição autenticada tentando alterar `clientId` em `PATCH /subscriptions/:id` e comprovar o bloqueio 400.
3. **Validação Prática de Mensagens de Erro:**
   - Comprovar que respostas 500 não vazam detalhes do banco.
4. **Validação Prática do Container Docker:**
   - Confirmar que a imagem de produção roda com usuário `node`.

## Definition of Done (DoD) da Sprint 2
A Sprint 2 será homologada como **Concluída** quando:
- [ ] Tasks 01, 02 e 03 da Sprint 2 aprovadas pelo PO.
- [ ] Endpoint de subscription blindado contra mass assignment.
- [ ] Respostas 500 padronizadas sem vazamento de `error.message`.
- [ ] Dockerfile de produção reescrito, validado como non-root e multi-stage.
- [ ] `npm run build` passando sem erros.
- [ ] Relatórios de cada task entregues.
- [ ] Relatório Final da Sprint 2 entregue e aprovado pelo PO.

---

## 4. Modelo Obrigatório de Relatório de Alterações

Para cada task finalizada, preencher e submeter o modelo abaixo:

```markdown
## Relatório de Alterações — TASK XX (Sprint 2)

**Task:**  
`TASK XX — Nome da task`

**Status:**  
`Concluído` / `Bloqueado` / `Em Validação`

### 1. Resumo
Descreva brevemente o que foi implementado e qual problema foi resolvido.

### 2. Arquivos alterados
- arquivo1
- arquivo2
(Para cada arquivo, explique o motivo da alteração)

### 3. Alterações realizadas
Detalhamento técnico do que foi feito e como foi feito.

### 4. Decisões técnicas
Decisões de arquitetura, configurações ou parâmetros adotados.

### 5. Validações executadas
Comandos executados e resultados obtidos (Passou / Falhou).

### 6. Evidências
Respostas HTTP, logs, prints ou saídas de comandos.

### 7. Problemas encontrados
Problemas encontrados durante o desenvolvimento e como foram superados.

### 8. Riscos ou pontos para revisão
Pontos de atenção para a revisão do PO.

### 9. Arquivos ou alterações que NÃO foram realizados
Alterações planejadas que eventualmente foram descartadas ou postergadas.

### 10. Perguntas / bloqueios
Dúvidas ou bloqueios que necessitam de direcionamento do PO.
```

---

## 5. Primeiro Passo

> 🚀 **Inicie exclusivamente pela TASK 01 (Sprint 2):**
> **Proteção contra Mass Assignment em `PATCH /subscriptions/:id` via Zod.**
> 
> Ao concluir, execute os testes, gere o relatório `test/docs/relatorio-alteracoes-task-01-sprint-2.md` e aguarde a validação do PO antes de avançar para a TASK 02.
