# Plano de Execução — Sprint 1 (Tenant) do `project-vtx`
## Fundação Multi-Tenant, Banco Dedicado e Certificados Digitais A1

| Metadado | Detalhe |
|---|---|
| **Sprint** | 1 (Tenant) — Fundação Multi-Tenant, Banco Dedicado e Certificados Digitais A1 |
| **Projeto** | `MateusBrito-hub/project-vtx` (Módulo `src/modules/tenant/`) |
| **Branch base** | `master` |
| **Perfil de execução** | Desenvolvedor independente |
| **Duração de referência** | 1 semana |
| **Documentos de Referência** | `test/docs/escopo-projeto-vtx-tenant.md` e `test/docs/especificacao-sistema-tenant-fiscal.md` |

---

## 1. Objetivo da Sprint 1 (Tenant)

Estabelecer a fundação arquitetural e de infraestrutura do sistema do tenant dentro do monorepo, permitindo que a API atenda requisições roteadas dinamicamente para o banco de dados dedicado de cada cliente (`vtx_<slug>`) e forneça a gestão segura e criptografada do Certificado Digital A1.

---

## 2. Forma de Trabalho e Governança

* Cada task possui escopo fechado, critérios de aceite estritos e comandos de validação automatizados.
* O desenvolvedor implementa a task, roda as validações e realiza o commit.
* O PO audita o código e os testes, e emite o relatório formal de alterações correspondente.
* Uma task só é considerada concluída quando o código estiver testado e o relatório entregue.

---

## 3. Ordem de Execução das Tasks

| Ordem | Task | Foco | Prioridade | Esforço | Dependências |
|:---:|---|---|:---:|:---:|:---:|
| **1** | **TASK 01 (Tenant)** | Estrutura Modular e Roteador Dinâmico de Conexões (`TenantConnectionManager`) | 🔴 Alta | Médio | Nenhuma |
| **2** | **TASK 02 (Tenant)** | Schema do Banco Dedicado e Migrações Automatizadas de Tenant | 🔴 Alta | Médio | Task 01 |
| **3** | **TASK 03 (Tenant)** | Módulo de Certificado Digital A1 com Criptografia em Repouso (AES-256-GCM) | 🟠 Alta | Médio | Task 02 |
| **4** | **TASK 04 (Tenant)** | Middleware de Resolução de Tenant, Endpoints de Configuração e Fechamento | 🟡 Média | Médio | Tasks 01, 02 e 03 |

---

# TASK 01 (Tenant) — Estrutura Modular e Roteador Dinâmico de Conexões (`TenantConnectionManager`)

## Prioridade
🔴 **Alta**

## Objetivo
Criar a infraestrutura em `src/modules/tenant/config/tenant-connection.ts` capaz de instanciar, armazenar em cache e gerenciar dinamicamente pools de conexão PostgreSQL e clientes Prisma dedicados para cada tenant (`vtx_<slug>`), sem risco de vazamento de conexões ou contaminação cruzada de dados.

## Escopo
1. Criar o diretório modular `src/modules/tenant/`.
2. Implementar `src/modules/tenant/config/tenant-connection.ts`:
   - Resolução da connection string: substitui o banco padrão da `DATABASE_URL` por `vtx_<slug>`.
   - Gerenciamento de pool: mantém instâncias em Map com timeout de inatividade para fechamento gracioso.
   - Fornece a função `getTenantPrisma(slug: string)` ou `getTenantPool(slug: string)`.
3. Criar suíte de testes unitários `test/tenant.connection.test.ts` cobrindo criação de conexão, cache de instâncias para o mesmo slug e isolamento entre slugs distintos.

## Critérios de Aceite
- [ ] Conexões para slugs diferentes apontam comprovadamente para bancos distintos (`vtx_slug_a` vs `vtx_slug_b`).
- [ ] Chamadas sucessivas para o mesmo slug reutilizam a conexão existente do pool (cache).
- [ ] Slugs inválidos ou inexistentes são tratados com erro amigável sem derrubar o processo.
- [ ] Testes automatizados cobrindo a resolução de conexão com 100% de aprovação.

## Validações Obrigatórias
```bash
npm run build
npx vitest run test/tenant.connection.test.ts
npm test -- --run
```

---

# TASK 02 (Tenant) — Schema do Banco Dedicado e Migrações de Tenant

## Prioridade
🔴 **Alta**

## Objetivo
Criar a modelagem de dados do banco dedicado em `prisma/tenant.prisma` contemplando as tabelas fiscais da Reforma Tributária (Configurações, Clientes, Produtos, Documentos com IBS/CBS e Pagamentos/Split Payment) e um executor automatizado de migrações para bancos de novos tenants.

## Escopo
1. Criar `prisma/tenant.prisma` com os modelos definidos na especificação técnica:
   - `FiscalConfig`, `Customer`, `Product`, `FiscalDocument`, `FiscalDocumentItem`, `FiscalPayment`, `FiscalEvent`.
2. Configurar o gerador Prisma Client para o tenant com output em `src/generated/tenant-prisma`.
3. Adicionar script/helper `runTenantMigrations(slug: string)` para aplicar as tabelas estruturais automaticamente no banco recém-provisionado `vtx_<slug>`.

## Critérios de Aceite
- [ ] Schema `prisma/tenant.prisma` compila e gera o cliente dedicado via `npx prisma generate`.
- [ ] Modelagem de itens possui campos nativos para IBS (Estadual/Municipal), CBS (Federal) e Imposto Seletivo (IS).
- [ ] Build TypeScript executa sem erros de tipos.

## Validações Obrigatórias
```bash
npm run build
npm test -- --run
```

---

# TASK 03 (Tenant) — Módulo de Certificado Digital A1 com Criptografia em Repouso

## Prioridade
🟠 **Alta**

## Objetivo
Implementar o serviço de ingestão, validação, extração de chaves e armazenamento seguro do Certificado Digital A1 (`.pfx` / `.p12`) utilizando Envelope Encryption com AES-256-GCM.

## Escopo
1. Criar `src/modules/tenant/certificate/certificate.crypto.ts`:
   - Criptografia simétrica com chave derivada via HKDF (`AES-256-GCM`).
   - Geração de IV aleatório e autenticação por auth tag.
2. Criar `src/modules/tenant/certificate/certificate.parser.ts`:
   - Leitura do arquivo `.pfx` binário utilizando a senha fornecida (via `node-forge` ou `crypto` nativo).
   - Extração do CNPJ titular, Razão Social, data de início e data de expiração.
   - Validação de expiração (rejeita certificados já expirados).
3. Criar a suíte de testes `test/tenant.certificate.test.ts`.

## Critérios de Aceite
- [ ] Senha e binário PFX nunca são salvos em texto plano no banco de dados.
- [ ] Parser extrai corretamente CNPJ e data de expiração do certificado.
- [ ] Tentativas de descriptografia com tag adulterada disparam erro de autenticidade (GCM tag mismatch).
- [ ] Testes unitários com 100% de aprovação.

## Validações Obrigatórias
```bash
npm run build
npx vitest run test/tenant.certificate.test.ts
npm test -- --run
```

---

# TASK 04 (Tenant) — Middleware de Resolução de Tenant, Endpoints de Configuração e Fechamento

## Prioridade
🟡 **Média**

## Objetivo
Integrar o middleware de resolução de tenant (`tenantMiddleware`) na esteira HTTP da API, disponibilizar os endpoints REST de configuração fiscal e upload de certificados, e realizar a validação global de fechamento da Sprint 1.

## Escopo
1. Criar `src/modules/tenant/tenant.middleware.ts`:
   - Extrai o tenant do cabeçalho `X-Tenant-Slug` ou subdomínio.
   - Injeta a instância do banco dedicada em `req.tenantPrisma`.
2. Criar rotas e controllers de configuração em `src/modules/tenant/config/`:
   - `GET /api/tenant/fiscal/config`
   - `PUT /api/tenant/fiscal/config`
   - `POST /api/tenant/fiscal/certificate` (Upload de PFX)
   - `GET /api/tenant/fiscal/certificate/status`
3. Suíte de testes de integração `test/tenant.routes.test.ts`.
4. Execução da regressão global e emissão do Relatório Final da Sprint 1 (Tenant).

## Critérios de Aceite
- [ ] Requisições sem identificador de tenant retornam HTTP 400 com mensagem clara.
- [ ] Upload de certificado A1 armazena dados criptografados e retorna status/validade.
- [ ] Regressão global de testes sem falhas.

## Validações Obrigatórias
```bash
npm run build
npm test -- --run
```

---

## 4. Próximo Passo

Com este plano aprovado, liberaremos imediatamente a execução da **TASK 01 (Tenant) — Estrutura Modular e Roteador Dinâmico de Conexões (`TenantConnectionManager`)**.
