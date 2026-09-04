## Relatório de Alterações --- TASK 03

**Task:**\
`TASK 03 — Restrição do CORS`

**Status:**\
`Concluído`

### 1. Resumo

Foi substituída a configuração aberta `app.use(cors())` por uma política explícita de controle de origens (whitelist) encapsulada em módulo dedicado (`src/shared/config/cors.ts`). A solução permite a parametrização de origens autorizadas via variável de ambiente (`CORS_ALLOWED_ORIGINS`), adota defaults seguros em ambiente de desenvolvimento, exige configuração explícita em produção, rejeita requisições cross-origin não autorizadas com HTTP 403 Forbidden e preserva o acesso de ferramentas legítimas sem cabeçalho `Origin` (como curl, CLI e chamadas server-to-server). Adicionalmente, o endpoint `/health` foi ajustado em `src/app.ts` para preceder as rotas autenticadas, assegurando que verificações de integridade operem sem bloqueios indevidos.

### 2. Arquivos alterados

``` text
- src/app.ts
- src/shared/config/cors.ts
- .env.example
- test/cors.test.ts
- test/docs/relatorio-alteracoes-task-03.md
```

* `src/app.ts`: Substituição de `import cors from 'cors'` e `app.use(cors())` pelo middleware customizado `corsMiddleware` importado de `./shared/config/cors`, e posicionamento da rota pública `GET /health` antes do carregamento das rotas protegidas pelo middleware de autenticação.
* `src/shared/config/cors.ts`: Criação do módulo de configuração e middleware do CORS, provendo funções para extração de whitelist dinâmica, checagem de origens, configuração de métodos/headers e interceptação de origens não permitidas com status HTTP 403.
* `.env.example`: Documentação das variáveis de configuração `CORS_ALLOWED_ORIGINS` e `CORS_CREDENTIALS` juntamente com as demais variáveis do projeto.
* `test/cors.test.ts`: Criação de suíte de testes automatizados com Vitest e Supertest cobrindo origens permitidas, rejeição de origens não autorizadas com 403, requisições sem origin, preflight `OPTIONS`, e suporte à flag de credenciais.
* `test/docs/relatorio-alteracoes-task-03.md`: Emissão deste relatório formal de alterações.

### 3. Alterações realizadas

* **Criação do módulo dedicado de CORS:** Centralizada toda a lógica de CORS em `src/shared/config/cors.ts`, isolando a leitura das variáveis de ambiente e a validação das origens em funções puras testáveis (`getAllowedOrigins`, `isOriginAllowed`, `getCorsOptions`).
* **Whitelist explícita e flexível:** As origens autorizadas são lidas da variável `CORS_ALLOWED_ORIGINS` (suportando múltiplos domínios separados por vírgula).
* **Diferenciação segura por ambiente:**
  * Em desenvolvimento / teste (`NODE_ENV !== 'production'`), caso `CORS_ALLOWED_ORIGINS` não esteja definida, a aplicação adota como fallback seguro as portas locais habituais (`http://localhost:3000`, `http://localhost:5173`, `http://localhost:8080`, `http://127.0.0.1:3000`, `http://127.0.0.1:5173`, `http://127.0.0.1:8080`).
  * Em produção (`NODE_ENV === 'production'`), nenhuma origem permissiva é assumida por padrão; se a variável não for informada, nenhuma origem externa de navegador é aceita (bloqueio seguro por padrão).
* **Preservação de requisições legítimas sem `Origin`:** Requisições de ferramentas de terminal (`curl`), testes automatizados de backend, tarefas internas e apps mobile nativos que não enviam cabeçalho `Origin` são permitidas (`!origin => true`).
* **Bloqueio explícito com HTTP 403 Forbidden:** Requisições cross-origin com origens fora da whitelist são interceptadas imediatamente pelo middleware antes de atingir as rotas internas, retornando HTTP 403 com mensagem clara em JSON (`{"error": "Origem não permitida pela política de CORS."}`).
* **Parametrização de Credentials:** Mantido `credentials: false` por padrão (conforme recomendado no relatório de segurança para autenticação baseada em Bearer Token), com suporte a ativação via `CORS_CREDENTIALS=true` caso necessário no futuro.
* **Cache de preflight:** Configurado `maxAge: 86400` (24 horas) para diminuir o tráfego de requisições `OPTIONS` repetidas.

### 4. Decisões técnicas

``` text
CORS:
- Origens: Whitelist dinâmica via CORS_ALLOWED_ORIGINS (fallback local em dev/test, restrito em prod)
- Requisições sem Origin: Permitidas (!origin => true) para compatibilidade com CLI/mobile/server-to-server
- Credentials: false por padrão (ativável via CORS_CREDENTIALS=true)
- Métodos permitidos: GET, POST, PUT, PATCH, DELETE, OPTIONS
- Headers permitidos: Content-Type, Authorization, X-Requested-With
- MaxAge (Preflight Cache): 86400 segundos (24 horas)
- Resposta para origens não autorizadas: HTTP 403 Forbidden
- Body de rejeição: {"error": "Origem não permitida pela política de CORS."}
```

### 5. Validações executadas

``` text
npx vitest run test/cors.test.ts --reporter=verbose   → PASSOU (11 testes aprovados em 1.18s)
npx vitest run test/auth.limiter.test.ts             → PASSOU (3 testes aprovados em 1.96s)
npm audit                                            → PASSOU (0 vulnerabilidades encontradas)
Teste de origem autorizada                           → PASSOU (status 200 e header retornado)
Teste de origem não autorizada (bloqueio CORS)       → PASSOU (status 403 Forbidden)
Teste de requisição sem Origin (curl/CLI)             → PASSOU (status 200 sem restrição)
Teste de Preflight OPTIONS autorizado                → PASSOU (status 204 com headers CORS)
Teste de Preflight OPTIONS não autorizado            → PASSOU (status 403 Forbidden)
```

### 6. Evidências

* **Execução dos testes automatizados da TASK 03 (`vitest`):**
``` text
 RUN  v4.1.5 C:/Users/anamo/.gemini/antigravity/worktrees/project-vtx/implement_third_task_scope

 ✓ test/cors.test.ts > CORS Policy Middleware (TASK 03) > Funções utilitárias de CORS > deve retornar origens de desenvolvimento por padrão quando em ambiente não-produção 4ms
 ✓ test/cors.test.ts > CORS Policy Middleware (TASK 03) > Funções utilitárias de CORS > deve carregar origens personalizadas da variável CORS_ALLOWED_ORIGINS 2ms
 ✓ test/cors.test.ts > CORS Policy Middleware (TASK 03) > Funções utilitárias de CORS > deve retornar lista vazia em produção se CORS_ALLOWED_ORIGINS não estiver configurado 1ms
 ✓ test/cors.test.ts > CORS Policy Middleware (TASK 03) > Funções utilitárias de CORS > deve considerar válida requisição sem header Origin 1ms
 ✓ test/cors.test.ts > CORS Policy Middleware (TASK 03) > Funções utilitárias de CORS > deve validar corretamente se a origem está na whitelist 1ms
 ✓ test/cors.test.ts > CORS Policy Middleware (TASK 03) > Integração HTTP com o Express (app) > deve permitir requisição de origem autorizada e retornar cabeçalho Access-Control-Allow-Origin 22ms
 ✓ test/cors.test.ts > CORS Policy Middleware (TASK 03) > Integração HTTP com o Express (app) > deve bloquear requisição de origem não autorizada com HTTP 403 Forbidden 5ms
 ✓ test/cors.test.ts > CORS Policy Middleware (TASK 03) > Integração HTTP com o Express (app) > deve permitir requisições sem cabeçalho Origin (CLI, curl, mobile) 4ms
 ✓ test/cors.test.ts > CORS Policy Middleware (TASK 03) > Integração HTTP com o Express (app) > deve responder preflight OPTIONS com sucesso para origem autorizada 6ms
 ✓ test/cors.test.ts > CORS Policy Middleware (TASK 03) > Integração HTTP com o Express (app) > deve bloquear preflight OPTIONS para origem não autorizada com HTTP 403 7ms
 ✓ test/cors.test.ts > CORS Policy Middleware (TASK 03) > Integração HTTP com o Express (app) > deve respeitar a flag CORS_CREDENTIALS=true quando ativada 5ms

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Duration  1.18s
```

* **Resposta HTTP capturada em tentativa de acesso cross-origin não autorizada:**
``` http
HTTP/1.1 403 Forbidden
Content-Type: application/json; charset=utf-8

{
  "error": "Origem não permitida pela política de CORS."
}
```

* **Resposta HTTP capturada em requisição com origem autorizada:**
``` http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://trusted-domain.com
Vary: Origin
Content-Type: application/json; charset=utf-8

{
  "status": "running"
}
```

* **Resposta HTTP capturada em preflight OPTIONS com origem autorizada:**
``` http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://trusted-domain.com
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization,X-Requested-With
Access-Control-Max-Age: 86400
Vary: Origin, Access-Control-Request-Headers
```

### 7. Problemas encontrados

``` text
Nenhum problema encontrado durante a implementação do CORS.
```

### 8. Riscos ou pontos para revisão

* **Configuração em Produção:** Garantir que o ambiente de produção defina explicitamente `CORS_ALLOWED_ORIGINS` com a lista de domínios dos frontends válidos (ex.: `https://app.meudominio.com,https://admin.meudominio.com`), pois em `NODE_ENV=production` as portas locais (`localhost`) são desabilitadas por padrão.
* **Débito Técnico Pré-existente (Prisma Client):** Conforme mapeado no README do projeto e no plano da Sprint 3 (Item 7), a geração do cliente Prisma possui inconsistência de versões no repositório (`prisma` 6.12 vs `@prisma/client` 7.10) e a suíte `test/client.test.ts` requer atualização de caminhos de importação. Essas pendências pré-existentes não afetam o módulo de CORS nem os testes da Sprint 1 e continuam alocadas para a Sprint 3.

### 9. Arquivos ou alterações que NÃO foram realizados

* Não foram alterados controllers, regras de negócio ou modelos do banco de dados, mantendo o foco estrito na política de CORS e no desacoplamento da rota utilitária `/health`.

### 10. Perguntas / bloqueios

Nenhum bloqueio identificado. A TASK 03 atende integralmente a todos os critérios de aceite estabelecidos no plano de execução da sprint.
