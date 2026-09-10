# Plano de Execução — Sprint 3 de Segurança do `project-vtx`

## 1. Objetivo da Sprint

| Metadado | Detalhe |
|---|---|
| **Sprint** | 3 — Cobertura de Testes e Controle de Acesso |
| **Projeto** | `MateusBrito-hub/project-vtx` |
| **Branch base** | `master` |
| **Perfil de execução** | Desenvolvedor independente |
| **Duração de referência** | 1 semana |
| **Itens de Origem** | Itens 7, 8 e 9 do Relatório de Análise de Segurança |

### Objetivo do PO

Restabelecer a integridade e confiabilidade da suíte automatizada de testes, mitigar riscos de privacidade/LGPD nos dados de clientes e implementar controles de ciclo de vida para tokens de autenticação:

1. **Restauração da Suíte de Testes de Clientes (`test/client.test.ts`):** Corrigir todos os imports e mocks legados que quebram a suíte de testes de clientes, permitindo que o comando global `npm test` execute sem erros em 100% dos arquivos de teste.
2. **Proteção de Dados Sensíveis (PII) contra Perfis `OPERATOR`:** Filtrar os dados de clientes retornados em `GET /clients` e `GET /clients/:id`, impedindo que usuários com a role `OPERATOR` tenham visibilidade de dados fiscais e pessoais desnecessários (`CPF_CNPJ`, `owner`, `ownerDocument`, `address`, `IE`, `IM`).
3. **Estratégia de Revogação de Tokens JWT (Logout Server-Side):** Implementar ou estruturar mecanismo que impeça a reutilização de tokens JWT emitidos após o encerramento explícito de sessão (`POST /auth/logout`).
4. **Validação Integrada e Fechamento da Sprint 3:** Executar a suíte de testes global unificada, comprovar ausência de regressões e emitir o relatório de homologação final da Sprint 3.

---

## 2. Forma de Trabalho

A execução segue o modelo de **delegação de PO para desenvolvedor**:
- Cada task possui objetivo, contexto, escopo detalhado, o que NÃO alterar, critérios de aceite, comandos de validação e modelo obrigatório de relatório.
- **Regra do PO:** Execução estritamente sequencial. Implemente a task, execute as validações, entregue o relatório formal em `test/docs/` e aguarde a validação do PO antes de iniciar a próxima.

---

## 3. Ordem de Execução

| Ordem | Task | Item Original | Prioridade | Esforço | Dependências |
|:---:|---|:---:|:---:|:---:|:---:|
| **1** | **TASK 01 (Sprint 3)** — Restauração da Suíte de Testes de Clientes (`test/client.test.ts`) | Item 7 | 🟡 Média / Bloqueador CI | Médio | Nenhuma |
| **2** | **TASK 02 (Sprint 3)** — Proteção de Dados PII contra Perfis `OPERATOR` (`GET /clients`) | Item 9 | 🟡 Média | Médio | Nenhuma |
| **3** | **TASK 03 (Sprint 3)** — Estratégia de Revogação de Token e Logout Server-Side | Item 8 | 🟡 Média | Médio | Nenhuma |
| **4** | **TASK 04 (Sprint 3)** — Validação Integrada e Fechamento da Sprint 3 | — | 🟡 Média | Baixo | Tasks 01, 02 e 03 |

---

# TASK 01 (Sprint 3) — Restauração da Suíte de Testes de Clientes (`test/client.test.ts`)

## Prioridade
🟡 **Média** (Bloqueador de CI/CD para execução global do `npm test`)

## Objetivo
Refatorar o arquivo [test/client.test.ts](file:///c:/_Brito/project-vtx/test/client.test.ts) para refletir com exatidão a arquitetura modular atual da aplicação (`src/modules/client/client.service.ts`, `src/modules/client/client.repository.ts`, `src/shared/database/database-manager.ts` e `src/shared/database/prisma.ts`), eliminando imports quebrados e garantindo que os 11 casos de teste unitários passem no Vitest.

## Contexto
O arquivo `test/client.test.ts` falha imediatamente ao rodar o Vitest:
```text
Error: Cannot find module '/src/service/client' imported from test/client.test.ts
```
Causas identificadas:
1. **Caminho de Import Inválido:** Importa `../src/service/client`, enquanto os métodos estão agora em `../src/modules/client/client.service`.
2. **Caminho do Database Manager Inválido:** Importa `../src/utils/databse-manager` (com erro de digitação original), quando o arquivo real está em `../src/shared/database/database-manager`.
3. **Mocking do Prisma:** Moca `@prisma/client`, mas o código real consome a instância singleton `prisma` de `../src/shared/database/prisma`.
4. **Alinhamento de Regras e Nomes de Métodos:**
   - Mensagem de erro em plano inexistente: o teste espera `'Plano não encontrado'`, mas o serviço lança `'Plan not found'`.
   - Método de ativação: o teste importava `activeClientById`, mas o serviço exporta `activateClientById`.
   - Status de cancelamento: o teste espera `'cancelled'`, mas o repositório define `'canceled'`.

## Escopo
1. Atualizar os imports em `test/client.test.ts`:
   - `../src/shared/interface/client` ou `../src/modules/client/client.schema` para tipagem DTO.
   - `../src/shared/database/database-manager` para o mock de criação de banco de tenant.
   - `../src/modules/client/client.service` para os métodos de serviço (`createClientWithSubscription`, `getAllClients`, `getClientById`, `getClientBySlug`, `updateClientById`, `suspendClientById`, `cancelClientById`, `activateClientById`).
2. Atualizar o mock do Prisma para apontar diretamente para `../src/shared/database/prisma`:
   ```typescript
   vi.mock('../src/shared/database/prisma', () => ({
       prisma: mockPrismaClient
   }))
   ```
3. Garantir suporte ao mock transacional `$transaction` e aos repositories internos (`planRepository` e `subscriptionRepository`).
4. Alinhar os asserts de texto de erro e status com o código em produção.
5. Executar a suíte e validar 100% de aprovação.

## Não Alterar
- Não alterar as regras de negócio em `src/modules/client/client.service.ts` ou `src/modules/client/client.repository.ts`.
- Não remover as asserções de segurança fundamentais (ex.: impedimento de alteração do campo `database` do cliente).

## Critérios de Aceite
- [ ] O arquivo `test/client.test.ts` executa sem erros de importação.
- [ ] Todos os 11 cenários de teste passam com sucesso no Vitest.
- [ ] O comando global `npm test` executa sem quebras em toda a aplicação.
- [ ] Build (`npm run build`) mantém código limpo (código 0).

## Validações Obrigatórias
```bash
npm run build
npx vitest run test/client.test.ts
npm test -- --run
```

## Entrega
Entregar o **Relatório de Alterações da TASK 01 (Sprint 3)** em `test/docs/relatorio-alteracoes-task-01-sprint-3.md`.

---

# TASK 02 (Sprint 3) — Proteção de Dados PII contra Perfis `OPERATOR` (`GET /clients`)

## Prioridade
🟡 **Média** (Conformidade com LGPD e Princípio do Menor Privilégio)

## Objetivo
Restringir os dados retornados nos endpoints de listagem e detalhe de clientes (`GET /clients` e `GET /clients/:id`) para requisições autenticadas de usuários com a role `OPERATOR`, impedindo a exposição desnecessária de dados fiscais e pessoais sensíveis (PII).

## Contexto
Atualmente, qualquer usuário autenticado com a role `OPERATOR` recebe o payload integral do cliente, incluindo `CPF_CNPJ`, `owner`, `ownerDocument`, `IE`, `IM` e dados de residência/endereço. Operadores de suporte precisam apenas de dados cadastrais essenciais (ex.: `id`, `socialName`, `fantasyName`, `slug`, `status`, `plan`, `contact`, `email`).

## Escopo
1. Analisar as rotas de `client` (`src/modules/client/client.routes.ts`) e o controller (`src/modules/client/client.controller.ts`).
2. Aplicar filtro ou projeção condicional baseada na role do usuário autenticado (`req.user.role`):
   - Se `ADMIN`: retorno completo do cliente.
   - Se `OPERATOR`: remover ou mascarar campos sensíveis (`CPF_CNPJ`, `owner`, `ownerDocument`, `IE`, `IM`, `address`, `district`, `complement`, `zipCode`).
3. Criar testes automatizados cobrindo a resposta para `ADMIN` (completa) e para `OPERATOR` (sanitizada).

## Não Alterar
- Não quebrar o fluxo de administradores (`ADMIN` deve continuar visualizando os dados fiscais completos).
- Não alterar as rotas de criação ou atualização de clientes.

## Critérios de Aceite
- [ ] `GET /clients` omite dados fiscais e PII sensíveis quando requisitado por `OPERATOR`.
- [ ] `GET /clients/:id` omite dados fiscais e PII sensíveis quando requisitado por `OPERATOR`.
- [ ] Usuários com role `ADMIN` continuam recebendo os dados completos.
- [ ] Testes automatizados criados e passando.

## Entrega
Entregar o **Relatório de Alterações da TASK 02 (Sprint 3)** em `test/docs/relatorio-alteracoes-task-02-sprint-3.md`.

---

# TASK 03 (Sprint 3) — Estratégia de Revogação de Token e Logout Server-Side

## Prioridade
🟡 **Média**

## Objetivo
Estruturar e implementar um mecanismo de revogação de tokens JWT emitidos no `POST /auth/login`, viabilizando o encerramento seguro de sessão no endpoint de logout (`POST /auth/logout`).

## Contexto
Tokens JWT são atualmente *stateless* com tempo de vida de 15 minutos (`src/shared/auth/jwt.ts`). Caso um usuário faça logout ou suas credenciais sejam comprometidas, o token continua válido até o término do tempo de expiração, sem que o backend consiga rejeitá-lo antes.

## Escopo
1. Definir estratégia técnica de revogação eficiente (ex.: campo `tokenVersion` no modelo de usuário do banco, ou lista de revogação em cache transitório/memória para tokens invalidados antes de `exp`).
2. Implementar endpoint `POST /auth/logout` que registra o token na blacklist até seu `exp`.
3. Atualizar middleware de autenticação (`src/shared/auth/jwt.ts` / middleware de autenticação) para rejeitar requisições de tokens revogados com HTTP 401 Unauthorized.
4. Criar testes automatizados comprovando que um token revogado não consegue mais acessar endpoints protegidos.

## Critérios de Aceite
- [ ] Endpoint `POST /auth/logout` implementado e funcional.
- [ ] Token revogado no logout é rejeitado com status 401 em chamadas subsequentes.
- [ ] Testes automatizados cobrindo o fluxo de logout e tentativa de reuso de token.

## Entrega
Entregar o **Relatório de Alterações da TASK 03 (Sprint 3)** em `test/docs/relatorio-alteracoes-task-03-sprint-3.md`.

---

# TASK 04 (Sprint 3) — Validação Integrada e Fechamento da Sprint 3

## Prioridade
🟡 **Média**

## Objetivo
Executar toda a suíte de testes de ponta a ponta sem qualquer exclusão de arquivos, comprovar a resolução das vulnerabilidades médias e emitir o relatório final de fechamento da Sprint 3.

## Validações Obrigatórias
```bash
npm run build
npm test -- --run
```
*Critério:* 100% dos testes de todos os arquivos de teste passando de forma determinística.

## Entrega
Entregar o **Relatório Final da Sprint 3** em `test/docs/relatorio-final-sprint-3.md`.

---

## 4. Modelo Obrigatório de Relatório de Alterações

```markdown
## Relatório de Alterações — TASK XX (Sprint 3)

**Task:**  
`TASK XX — Nome da task`

**Status:**  
`Concluído` / `Bloqueado` / `Em Validação`

### 1. Resumo
### 2. Arquivos alterados
### 3. Alterações realizadas
### 4. Decisões técnicas
### 5. Validações executadas
### 6. Evidências
### 7. Problemas encontrados
### 8. Riscos ou pontos para revisão
### 9. Arquivos ou alterações que NÃO foram realizados
### 10. Perguntas / bloqueios
```
