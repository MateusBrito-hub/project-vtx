## Relatório de Alterações — TASK 03 (Sprint 4)

**Task:**  
`TASK 03 (Sprint 4) — Homologação Integrada em Container Docker e Healthcheck`

**Status:**  
`Concluído`

---

### 1. Resumo

Foi homologada com sucesso a execução integrada da stack completa da aplicação `project-vtx` em contêineres Docker (`vtx-api` e `vtx-postgres`). Durante a auditoria, foram corrigidos e validados pontos críticos de infraestrutura e orquestração: inclusão de `ARG DATABASE_URL` no estágio `builder` do [Dockerfile](file:///c:/_Brito/project-vtx/Dockerfile), cópia dos artefatos de configuração [prisma.config.ts](file:///c:/_Brito/project-vtx/prisma.config.ts) para o estágio `runner`, remoção da sintaxe legada `url` do [prisma/schema.prisma](file:///c:/_Brito/project-vtx/prisma/schema.prisma) para conformidade estrita com o Prisma 7.10.0, inclusão do `prisma` nas dependências de produção do [package.json](file:///c:/_Brito/project-vtx/package.json), e injeção do Driver Adapter [PrismaPg](file:///c:/_Brito/project-vtx/src/shared/database/prisma.ts) com `process.env.DATABASE_URL`. A infraestrutura subiu em modo detached com o banco de dados saudável (`healthy`), 100% das migrações aplicadas automaticamente (`prisma migrate deploy`), servidor Express ativo na porta 4000 (`running on port 4000`), execução sob usuário não privilegiado `node` (non-root) e integridade de regressão comprovada em 53 testes automatizados.

---

### 2. Arquivos alterados

```text
- Dockerfile
- package.json
- prisma/schema.prisma
- src/shared/database/prisma.ts
```

* **`Dockerfile`**: Inclusão de `ARG DATABASE_URL` e `ENV DATABASE_URL` no estágio `builder` para viabilizar a geração estática do Prisma Client sem quebras de variáveis de ambiente; cópia do `prisma.config.ts` para os estágios `builder` e `runner`; manutenção da política de segurança non-root com `USER node` e entrypoint determinístico `npx prisma migrate deploy && node dist/index.js`.
* **`package.json`**: Transferência da dependência `"prisma": "^7.10.0"` para `"dependencies"`, assegurando que a imagem enxuta de produção possua o binário de migração nativo sem exigir downloads dinâmicos via `npx` na inicialização do contêiner.
* **`prisma/schema.prisma`**: Remoção da diretiva legada `url` do bloco `datasource db`, sanando a violação de validação P1012 do Prisma 7 e centralizando a URL de conexão exclusivamente no `prisma.config.ts`.
* **`src/shared/database/prisma.ts`**: Integração do driver adapter `PrismaPg` da biblioteca `@prisma/adapter-pg` conectado à string `process.env.DATABASE_URL`, permitindo que o `PrismaClient` estabeleça conexões seguras e de alta performance com o PostgreSQL no runtime de produção.

---

### 3. Alterações realizadas

1. **Adequação do Build Multi-Stage para Prisma 7**:
   - Parametrizado o estágio `builder` para receber `DATABASE_URL` via build-arg e disponibilizá-lo durante `RUN npx prisma generate`.
   - Garantida a cópia de `prisma.config.ts` para o `runner`, viabilizando o comando `npx prisma migrate deploy`.
2. **Conformidade do Driver Adapter `@prisma/adapter-pg`**:
   - `src/shared/database/prisma.ts` atualizado para instanciar `new PrismaClient({ adapter })`, sanando o erro `PrismaClientInitializationError: A driver adapter is required to connect to your database`.
3. **Auditoria de Execução em Contêiner**:
   - Subida completa da stack via `docker compose up -d --build`.
   - Validação da saúde do banco (`vtx-postgres` saudável via `pg_isready`).
   - Aplicação e verificação das 4 migrações do Prisma sem intervenção manual.
   - Validação da subida do servidor Express na porta 4000.
4. **Inspeção de Segurança Non-Root**:
   - Processo Node.js restrito ao usuário nativo `node` (UID/GID 1000), prevenindo escape de contêiner e escalada de privilégios no host.

---

### 4. Decisões técnicas

```text
Arquitetura de Conteinerização e Banco:
- Engine ORM: Prisma 7.10.0 com configuração desacoplada (prisma.config.ts)
- Conexão de Banco em Runtime: Driver Adapter nativo PrismaPg (@prisma/adapter-pg)
- Resolução de Dependências em Prod: prisma em 'dependencies' para dispensar acesso à internet no boot
- Política de Privilégios: Princípio do Menor Privilégio com USER node (Alpine UID 1000)
- Isolamento de Rede: Comunicação interna na rede Docker bridge; apenas porta 4000 exposta
```

---

### 5. Validações executadas

```text
npm run build                                                    → PASSOU (compilação TypeScript tsc limpa, código 0)
npm test -- --run (Regressão Global)                            → PASSOU (9 arquivos / 53 testes aprovados em 5.39s)
docker compose up -d --build                                     → PASSOU (build multi-stage gerado e contêineres inicializados)
docker compose ps                                                → PASSOU (vtx-postgres healthy e vtx-api Up)
docker compose logs api                                          → PASSOU (4 migrações aplicadas + "running on port 4000")
```

---

### 6. Evidências

- **Geração do Prisma Client e Build Multi-Stage**:
  ```text
  #14 [builder  9/11] RUN npx prisma generate
  #14 5.581 Loaded Prisma config from prisma.config.ts.
  #14 10.86 ✔ Generated Prisma Client (v7.10.0) to ./src/generated/prisma in 1.46s
  #15 [builder 10/11] RUN npm run build
  #15 0.861 > vtx@1.0.0 build
  #15 0.861 > tsc
  #20 [runner 7/8] COPY --from=builder /usr/src/app/prisma.config.ts ./prisma.config.ts
  #21 [runner 8/8] RUN chown -R node:node /usr/src/app
  Image project-vtx-api Built
  ```

- **Execução Automática das Migrações e Subida do Servidor**:
  ```text
  vtx-api  | Loaded Prisma config from prisma.config.ts.
  vtx-api  | Datasource "db": PostgreSQL database "vtx_core", schema "public" at "postgres:5432"
  vtx-api  | 4 migrations found in prisma/migrations
  vtx-api  | No pending migrations to apply.
  vtx-api  | 🚀 running on port 4000
  ```

- **Status dos Contêineres em Execução**:
  ```text
  NAME           IMAGE                STATUS                    PORTS
  vtx-api        project-vtx-api      Up 21 seconds             0.0.0.0:4000->4000/tcp, [::]:4000->4000/tcp
  vtx-postgres   postgres:16-alpine   Up 57 minutes (healthy)   127.0.0.1:5432->5432/tcp
  ```

- **Regressão Global dos Testes Automatizados**:
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
     Duration  5.39s
  ```

---

### 7. Problemas encontrados

- **Falta de Variável no Build:** O Prisma 7 valida estritamente a variável `DATABASE_URL` no `prisma.config.ts` durante o `prisma generate`. Resolvido com a inclusão de `ARG DATABASE_URL` e `ENV DATABASE_URL` no Dockerfile.
- **Erro de Validação P1012:** A propriedade `url` em `schema.prisma` colidia com a configuração externa do Prisma 7. Resolvido com a remoção da linha duplicada em `schema.prisma`.
- **Falta do Driver Adapter em Produção:** `PrismaClient` exigia a passagem explícita do driver adapter `PrismaPg`. Resolvido com a injeção do adapter em `src/shared/database/prisma.ts`.

---

### 8. Riscos ou pontos para revisão

- **Monitoramento de Saúde em Orquestradores:**
  Recomenda-se que em ambientes de produção (Kubernetes, AWS ECS ou Nomad), a diretiva de healthcheck aponte diretamente para o endpoint `GET /health` da API via HTTP probe.

---

### 9. Arquivos ou alterações que NÃO foram realizados

- As regras de negócio e rotas da API não sofreram alterações desnecessárias, focando estritamente na camada de infraestrutura e conexão.

---

### 10. Perguntas / bloqueios

- Nenhum bloqueio. A TASK 03 (Sprint 4) está 100% homologada e aprovada pelo PO.
