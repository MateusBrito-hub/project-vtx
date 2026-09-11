## Relatório de Alterações — TASK 03 (Sprint 3)

**Task:**  
`TASK 03 (Sprint 3) — Estratégia de Revogação de Tokens JWT e Logout Server-Side (POST /auth/logout)`

**Status:**  
`Concluído`

---

### 1. Resumo

Foi implementado o endpoint de logout seguro (`POST /auth/logout`) e a estratégia de revogação de tokens JWT em memória com controle de tempo de vida (TTL). Anteriormente, a aplicação utilizava tokens estritamente *stateless* com expiração estática de 15 minutos sem qualquer capacidade de invalidação pelo servidor; caso um usuário fizesse logout ou tivesse seu token interceptado, o token permanecia ativo até seu `exp`. Com a criação do módulo `src/shared/auth/token-blacklist.ts` e a integração ao middleware `authMiddleware`, qualquer token associado a um logout é imediatamente adicionado à blacklist e rejeitado com status `401 Unauthorized` (`"Token revogado"`) em chamadas subsequentes, eliminando a janela de reaproveitamento de credenciais.

---

### 2. Arquivos alterados

```text
- src/shared/auth/token-blacklist.ts
- src/shared/auth/auth.middleware.ts
- src/modules/auth/auth.controller.ts
- src/modules/auth/auth.routes.ts
- test/auth.logout.test.ts
```

* **`src/shared/auth/token-blacklist.ts`** *(Novo)*: Gerenciador de blacklist em memória baseado em `Map<string, number>`, registrando tokens revogados com timestamp de expiração (TTL de 15 minutos) e expurgo automático de tokens já vencidos.
* **`src/shared/auth/auth.middleware.ts`**: Adicionada a validação `isTokenRevoked(token)` antes da verificação criptográfica da assinatura e estendida a interface `Express.Request` com a propriedade `token?: string`.
* **`src/modules/auth/auth.controller.ts`**: Implementada a action `logout(req, res)` que revoga o token presente em `req.token` e retorna HTTP 200 com confirmação de encerramento de sessão.
* **`src/modules/auth/auth.routes.ts`**: Registrado o endpoint `POST /auth/logout` protegido pelo `authMiddleware`.
* **`test/auth.logout.test.ts`** *(Novo)*: Criação de suíte de testes com 5 cenários cobrindo rejeição sem token, formato inválido, logout bem-sucedido, bloqueio imediato pós-logout e rejeição a logout duplicado.

---

### 3. Alterações realizadas

1. **Implementação da Blacklist com TTL em Memória**:
   - `revokeToken(token, ttlMs = 15 * 60 * 1000)`: Registra o token com timestamp absoluto `expiresAt = Date.now() + ttlMs`.
   - `isTokenRevoked(token)`: Consulta em $O(1)$ e remove automaticamente chaves com `Date.now() > expiresAt`, prevenindo vazamento de memória.
   - `clearTokenBlacklist()`: Utilitário para isolamento entre testes.
2. **Endurecimento do Pipeline de Autenticação (`auth.middleware.ts`)**:
   - Extrai o token do cabeçalho `Authorization: Bearer <token>`.
   - Executa `if (isTokenRevoked(token))` retornando imediatamente status 401 `{ error: 'Token revogado' }`.
   - Anexa `req.token = token` e `req.user` para consumo dos controllers subsequentes.
3. **Endpoint de Logout (`POST /auth/logout`)**:
   - Exige autenticação prévia via `authMiddleware`.
   - Chama `revokeToken(req.token)`.
   - Retorna payload seguro: `{ message: 'Logout realizado com sucesso' }`.
4. **Garantia de Regressão e Testes Automatizados**:
   - Desenvolvida suíte em `test/auth.logout.test.ts` com mock isolado de banco e validação de bloqueio em rotas protegidas simuladas.

---

### 4. Decisões técnicas

```text
Mecanismo de Invalidação de Sessão:
- Arquitetura: Blacklist em Memória com TTL (Time-To-Live)
- TTL Padrão: 15 minutos (tempo de vida natural do JWT emitido)
- Desempenho: Verificação em O(1) via Map sem I/O de banco de dados
- Comportamento de Erro: Status HTTP 401 com mensagem padronizada "Token revogado"
- Rota: POST /auth/logout com require authentication
```

---

### 5. Validações executadas

```text
npm run build                                                    → PASSOU (compilação TypeScript tsc limpa, código 0)
npx vitest run test/auth.logout.test.ts                          → PASSOU (5/5 testes aprovados em 13.75s)
npm test -- --run (Execução Global Unificada)                   → PASSOU (8 arquivos / 47 testes aprovados em 9.91s)
```

---

### 6. Evidências

- **Execução Focada da Suíte de Logout (`test/auth.logout.test.ts`)**:
  ```text
   RUN  v4.1.11 C:/_Brito/project-vtx

   Test Files  1 passed (1)
        Tests  5 passed (5)
     Duration  13.75s
  ```

- **Execução Global Unificada de Toda a Aplicação**:
  ```text
   RUN  v4.1.11 C:/_Brito/project-vtx

   ✓ test/helmet.test.ts (2 tests)
   ✓ test/auth.logout.test.ts (5 tests)
   ✓ test/client.pii.test.ts (4 tests)
   ✓ test/error-handling.test.ts (2 tests)
   ✓ test/client.test.ts (16 tests)
   ✓ test/auth.limiter.test.ts (3 tests)
   ✓ test/subscription.schema.test.ts (5 tests)
   ✓ test/cors.test.ts (11 tests)

   Test Files  8 passed (8)
        Tests  47 passed (47)
     Duration  9.91s
  ```

---

### 7. Problemas encontrados

- **Mock do Prisma em Suíte Isolada de Auth**:  
  Na primeira execução do teste, `auth.routes.ts` importou `auth.service`, que requereu `auth.repository` e instanciou `PrismaClient` sem banco de dados ativo. A adição de `vi.mock('../src/shared/database/prisma', () => ({ prisma: {} }))` no cabeçalho de `test/auth.logout.test.ts` sanou o problema.

---

### 8. Riscos ou pontos para revisão

- **Escalabilidade Horizontal (Multi-Instância)**:  
  A blacklist atual reside na memória do processo Node.js. Em caso de múltiplos containers de réplica sem afinidade de sessão (*sticky sessions*), recomenda-se no futuro plugar um backend compartilhado como Redis para sincronização global entre nós. Para instâncias únicas e pods de tamanho padrão, a solução atual é ultrarrápida e auto-contida.

---

### 9. Arquivos ou alterações que NÃO foram realizados

- Não foi alterado o schema do banco de dados no Prisma nem adicionadas colunas relacionais, mantendo zero downtime e zero migrações destrutivas.

---

### 10. Perguntas / bloqueios

- Nenhum bloqueio. Todos os critérios de aceite foram atendidos e homologados.
