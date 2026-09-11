# Plano de Execução — Sprint 4 de Segurança do `project-vtx`

## 1. Objetivo da Sprint

| Metadado | Detalhe |
|---|---|
| **Sprint** | 4 — Validação Final, Regressão e Encerramento Geral do Ciclo de Segurança |
| **Projeto** | `MateusBrito-hub/project-vtx` |
| **Branch base** | `master` |
| **Perfil de execução** | Desenvolvedor independente |
| **Duração de referência** | 1 semana |
| **Itens de Origem** | Riscos Adicionais 1 e 3 do Relatório Consolidado de Vulnerabilidades, Homologação Docker e Certificação Final |

### Objetivo do PO

Concluir com excelência o ciclo global de segurança da API `project-vtx`:
1. **Blindagem contra Mass Assignment no Módulo de Planos (`Plan`):** Fechar a última brecha de injeção de parâmetros não controlados na criação e edição de planos (`POST /plans` e `PATCH /plans/:id`) através de schemas Zod com validação estrita em runtime (`.strict()`).
2. **Configuração de `trust proxy`:** Configurar `app.set('trust proxy', 1)` no Express para garantir que o rate limit e a auditoria de acessos funcionem com precisão quando a aplicação estiver atrás de proxies reversos, ALBs da AWS ou Cloudflare em produção.
3. **Homologação Integrada em Container Docker:** Validar a integridade dos contêineres (`vtx-api` e `vtx-postgres`), migrações automáticas de banco (`prisma migrate deploy`), execução non-root e endpoint de `/health`.
4. **Relatório Executivo Final e Certificação Geral:** Consolidar todos os avanços das Sprints 1 a 4, atestar 100% de mitigação das vulnerabilidades identificadas e emitir o Certificado Executivo de Segurança do projeto.

---

## 2. Forma de Trabalho

A execução mantém a governança das sprints anteriores:
- Cada task possui objetivo claro, contexto, escopo detalhado, critérios de aceite e comandos de validação.
- **Regra Principal:** Execução sequencial task a task, validação automatizada, submissão do relatório de alterações e revisão do PO.

---

## 3. Ordem de Execução

| Ordem | Task | Item Original | Prioridade | Esforço | Dependências |
|:---:|---|:---:|:---:|:---:|:---:|
| **1** | **TASK 01 (Sprint 4)** — Schema Zod e Proteção contra Mass Assignment em Planos (`Plan`) | Risco Adicional 1 | 🟠 Alta | Baixo | Nenhuma |
| **2** | **TASK 02 (Sprint 4)** — Configuração de `trust proxy` para Ambientes com Proxy Reverso | Risco Adicional 3 | 🟡 Média | Baixo | Nenhuma |
| **3** | **TASK 03 (Sprint 4)** — Homologação Integrada em Container Docker e Healthcheck | Hardening Prod | 🟡 Média | Médio | Tasks 01 e 02 |
| **4** | **TASK 04 (Sprint 4)** — Relatório Executivo Final e Certificação Geral de Segurança | Governança | 🟢 Baixa | Médio | Tasks 01, 02 e 03 |

---

# TASK 01 (Sprint 4) — Schema Zod e Proteção contra Mass Assignment em Planos (`Plan`)

## Prioridade
🟠 **Alta**

## Objetivo
Criar o módulo [src/modules/plan/plan.schema.ts](file:///c:/_Brito/project-vtx/src/modules/plan/plan.schema.ts) com schemas Zod estritos (`.strict()`) para criação e atualização de planos, eliminando a desestruturação insegura do `req.body` no [plan.controller.ts](file:///c:/_Brito/project-vtx/src/modules/plan/plan.controller.ts).

## Contexto
Diferente dos módulos `client` e `subscription` que foram blindados nas sprints anteriores, o módulo de planos ainda valida parâmetros manualmente via `if (!body.name || !body.price || !body.maxDocs)` e repassa o objeto desestruturado `{ ...body }` para o banco de dados. Um usuário mal-intencionado com acesso administrativo pode injetar propriedades não modeladas, campos de controle de sistema ou valores fora dos limites de negócio.

## Escopo
1. Criar `src/modules/plan/plan.schema.ts`:
   - `createPlanSchema`: valida `name` (string não vazia), `price` (número positivo), `maxDocs` (inteiro positivo). `.strict()`.
   - `updatePlanSchema`: campos opcionais, mas pelo menos um deve ser informado. `.strict()`.
   - Exportar os tipos inferidos `CreatePlanDTO` e `UpdatePlanDTO`.
2. Atualizar `src/modules/plan/plan.controller.ts`:
   - Aplicar `createPlanSchema.parse(req.body)` no `registerPlan`.
   - Aplicar `updatePlanSchema.parse(req.body)` no `updatePlanById`.
   - Tratar `ZodError` com `handleZodError(res, error)`.
3. Criar a suíte de testes `test/plan.schema.test.ts` com validação de rejeição HTTP 400 em injeção de campos desconhecidos.

## Não Alterar
- Não alterar as regras de negócio de `plan.service.ts` ou `plan.repository.ts`.
- Não alterar as permissões de role das rotas em `plan.routes.ts`.

## Critérios de Aceite
- [ ] Injeção de campos arbitrários em `POST /plans` é rejeitada com status HTTP 400.
- [ ] Injeção de campos arbitrários em `PATCH /plans/:id` é rejeitada com status HTTP 400.
- [ ] Erros de validação Zod retornam estrutura padronizada com detalhes amigáveis.
- [ ] Build e testes unitários 100% aprovados.

## Validações Obrigatórias
```bash
npm run build
npx vitest run test/plan.schema.test.ts
npm test -- --run
```

## Entrega
Entregar o **Relatório de Alterações da TASK 01 (Sprint 4)** em `test/docs/relatorio-alteracoes-task-01-sprint-4.md`.

---

# TASK 02 (Sprint 4) — Configuração de `trust proxy` para Ambientes de Produção

## Prioridade
🟡 **Média**

## Objetivo
Configurar `app.set('trust proxy', 1)` em `src/app.ts` para que o Express identifique com precisão o IP de origem do cliente através do cabeçalho `X-Forwarded-For` quando a API for operada atrás de balanceadores de carga (ALB, Nginx, Cloudflare).

## Escopo
1. Adicionar `app.set('trust proxy', 1)` no topo de `src/app.ts`.
2. Validar que o `loginRateLimiter` penaliza o IP real repassado em `X-Forwarded-For` e não o IP interno do proxy reverso.
3. Garantir que a suíte `test/auth.limiter.test.ts` continue passando 100%.

## Critérios de Aceite
- [ ] `app.set('trust proxy', 1)` configurado em `src/app.ts`.
- [ ] Build sem erros.
- [ ] Testes de rate limiting passando sem quebras.

## Entrega
Entregar o **Relatório de Alterações da TASK 02 (Sprint 4)** em `test/docs/relatorio-alteracoes-task-02-sprint-4.md`.

---

# TASK 03 (Sprint 4) — Homologação Integrada em Container Docker e Healthcheck

## Prioridade
🟡 **Média**

## Objetivo
Executar e auditar a subida da infraestrutura completa em ambiente Docker (`docker compose up -d`), validando a execução automática das migrações do Prisma, a saúde do banco PostgreSQL e a resposta saudável em `/health`.

## Critérios de Aceite
- [ ] Contêineres sobem sem erros de inicialização.
- [ ] Migrações do Prisma executam com sucesso (`prisma migrate deploy`).
- [ ] Endpoint `/health` responde `HTTP 200 {"status": "running"}`.
- [ ] Processo Node.js executa sob o usuário `node` (non-root).

## Entrega
Entregar o **Relatório de Alterações da TASK 03 (Sprint 4)** em `test/docs/relatorio-alteracoes-task-03-sprint-4.md`.

---

# TASK 04 (Sprint 4) — Relatório Executivo Final e Certificação Geral de Segurança

## Prioridade
🟢 **Baixa**

## Objetivo
Consolidar todas as ações implementadas ao longo das Sprints 1 a 4, comparar a matriz de risco inicial com o estado final e emitir a **Declaração Executiva de Homologação e Conformidade de Segurança** do `project-vtx`.

## Entrega
Entregar o **Relatório Final da Sprint 4** e o **Relatório Executivo Consolidado de Segurança** em `test/docs/`.
