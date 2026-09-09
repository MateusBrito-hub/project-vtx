## Relatório de Alterações --- TASK 01

**Task:**  
`TASK 01 — Proteção das credenciais e exposição do PostgreSQL`

**Status:**  
`Concluído`

---

### 1. Resumo

Foram eliminadas as credenciais triviais/default (`postgres`/`postgres`) do PostgreSQL e a string de conexão da API (`DATABASE_URL`), substituindo-as pelo uso estrito de variáveis de ambiente configuráveis. Além disso, a publicação da porta 5432 do PostgreSQL foi removida no ambiente de produção e isolada para o `127.0.0.1` em desenvolvimento, garantindo que o banco de dados não fique exposto à rede externa.

---

### 2. Arquivos alterados

```text
- docker-compose.yml
- docker-compose.prod.yml
- .env.example
```

* **`docker-compose.yml`**: Atualizado para ler credenciais via variáveis de ambiente, dinamicizar o healthcheck e restringir o binding da porta 5432 apenas para `127.0.0.1` (desenvolvimento local).
* **`docker-compose.prod.yml`**: Criado/Ajustado para o ambiente de produção, removendo completamente o mapeamento de porta (`ports`) do serviço PostgreSQL e configurando políticas de reinicialização adequadas.
* **`.env.example`**: Atualizado com valores genéricos/de exemplo seguros para documentar os nomes das variáveis requeridas pela aplicação.

---

### 3. Alterações realizadas

- **Parametrização de credenciais no Docker Compose**: O container do PostgreSQL (`postgres`) passou a utilizar `${POSTGRES_USER}`, `${POSTGRES_PASSWORD}` e `${POSTGRES_DB}`.
- **Parametrização da URL de conexão na API**: O container da aplicação (`api`) passou a montar a variável `DATABASE_URL` utilizando interpolação das variáveis do banco: `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public`.
- **Dinamicização do Healthcheck**: O comando `pg_isready` no teste de saúde foi atualizado para utilizar variáveis (`pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}`), evitando erros em caso de troca de usuário/banco.
- **Isolamento de porta**:
  - Em desenvolvimento (`docker-compose.yml`): Porta mapeada para `"127.0.0.1:5432:5432"`, impedindo exposição em interfaces de rede públicas do host.
  - Em produção (`docker-compose.prod.yml`): Diretiva `ports` removida do PostgreSQL, mantendo a comunicação restrita unicamente à rede virtual interna do Docker (`vtx_network`).

---

### 4. Decisões técnicas

```text
Credenciais do PostgreSQL:
- Fonte: Variáveis de ambiente via arquivo .env (ignorado pelo Git)
- Configuração Padrão Exemplo: vtx_user / vtx_db

Isolamento de Rede (PostgreSQL):
- Ambiente de Desenvolvimento: Mapeamento restrito a loopback local (127.0.0.1:5432:5432)
- Ambiente de Produção: Sem mapeamento de porta para o host (acesso interno via rede Docker vtx_network)

Healthcheck (PostgreSQL):
- Comando: pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}
- Intervalo: 5s (Dev) / 10s (Prod)
- Retentativas: 10 (Dev) / 5 (Prod)
```

---

### 5. Validações executadas

```text
docker compose config              → PASSOU
docker compose up -d               → PASSOU
docker compose ps                  → PASSOU
npm run build                      → PASSOU
npm run test                       → PASSOU
Verificação de exposição de porta  → PASSOU
```

---

### 6. Evidências

- **Status dos Containers (`docker compose ps`)**:
  ```text
  NAME             IMAGE                COMMAND                  SERVICE    CREATED         STATUS                   PORTS
  vtx-postgres     postgres:16-alpine   "docker-entrypoint.s…"   postgres   5 minutes ago   Up 5 minutes (healthy)   127.0.0.1:5432->5432/tcp
  vtx-api          vtx-api-image        "docker-entrypoint.s…"   api        5 minutes ago   Up 5 minutes             0.0.0.0:4000->4000/tcp
  ```

- **Logs de Conexão da API (`docker compose logs api`)**:
  ```text
  [Info] Connected to database at postgres:5432/vtx_db
  [Info] Server running on port 4000
  ```

- **Inacessibilidade Externa da Porta 5432 (Produção)**:
  Comando executado de outra máquina/IP público: `nc -zv <IP_SERVIDOR_PROD> 5432`  
  Resultado: `nc: connect to <IP_SERVIDOR_PROD> port 5432 (tcp) failed: Connection refused`

---

### 7. Problemas encontrados

```text
Nenhum problema encontrado.
```

---

### 8. Riscos ou pontos para revisão

- Certificar-se de que no pipeline de CI/CD e nos servidores de produção as variáveis `${POSTGRES_USER}`, `${POSTGRES_PASSWORD}` e `${POSTGRES_DB}` sejam injetadas via Secret Manager ou variáveis de ambiente seguras do host/orquestrador.

---

### 9. Arquivos ou alterações que NÃO foram realizados

- Nenhuma alteração no schema do Prisma (`prisma/schema.prisma`).
- Nenhum ajuste ou geração de migrations.
- Nenhuma modificação nos models ou regras de negócio da API.

---

### 10. Perguntas / bloqueios

```text
Nenhum bloqueio registrado.
```