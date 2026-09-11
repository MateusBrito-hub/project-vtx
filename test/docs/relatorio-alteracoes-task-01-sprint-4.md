## Relatório de Alterações — TASK 01 (Sprint 4)

**Task:**  
`TASK 01 (Sprint 4) — Schema Zod e Proteção contra Mass Assignment em Planos (Plan)`

**Status:**  
`Concluído`

---

### 1. Resumo

Foi implementada a proteção contra *Mass Assignment* e injeção de parâmetros arbitrários no módulo de planos (`POST /plans` e `PATCH /plans/:id`). Anteriormente, o controller realizava verificações manuais de campos e desestruturava o `req.body` diretamente via spread operator (`...body`), permitindo que usuários autenticados injetassem propriedades indevidas (`id`, `status: "suspended"`, campos arbitrários). Foi criado o módulo [src/modules/plan/plan.schema.ts](file:///c:/_Brito/project-vtx/src/modules/plan/plan.schema.ts) com validação estrita em runtime via Zod (`.strict()`) e tipos DTO (`CreatePlanDTO` e `UpdatePlanDTO`), substituindo e descontinuando integralmente o arquivo legado [plan.interface.ts](file:///c:/_Brito/project-vtx/src/modules/plan/plan.interface.ts). Qualquer payload com propriedades desconhecidas ou inválidas passa a ser rejeitado imediatamente com status HTTP 400 Bad Request.

---

### 2. Arquivos alterados

```text
- src/modules/plan/plan.schema.ts (Novo)
- src/modules/plan/plan.interface.ts (Deletado)
- src/modules/plan/plan.controller.ts
- src/modules/plan/plan.service.ts
- src/modules/plan/plan.repository.ts
- test/plan.schema.test.ts (Novo)
```

* **`src/modules/plan/plan.schema.ts`** *(Novo)*: Criação dos schemas Zod estritos `createPlanSchema` e `updatePlanSchema` (`.strict()`), além da exportação dos tipos DTO `CreatePlanDTO` e `UpdatePlanDTO`.
* **`src/modules/plan/plan.interface.ts`** *(Deletado)*: Remoção da interface legada `IPlan`, padronizando o módulo com o padrão já adotado em `client` e `subscription`.
* **`src/modules/plan/plan.controller.ts`**: Integração do `createPlanSchema.parse(req.body)` em `registerPlan` e `updatePlanSchema.parse(req.body)` em `updatePlanById`, delegando erros para `handleZodError`.
* **`src/modules/plan/plan.service.ts`**: Atualização das assinaturas dos métodos `createPlan` e `updatePlan` para consumir os novos DTOs.
* **`src/modules/plan/plan.repository.ts`**: Atualização dos métodos `create` e `updateById` para receber `CreatePlanDTO` e `UpdatePlanDTO`, repassando o payload estritamente validado ao Prisma.
* **`test/plan.schema.test.ts`** *(Novo)*: Suíte com 6 testes automatizados validando criação/atualização válida, rejeição a campos não autorizados (Mass Assignment), bloqueio de payload incompleto e body vazio.

---

### 3. Alterações realizadas

1. **Modelagem de Schemas Zod Estritos**:
   - `createPlanSchema`: exige `name` (string não vazia, máx 100 caracteres), `price` (número positivo) e `maxDocs` (inteiro positivo). Bloqueia campos desconhecidos com `.strict()`.
   - `updatePlanSchema`: campos opcionais, mas exige que pelo menos um seja fornecido através de `.refine(data => Object.keys(data).length > 0)`. Bloqueia campos desconhecidos com `.strict()`.
2. **Substituição da Interface por DTOs**:
   - Erradicado o arquivo `plan.interface.ts`.
   - `plan.service.ts` e `plan.repository.ts` foram convertidos para operar estritamente sobre `CreatePlanDTO` e `UpdatePlanDTO`.
3. **Tratamento Seguro no Controller**:
   - `registerPlan` e `updatePlanById` realizam `.parse(req.body)`.
   - Captura explícita de `ZodError` retornando `handleZodError(res, error)` com status HTTP 400 estruturado.
4. **Criação da Suíte de Testes Automatizados**:
   - 6 testes cobrindo requisições HTTP válidas (201/200), injeções de Mass Assignment (400), campos ausentes (400) e body vazio (400).

---

### 4. Decisões técnicas

```text
Estratégia de Validação e DTOs:
- Padrão Adotado: Validação de runtime no Controller via Zod .strict()
- Tipagem: Inferência estrita com z.infer (CreatePlanDTO e UpdatePlanDTO)
- Persistência: Passagem segura do UpdatePlanDTO diretamente para o prisma.plan.update
- Tratamento de Erros: Erros de schema mapeados via handleZodError (HTTP 400 com details)
- Descontinuação de Interfaces: Remoção completa de plan.interface.ts
```

---

### 5. Validações executadas

```text
npm run build                                                    → PASSOU (compilação TypeScript tsc limpa, código 0)
npx vitest run test/plan.schema.test.ts                         → PASSOU (6/6 testes aprovados em 8.15s)
npm test -- --run (Execução Global Unificada)                   → PASSOU (9 arquivos / 53 testes aprovados em 3.67s)
```

---

### 6. Evidências

- **Execução Focada da Nova Suíte (`test/plan.schema.test.ts`)**:
  ```text
   RUN  v4.1.11 C:/_Brito/project-vtx

   Test Files  1 passed (1)
        Tests  6 passed (6)
     Duration  8.15s
  ```

- **Execução Global Unificada de Toda a Aplicação**:
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
     Duration  3.67s
  ```

---

### 7. Problemas encontrados

- **Descontinuação da Interface `IPlan`**:  
  Durante a remoção de `plan.interface.ts`, `plan.service.ts` e `plan.repository.ts` inicialmente tentaram importar `IPlan` de `plan.schema.ts`. A substituição pelas tipagens oficiais `CreatePlanDTO` e `UpdatePlanDTO` eliminou os erros de compilação do TypeScript.

---

### 8. Riscos ou pontos para revisão

- **Campos Opcionais no Update**:  
  O `.refine()` do `updatePlanSchema` garante que requisições `PATCH` não enviem objetos vazios (`{}`), evitando chamadas desnecessárias de atualização ao banco de dados.

---

### 9. Arquivos ou alterações que NÃO foram realizados

- As rotas de planos em `plan.routes.ts` não precisaram ser modificadas, preservando os middlewares de controle de acesso (`requireRole`).

---

### 10. Perguntas / bloqueios

- Nenhum bloqueio. A vulnerabilidade de Mass Assignment em Planos foi eliminada com 100% de conformidade.
