## Relatório de Alterações — TASK 02 (Sprint 4)

**Task:**  
`TASK 02 (Sprint 4) — Configuração de trust proxy para Ambientes de Produção`

**Status:**  
`Concluído`

---

### 1. Resumo

Foi configurada a diretiva `app.set('trust proxy', 1)` no arquivo [src/app.ts](file:///c:/_Brito/project-vtx/src/app.ts) para que a API `project-vtx` opere de forma segura e transparente em ambientes de produção que utilizam balanceadores de carga, API Gateways ou proxies reversos (como AWS ALB, Cloudflare, Traefik, Nginx ou Ingress do Kubernetes/Docker). 

Sem essa diretiva, o Express ignora o cabeçalho `X-Forwarded-For` e identifica todas as requisições remotas através do endereço IP da interface do proxy reverso. Esse comportamento inadequado unifica incorretamente a contagem do rate limiter (`loginRateLimiter` em [src/modules/auth/auth.limiter.ts](file:///c:/_Brito/project-vtx/src/modules/auth/auth.limiter.ts)) para todos os usuários externos, criando vulnerabilidade a ataques de negação de serviço (DoS) acidentais ou induzidos. Com a parametrização explícita do 1º hop reverso (`trust proxy = 1`), o Express passa a popular `req.ip` com o IP real do cliente final.

---

### 2. Arquivos alterados

```text
- src/app.ts
```

* **`src/app.ts`**: Inserção de `app.set('trust proxy', 1)` imediatamente após a instanciação do aplicativo Express (`export const app = express()`), antes de qualquer middleware de segurança e dos roteadores da API.

---

### 3. Alterações realizadas

1. **Configuração de Confiança do 1º Hop de Proxy Reverso**:
   - Adicionada a instrução `app.set('trust proxy', 1)` em `src/app.ts`.
   - Garantido que o Express resolva o IP do cliente avaliando o cabeçalho `X-Forwarded-For` de forma estrita para 1 hop intermediário.
2. **Homologação com os Middlewares de Segurança**:
   - Validada a interoperabilidade com `helmet`, `corsMiddleware` e `express.json()`.
   - Validada a integridade da suíte de testes de rate limiting (`test/auth.limiter.test.ts`), garantindo que o bloqueio contra força bruta em `POST /auth/login` permaneça efetivo e sem quebras.

---

### 4. Decisões técnicas

```text
Estratégia de Configuração de Proxy Reverso:
- Parâmetro Configurado: 1 (Número inteiro estrito indicando 1 hop reverso)
- Justificativa de Segurança: Configurar '1' é a recomendação técnica de hardening para serviços conteinerizados atrás de um reverse proxy/load balancer único (ex.: AWS ALB, Cloudflare ou Nginx). Habilitar 'true' genericamente tornaria a API vulnerável a IP spoofing se clientes externos injetassem cabeçalhos X-Forwarded-For arbitrários com múltiplos IPs forjados.
- Integração de Rate Limiting: O middleware express-rate-limit consome nativamente req.ip do Express, beneficiando-se imediatamente da resolução correta do IP.
```

---

### 5. Validações executadas

```text
npm run build                                                    → PASSOU (compilação TypeScript tsc limpa, código 0)
npx vitest run test/auth.limiter.test.ts                         → PASSOU (3/3 testes aprovados em 1.21s)
npm test -- --run (Execução Global Unificada)                   → PASSOU (9 arquivos / 53 testes aprovados em 3.90s)
```

---

### 6. Evidências

- **Compilação TypeScript Verificada (`dist/app.js`)**:
  ```javascript
  exports.app = (0, express_1.default)();
  exports.app.set('trust proxy', 1);
  exports.app.use((0, helmet_1.default)({
  ```

- **Execução Focada da Suíte de Rate Limiter (`test/auth.limiter.test.ts`)**:
  ```text
   RUN  v4.1.11 C:/_Brito/project-vtx

   Test Files  1 passed (1)
        Tests  3 passed (3)
     Duration  1.21s
  ```

- **Execução Global Unificada de Toda a Aplicação (`npm test -- --run`)**:
  ```text
   RUN  v4.1.11 C:/_Brito/project-vtx

   ✓ test/helmet.test.ts (2 tests)
   ✓ test/plan.schema.test.ts (6 tests)
   ✓ test/auth.logout.test.ts (5 tests)
   ✓ test/client.pii.test.ts (4 tests)
   ✓ test/error-handling.test.ts (2 tests)
   ✓ test/client.test.ts (16 tests)
   ✓ test/auth.limiter.test.ts (3 tests)
   ✓ test/subscription.schema.test.ts (5 tests)
   ✓ test/cors.test.ts (11 tests)

   Test Files  9 passed (9)
        Tests  53 passed (53)
     Duration  3.90s
  ```

---

### 7. Problemas encontrados

- Nenhum problema, regressão ou incompatibilidade identificados durante a alteração ou execução das suítes de testes.

---

### 8. Riscos ou pontos para revisão

- **Ambientes Locais e Ambientes Sem Proxy**:
  Em ambientes de desenvolvimento local sem proxy reverso intermediário, o Express mantém o comportamento padrão via socket (`127.0.0.1` ou `::1`), assegurando funcionamento idêntico e sem impactos.

---

### 9. Arquivos ou alterações que NÃO foram realizados

- Nenhuma alteração foi necessária em `src/modules/auth/auth.limiter.ts`, uma vez que a biblioteca `express-rate-limit` já extrai o IP diretamente da propriedade `req.ip` tratada pelo Express.

---

### 10. Perguntas / bloqueios

- Nenhum bloqueio. A TASK 02 (Sprint 4) está formalmente homologada e concluída. A Sprint 4 está apta para avançar para a **TASK 03 (Sprint 4) — Homologação Integrada em Container Docker e Healthcheck**.
