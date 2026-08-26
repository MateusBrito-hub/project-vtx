# Plano de Sprints — Correções de Segurança `project-vtx`

| | |
|---|---|
| **Repositório** | MateusBrito-hub/project-vtx |
| **Branch base** | `development` |
| **Origem** | Relatório de Análise de Segurança (26/08/2026) |
| **Duração sugerida por sprint** | 1 semana (ajustar conforme capacidade do time) |
| **Total de sprints** | 4 |

> Este documento serve como painel de acompanhamento. Atualize a coluna **Status** e o **Log de acompanhamento** ao final de cada sprint. Status possíveis: `A Fazer` · `Em Andamento` · `Em Validação` · `Concluído` · `Bloqueado`.

---

## Visão geral (Kanban resumido)

| Sprint | Foco | Itens | Prioridade predominante |
|---|---|---|---|
| Sprint 1 | Contenção de riscos críticos | 1, 2, 3, 10, 11 | 🔴 Crítico + limpeza rápida |
| Sprint 2 | Blindagem de validação e infraestrutura | 4, 5, 6 | 🟠 Alto |
| Sprint 3 | Cobertura de testes e controle de acesso | 7, 8, 9 | 🟡 Médio |
| Sprint 4 | Validação, regressão e fechamento | — | ✅ QA / Verificação final |

---

## Sprint 1 — Contenção de riscos críticos

**Objetivo:** eliminar as exposições mais graves (credenciais, ausência de rate limit, CORS aberto) e aproveitar para remover itens de baixo esforço.

| # | Item | Prioridade | Esforço | Critério de aceite | Status |
|---|---|---|---|---|---|
| 1 | Rotacionar credenciais do Postgres e remover exposição da porta `5432` em produção | 🔴 Crítico | Baixo | Senha forte via variável de ambiente/secret manager; `ports` do Postgres removido do compose de produção ou restrito por firewall | A Fazer |
| 2 | Adicionar rate limiting no `POST /auth/login` | 🔴 Crítico | Baixo | Middleware de rate limit (`express-rate-limit` ou equivalente) bloqueando após N tentativas falhas por IP/e-mail | A Fazer |
| 3 | Restringir CORS a origens conhecidas | 🔴 Crítico | Baixo | `cors()` configurado com whitelist explícita de `origin`; requisição de origem não autorizada é rejeitada | A Fazer |
| 10 | Remover dependência `crypto` não utilizada do `package.json` | 🟢 Baixo | Trivial | `npm uninstall crypto`; `npm run build`/testes continuam passando | A Fazer |
| 11 | Adicionar `helmet` | 🟢 Baixo | Trivial | `helmet()` aplicado em `app.ts`; headers de segurança presentes na resposta (`X-Content-Type-Options`, etc.) | A Fazer |

**Definition of Done da sprint:** os 3 itens críticos validados em ambiente de homologação (tentativa de brute-force bloqueada, banco não acessível externamente, CORS rejeitando origem não whitelisted).

---

## Sprint 2 — Blindagem de validação e infraestrutura

**Objetivo:** fechar a brecha de mass assignment, parar de vazar detalhes internos de erro e corrigir a imagem Docker de produção.

| # | Item | Prioridade | Esforço | Critério de aceite | Status |
|---|---|---|---|---|---|
| 4 | Criar schema Zod restrito para `PATCH /subscriptions/:id` | 🟠 Alto | Baixo | Endpoint aceita apenas `amount` (ou campos explicitamente permitidos); envio de `clientId`/`status`/`startDate` é rejeitado com 400 | A Fazer |
| 5 | Padronizar tratamento de erros (nunca expor `error.message` bruto ao cliente) | 🟠 Alto | Médio | Todos os `catch` dos controllers (`client`, `plan`, `subscription`) logam o erro internamente e retornam mensagem genérica em respostas 5xx | A Fazer |
| 6 | Reescrever Dockerfile (multi-stage, usuário non-root, `prisma migrate deploy`) | 🟠 Alto | Médio | Build multi-stage sem `devDependencies` na imagem final; container roda com `USER` não-root; `CMD` usa `migrate deploy` + `node dist/index.js` | A Fazer |

**Definition of Done da sprint:** build de produção da imagem Docker validado (`docker build` + smoke test do container), endpoint de subscription testado contra tentativas de mass assignment, respostas de erro revisadas manualmente.

---

## Sprint 3 — Cobertura de testes e controle de acesso

**Objetivo:** restaurar a confiabilidade da suíte de testes, avaliar estratégia de revogação de token e revisar o payload exposto a roles de menor privilégio.

| # | Item | Prioridade | Esforço | Critério de aceite | Status |
|---|---|---|---|---|---|
| 7 | Corrigir imports de `test/client.test.ts` e ampliar cobertura para `plan`/`subscription` | 🟡 Médio | Médio | `npx vitest run` passa sem erros de módulo; testes cobrindo a regra de bloqueio do campo `database` voltam a rodar; novos testes cobrem o schema Zod do item 4 | A Fazer |
| 8 | Avaliar e definir estratégia de revogação de token (refresh token rotativo ou blacklist) | 🟡 Médio | Alto | Decisão documentada (RFC/ADR curto); se aprovado para implementação, ticket técnico aberto com desenho da solução | A Fazer |
| 9 | Revisar payload retornado para role `OPERATOR` em `GET /clients` e `GET /clients/:id` | 🟡 Médio | Baixo | Decisão registrada: manter payload completo (com justificativa) ou introduzir DTO reduzido sem `CPF_CNPJ`/`ownerDocument` para essa role | A Fazer |

**Definition of Done da sprint:** suíte de testes 100% executável e passando no CI; decisão sobre revogação de token registrada; escopo de dados por role documentado.

---

## Sprint 4 — Validação, regressão e fechamento

**Objetivo:** confirmar que todas as correções anteriores não introduziram regressões e revalidar o estado geral de segurança do projeto.

| Atividade | Critério de aceite | Status |
|---|---|---|
| Reexecutar `npm audit` | Sem novas vulnerabilidades introduzidas pelas mudanças | A Fazer |
| Reexecutar suíte completa de testes (`npx vitest run`) | 100% dos testes passando | A Fazer |
| Revalidar manualmente os 3 itens críticos da Sprint 1 em ambiente próximo de produção | Login com rate limit ativo, banco não acessível externamente, CORS restrito | A Fazer |
| Revisão cruzada (peer review) das mudanças das Sprints 2 e 3 | PRs aprovados por outro revisor | A Fazer |
| Atualizar o Relatório de Análise de Segurança original com o status "Corrigido" em cada item | Documento revisado refletindo o estado pós-sprints | A Fazer |

---

## Log de acompanhamento

> Preencher ao final de cada sprint (data, o que foi concluído, o que ficou pendente, decisões tomadas).

| Data | Sprint | Resumo | Pendências / Observações |
|---|---|---|---|
| | | | |
| | | | |
| | | | |
| | | | |

---

*Documento de acompanhamento gerado a partir do Relatório de Análise de Segurança do `project-vtx` (branch `development`). Ajuste durações de sprint e responsáveis conforme a capacidade real do time.*
