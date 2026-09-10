## Relatório de Alterações — TASK 02 (Sprint 3)

**Task:**  
`TASK 02 (Sprint 3) — Proteção de Dados PII contra Perfis OPERATOR (GET /clients e GET /clients/:id)`

**Status:**  
`Concluído`

---

### 1. Resumo

Foi implementada a proteção e sanitização de dados pessoais sensíveis e fiscais (PII - *Personally Identifiable Information*) nos endpoints de leitura de clientes (`GET /clients` e `GET /clients/:id`). Anteriormente, usuários com o perfil operacional `OPERATOR` (suporte técnico) recebiam o payload integral do banco de dados, violando o Princípio do Menor Privilégio e as diretrizes da LGPD (Art. 6º, III - Necessidade). Com a implementação de um serializador dedicado em `src/modules/client/client.serializer.ts`, as requisições autenticadas de `OPERATOR` têm dados fiscais e pessoais estritamente suprimidos (`CPF_CNPJ`, `IE`, `IM`, `owner`, `ownerDocument`, `address`, `district`, `complement`, `UF`, `zipCode`), enquanto perfis de governança e faturamento (`ADMIN` e `SUPER_ADMIN`) continuam tendo acesso ao cadastro integral.

---

### 2. Arquivos alterados

```text
- src/modules/client/client.serializer.ts
- src/modules/client/client.controller.ts
- test/client.pii.test.ts
```

* **`src/modules/client/client.serializer.ts`** *(Novo)*: Criação da função de sanitização `sanitizeClientByRole(client, role)` responsável por filtrar condicionalmente os campos confidenciais baseada no perfil do usuário autenticado.
* **`src/modules/client/client.controller.ts`**: Integração do serializador aos métodos `getClients` e `getClient`, garantindo que toda resposta entregue ao cliente HTTP seja filtrada de acordo com `req.user.role`.
* **`test/client.pii.test.ts`** *(Novo)*: Suíte de testes automatizados com Supertest e Vitest validando a supressão de PII para `OPERATOR` e a entrega completa para `ADMIN` em ambos os endpoints.

---

### 3. Alterações realizadas

1. **Criação do Serializador de Clientes**:
   - Desenvolvida a função `sanitizeClientByRole`:
     ```typescript
     export function sanitizeClientByRole(client: any, role?: string) {
         if (!client) return client
         if (role === 'OPERATOR') {
             const {
                 CPF_CNPJ, IE, IM, owner, ownerDocument,
                 address, district, complement, UF, zipCode,
                 ...safeClient
             } = client
             return safeClient
         }
         return client
     }
     ```
2. **Integração no Controller (`client.controller.ts`)**:
   - Em `getClients`: Mapeamento da coleção de tenants aplicando `sanitizeClientByRole(tenant, role)` para cada registro retornado.
   - Em `getClient`: Aplicação do serializador sobre o objeto singular retornado na busca por ID antes de serializar o JSON de resposta.
3. **Cobertura Automatizada de Testes (`test/client.pii.test.ts`)**:
   - Cenário 1: `OPERATOR` em `GET /clients` recebe status 200 com campos de suporte (`id`, `socialName`, `slug`, `status`) e campos PII `undefined`.
   - Cenário 2: `OPERATOR` em `GET /clients/:id` recebe status 200 com PII omitido.
   - Cenário 3: `ADMIN` em `GET /clients` recebe status 200 com dados fiscais completos (`CPF_CNPJ`, `owner`, `address`, etc.).
   - Cenário 4: `ADMIN` em `GET /clients/:id` recebe status 200 com payload integral.

---

### 4. Decisões técnicas

```text
Estratégia de Controle de Acesso e Sanitização:
- Padrão Adotado: Dynamic Serializer no Controller (não interfere nas queries internas do repository)
- Campos Permitidos para OPERATOR: id, socialName, fantasyName, slug, contact, email, status, planId, createdAt, plan, subscription
- Campos Omitidos para OPERATOR: CPF_CNPJ, IE, IM, owner, ownerDocument, address, district, complement, UF, zipCode
- Perfis com Acesso Completo: ADMIN e SUPER_ADMIN
- Isolamento de Mocks: Uso de vi.hoisted() para garantir compatibilidade com o ciclo de vida do Vitest
```

---

### 5. Validações executadas

```text
npm run build                                                    → PASSOU (compilação TypeScript tsc limpa, código 0)
npx vitest run test/client.pii.test.ts                           → PASSOU (4/4 testes aprovados em 1.43s)
npm test -- --run (Execução Global Unificada)                   → PASSOU (7 arquivos / 42 testes aprovados em 2.59s)
```

---

### 6. Evidências

- **Execução Focada dos Testes de PII (`npx vitest run test/client.pii.test.ts`)**:
  ```text
   RUN  v4.1.11 C:/_Brito/project-vtx

   Test Files  1 passed (1)
        Tests  4 passed (4)
     Duration  1.43s
  ```

- **Execução Global Unificada de Todos os Módulos do Repositório**:
  ```text
   RUN  v4.1.11 C:/_Brito/project-vtx

   ✓ test/helmet.test.ts (2 tests)
   ✓ test/client.pii.test.ts (4 tests)
   ✓ test/error-handling.test.ts (2 tests)
   ✓ test/client.test.ts (16 tests)
   ✓ test/auth.limiter.test.ts (3 tests)
   ✓ test/subscription.schema.test.ts (5 tests)
   ✓ test/cors.test.ts (11 tests)

   Test Files  7 passed (7)
        Tests  42 passed (42)
     Duration  2.59s
  ```

---

### 7. Problemas encontrados

- **Elevação (*Hoisting*) de Mocks no Vitest**:  
  No primeiro commit da suíte de teste, a lista de mock `mockClientList` foi declarada como `const` de nível de topo, disparando `ReferenceError: Cannot access 'mockClientList' before initialization` em função do hoisting automático de `vi.mock()`. A issue foi resolvida envolvendo a declaração em `vi.hoisted()`.

---

### 8. Riscos ou pontos para revisão

- **Consistência em Outros Módulos**:  
  O endpoint `/clients/:slug/status` já retornava apenas campos públicos de status (`slug`, `name`, `status`, `plan`), mantendo-se estritamente seguro e compatível.
- **Novos Endpoints**:  
  Quaisquer novos endpoints de leitura de clientes introduzidos no futuro devem reutilizar `sanitizeClientByRole`.

---

### 9. Arquivos ou alterações que NÃO foram realizados

- Não foram alteradas as rotas de criação (`POST /clients`) ou de atualização (`PATCH /clients/:id/update`), pois estas já são restritas exclusivamente a `ADMIN` e `SUPER_ADMIN`.
- Não foram modificados os métodos internos do repositório Prisma (`ClientRepository`), preservando a integridade dos dados para operações internas do sistema.

---

### 10. Perguntas / bloqueios

- Nenhum bloqueio. A proteção de PII foi concluída com êxito e homologada em 100% dos testes.
