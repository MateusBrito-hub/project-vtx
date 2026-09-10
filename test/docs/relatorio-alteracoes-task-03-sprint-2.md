## Relatório de Alterações — TASK 03 (Sprint 2)

**Task:**  
`TASK 03 (Sprint 2) — Blindagem do Dockerfile de Produção (Multi-Stage e Non-Root)`

**Status:**  
`Concluído`

---

### 1. Resumo

Foi realizada a reestruturação e blindagem completa da infraestrutura de conteinerização da aplicação através da reescrita do [Dockerfile](file:///c:/_Brito/project-vtx/Dockerfile) e atualização do [.dockerignore](file:///c:/_Brito/project-vtx/.dockerignore). A imagem anterior de desenvolvimento rodava como superusuário (`root`), continha utilitários desnecessários (`git`, `bash`, `openssh`), acumulava dependências de desenvolvimento (`devDependencies`) e iniciava a aplicação via `npm run dev` com hot-reload (`ts-node-dev`). Com a nova implementação, adotou-se o padrão **Multi-Stage Build** (estágios `builder` e `runner`), a execução sob usuário não-root nativo (`USER node`), redução drástica da superfície de ataque (tamanho de conteúdo de apenas 161 MB), isolamento seguro de arquivos de ambiente/testes no `.dockerignore`, e inicialização direta do runtime JavaScript compilado com migrações determinísticas (`prisma migrate deploy && node dist/index.js`).

---

### 2. Arquivos alterados

```text
- Dockerfile
- .dockerignore
```

* **`Dockerfile`**: Reescrito inteiramente dividindo o fluxo de compilação e execução em dois estágios independentes (`builder` e `runner`), configurando instalação seletiva de dependências de produção (`--omit=dev`), resolução de compatibilidade do Prisma Client em `dist/generated`, concessão de posse ao usuário `node:node`, imposição do usuário `USER node` e entrypoint de produção.
* **`.dockerignore`**: Expandido para impedir que segredos e arquivos de suporte subam acidentalmente para o contexto de build do Docker (`.env`, `.env.*`, `relatorios`, `test`, `*.md`, `dist`, `coverage`, `node_modules`).

---

### 3. Alterações realizadas

1. **Multi-Stage Build (Separação Builder / Runner)**:
   - **Estágio `builder` (`FROM node:20-alpine AS builder`)**:
     - Instalação das dependências integrais com `--legacy-peer-deps`.
     - Cópia do `prisma/`, `tsconfig.json` e `src/`.
     - Execução de `npx prisma generate` gerando os artefatos de modelo em `src/generated`.
     - Execução do build TypeScript (`npm run build`) gerando o código transpilado em `dist/`.
     - Cópia de integridade `cp -r src/generated dist/generated` garantindo que o `require('../../generated/prisma/client')` encontre os artefatos compilados em runtime.
   - **Estágio `runner` (`FROM node:20-alpine AS runner`)**:
     - Base minimalista e limpa `node:20-alpine`, sem pacotes de compilação ou ferramentas de rede adicionais (`bash`, `git`, `openssh` foram removidos).
     - Instalação exclusiva de dependências de produção com `npm install --omit=dev --legacy-peer-deps`.
     - Cópia restrita dos artefatos compilados (`COPY --from=builder /usr/src/app/dist ./dist`) e schema (`COPY --from=builder /usr/src/app/prisma ./prisma`). O diretório `src/` e `tsconfig.json` foram eliminados da imagem final.
2. **Princípio do Menor Privilégio (Non-Root User)**:
   - Configurado `chown -R node:node /usr/src/app`.
   - Adicionada a diretiva `USER node` antes da exposição da porta e execução do comando final, garantindo que o processo Node.js execute com UID/GID 1000.
3. **Comando de Inicialização Seguro e Determinístico**:
   - Substituído `CMD ["npm", "run", "dev"]` por:
     ```dockerfile
     CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
     ```
   - Garante que nenhuma migração interativa de desenvolvimento (`migrate dev`) seja chamada em produção e executa diretamente os binários JavaScript compilados em `dist/index.js`.
4. **Blindagem de Contexto no `.dockerignore`**:
   - Inclusão explícita de `.env`, `.env.*`, `relatorios`, `test`, `*.md`, além dos pré-existentes `dist`, `node_modules`, `npm-debug.log`, `.gitignore` e `coverage`.

---

### 4. Decisões técnicas

```text
Configuração de Imagem:
- Imagem Base: node:20-alpine (estável e leve)
- Padrão de Compilação: Multi-Stage Build (builder e runner)
- Usuário de Execução: node (UID 1000, GID 1000)
- Isolamento do Prisma Client: Cópia direta de src/generated para dist/generated no builder
- Gerenciamento de Dependências: npm install --omit=dev --legacy-peer-deps no runner
- Entrypoint: sh -c "npx prisma migrate deploy && node dist/index.js"
- Porta Exposta: 4000
```

---

### 5. Validações executadas

```text
npm run build                                                    → PASSOU (compilação limpa tsc, saída 0)
Suíte Integrada de Testes (5 arquivos / 22 testes)              → PASSOU (100% de testes aprovados em 3.61s)
docker build -t vtx-api:prod .                                   → PASSOU (Multi-stage build bem-sucedido)
docker run --rm vtx-api:prod whoami                              → PASSOU (retornou "node")
docker run --rm vtx-api:prod id                                  → PASSOU (uid=1000(node) gid=1000(node))
docker compose config                                            → PASSOU (sintaxe válida e integrada)
```

---

### 6. Evidências

- **Confirmação de Usuário Non-Root no Container (`whoami` e `id`)**:
  ```text
  > docker run --rm vtx-api:prod whoami
  node

  > docker run --rm vtx-api:prod id
  uid=1000(node) gid=1000(node) groups=1000(node),1000(node)
  ```

- **Inspeção de Diretórios e Permissões Internas do Container**:
  ```text
  > docker run --rm vtx-api:prod ls -la /usr/src/app
  total 224
  drwxr-xr-x    1 node     node          4096 Sep 10 00:08 .
  drwxr-xr-x    1 root     root          4096 May  7 03:08 ..
  drwxr-xr-x    1 node     node          4096 Sep 10 00:08 dist
  drwxr-xr-x    1 node     node          4096 Sep 10 00:07 node_modules
  -rwxr-xr-x    1 node     node        202014 Sep 10 00:07 package-lock.json
  -rwxr-xr-x    1 node     node          1626 Sep  9 02:16 package.json
  drwxr-xr-x    1 node     node          4096 Sep  3 13:38 prisma
  ```
  *(Nota: Inexistência de arquivos sensíveis como `.env`, ausência do diretório `src/`, suíte de testes `test/`, e ausência de ferramentas de desenvolvimento)*.

- **Eficiência e Compactação da Imagem de Produção**:
  ```text
  IMAGE          ID             DISK USAGE   CONTENT SIZE
  vtx-api:prod   7b6ffe319522        644MB          161MB
  ```

- **Regressão Integral dos Testes Unitários e de Segurança**:
  ```text
   RUN  v4.1.11 C:/_Brito/project-vtx

   Test Files  5 passed (5)
        Tests  22 passed (22)
     Duration  3.61s
  ```

---

### 7. Problemas encontrados

- **Mapeamento de Import do Prisma Client Compilado**:  
  O Prisma gera o cliente dentro de `src/generated/prisma`. Quando o TypeScript compila o código para `dist/`, o `dist/shared/database/prisma.js` executa `require('../../generated/prisma/client')`. Como o `tsc` compila apenas arquivos TypeScript e não copia artefatos `.js`/`.wasm` pré-existentes de `src/`, a resolução falharia em runtime. A solução adotada no estágio `builder` (`RUN cp -r src/generated dist/generated`) sanou a dependência de forma segura e elegante antes do deploy.

---

### 8. Riscos ou pontos para revisão

- **Prisma Engine e Usuário Non-Root**:  
  A geração do client em tempo de build (`npx prisma generate`) garante que os binários da engine nativa de query do Alpine Linux já estejam embutidos no filesystem com permissão adequada de leitura para o usuário `node`.
- **Migrações na Inicialização**:  
  O comando `npx prisma migrate deploy` requer que o banco de dados PostgreSQL esteja acessível no momento da subida do container. No `docker-compose.yml`, o `depends_on` com `condition: service_healthy` garante essa sincronia com o container de banco de dados.

---

### 9. Arquivos ou alterações que NÃO foram realizados

- Não foi alterada a porta da aplicação (`4000`).
- Não foram modificadas regras de negócio em `src/`.
- Não foram alteradas as configurações de rede do `docker-compose.yml`.

---

### 10. Perguntas / bloqueios

- Nenhum bloqueio. A infraestrutura de build e conteinerização atende a todos os critérios de aceite estabelecidos no plano de execução da Sprint 2.
