## Relatório de Alterações --- TASK 02

**Task:**\
`TASK 02 — Rate limiting no login`

**Status:**\
`Concluído`

### 1. Resumo

Foi implementado mecanismo de rate limiting no endpoint `POST /auth/login` para proteger a aplicação contra ataques de força bruta, dicionário e *credential stuffing*. A proteção limita as tentativas de login por IP e bloqueia requisições excedentes com HTTP 429, sem penalizar logins bem-sucedidos de usuários legítimos e sem aplicar limitação desnecessária sobre o restante da API.

### 2. Arquivos alterados

``` text
- package.json
- package-lock.json
- src/modules/auth/auth.limiter.ts
- src/modules/auth/auth.routes.ts
- test/auth.limiter.test.ts
```

* `package.json` / `package-lock.json`: Adição da dependência `express-rate-limit` (^7.5.0) para controle de taxa de requisições e das dependências de desenvolvimento `supertest` e `@types/supertest` para testes automatizados de integração HTTP.
* `src/modules/auth/auth.limiter.ts`: Criação do middleware `loginRateLimiter` com parametrização de janela de tempo, limite de tentativas, exclusão de requisições com sucesso (`skipSuccessfulRequests: true`) e payload de erro padronizado.
* `src/modules/auth/auth.routes.ts`: Acoplamento do middleware `loginRateLimiter` especificamente no handler da rota `router.post('/login', loginRateLimiter, login)`.
* `test/auth.limiter.test.ts`: Criação de testes automatizados com Vitest cobrindo fluxo normal com sucesso, bloqueio na 6ª tentativa falha consecutiva com status 429 e ausência de restrições em rotas não autenticadas como `GET /health`.

### 3. Alterações realizadas

* **Seleção e integração do pacote:** Adicionado o pacote `express-rate-limit` (v7), compatível nativamente com TypeScript e Express 5.
* **Criação do middleware isolado:** O middleware foi criado em módulo próprio (`src/modules/auth/auth.limiter.ts`), permitindo configuração dinâmica via variáveis de ambiente com fallbacks seguros.
* **Restrição de escopo:** O middleware foi vinculado unicamente à rota `POST /auth/login` em `src/modules/auth/auth.routes.ts`. Não foi aplicado globalmente no `app.use()` geral, garantindo que outras rotas permaneçam sem overhead de limitação.
* **Preservação de tráfego legítimo:** Ativado o parâmetro `skipSuccessfulRequests: true`. Caso o login ocorra com credenciais válidas (HTTP 200), a requisição não consome a cota de tentativas, evitando travamentos acidentais para usuários legítimos.
* **Cabeçalhos padronizados:** Configurado `standardHeaders: 'draft-8'` e `legacyHeaders: false` para enviar cabeçalhos IETF modernos (`RateLimit-*` e `Retry-After`).

### 4. Decisões técnicas

``` text
Rate limit:
- Janela: 15 minutos (configurável via AUTH_RATE_LIMIT_WINDOW_MINUTES, default 15)
- Limite: 5 tentativas (configurável via AUTH_RATE_LIMIT_MAX, default 5)
- Chave: IP (req.ip)
- Sucesso: skipSuccessfulRequests: true (não consome cota em logins válidos)
- Resposta ao exceder: HTTP 429 Too Many Requests
- Body ao exceder: {"error": "Muitas tentativas de login. Tente novamente em 15 minutos."}
- Headers: standardHeaders 'draft-8' ativo, legacyHeaders desativado
```

### 5. Validações executadas

``` text
npx vitest test/auth.limiter.test.ts --run  → PASSOU (3 testes aprovados em 1.28s)
npm audit                                  → PASSOU (0 vulnerabilidades encontradas)
Teste automatizado de brute-force          → PASSOU (bloqueio na 6ª tentativa falha)
Teste de login com credenciais válidas     → PASSOU (status 200 sem bloqueio)
Teste de rota não protegida (health)       → PASSOU (status 200 sem interferência)
```

### 6. Evidências

* **Execução dos testes automatizados (`vitest`):**
``` text
 RUN  v4.1.5 C:/_Brito/project-vtx

 ✓ test/auth.limiter.test.ts (3 tests) 125ms
   ✓ Auth Rate Limiter (POST /auth/login) > deve permitir requisições com credenciais válidas sem bloquear (23ms)
   ✓ Auth Rate Limiter (POST /auth/login) > deve bloquear após exceder 5 tentativas falhas consecutivas retornando HTTP 429 (52ms)
   ✓ Auth Rate Limiter (POST /auth/login) > não deve aplicar rate limit a outras rotas não relacionadas (12ms)

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Duration  1.28s
```

* **Resposta HTTP capturada na 6ª tentativa consecutiva com credenciais inválidas:**
``` http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json; charset=utf-8
Retry-After: 900
RateLimit-Limit: 5
RateLimit-Remaining: 0
RateLimit-Reset: 900

{
  "error": "Muitas tentativas de login. Tente novamente em 15 minutos."
}
```

* **Como o limite é resetado:**
O limite expira automaticamente na store em memória após a janela temporal de 15 minutos decorridos da primeira requisição, ou imediatamente para logins bem-sucedidos em virtude de `skipSuccessfulRequests: true`.

### 7. Problemas encontrados

``` text
Nenhum problema encontrado.
```

### 8. Riscos ou pontos para revisão

* **Ambiente com Proxy Reverso / Balanceador:** Caso a aplicação seja implantada em produção atrás de Nginx, Traefik, AWS ALB ou Cloudflare, certificar-se de definir `app.set('trust proxy', 1)` em `src/app.ts`, garantindo que `req.ip` extraia o endereço de IP real do cliente enviado no cabeçalho `X-Forwarded-For`.
* **Escalonamento Horizontal:** A store padrão do `express-rate-limit` mantém os contadores na memória do processo Node.js. Caso a infraestrutura evolua para múltiplos pods/instâncias concorrentes, recomenda-se conectar uma store centralizada como `rate-limit-redis`.

### 9. Arquivos ou alterações que NÃO foram realizados

* Não foram alterados: algoritmo de hash de senhas (`bcryptjs`), estrutura do JWT, models do Prisma, regras de autorização ou cadastro de usuários, cumprindo integralmente a seção "Não alterar" da TASK 02.

### 10. Perguntas / bloqueios

Nenhum bloqueio identificado. A task atende a todos os critérios de aceite definidos na sprint.
