## Relatório de Alterações --- TASK 04

**Task:**  
`TASK 04 — Remoção da dependência crypto`

**Status:**  
`Concluído`

---

### 1. Resumo

Foi removida a dependência direta deprecada `"crypto": "^1.0.1"` do arquivo `package.json` e do `package-lock.json`. O Node.js fornece nativamente o módulo interno `crypto`, tornando a dependência externa de terceiros órfã, redundante e com alerta de abandono no registro do npm. A remoção limpa a árvore de dependências sem qualquer impacto nas funcionalidades ou no build da aplicação.

---

### 2. Arquivos alterados

```text
- package.json
- package-lock.json
```

* **`package.json`**: Remoção da linha `"crypto": "^1.0.1"` da seção de `dependencies`.
* **`package-lock.json`**: Atualização do lockfile com a exclusão da dependência `"crypto"` na raiz do pacote e de sua entrada no diretório `"node_modules/crypto"`.

---

### 3. Alterações realizadas

- **Auditoria de imports no código**: Realizada busca estática e regex por imports do pacote em todos os arquivos de `src/` e `test/`. Constatou-se que não existe nenhuma importação explícita (`import 'crypto'` ou `require('crypto')`).
- **Remoção de pacote do manifesto**: Executada a desinstalação segura do pacote `crypto`.
- **Sincronização do lockfile**: O lockfile foi regenerado e sincronizado, garantindo que o módulo não seja baixado nem instalado durante a montagem das imagens Docker ou execuções em ambientes de homologação e produção.
- **Validação de regressão**: Executados build do TypeScript e testes de unidade e integração da API para atestar a estabilidade da aplicação.

---

### 4. Decisões técnicas

```text
Dependência de Criptografia:
- Pacote Externo Removido: crypto v1.0.1 (marcado como deprecated no npm registry)
- Mecanismo Adotado: Uso exclusivo das APIs nativas do runtime do Node.js (módulo embutido 'crypto') quando necessário
- Impacto na Aplicação: Zero (o projeto utiliza 'bcryptjs' para hashing de senhas e 'jsonwebtoken' para emissão de tokens)
```

---

### 5. Validações executadas

```text
npm run build                                                    → PASSOU (compilação TypeScript tsc sem erros)
npx vitest run test/auth.limiter.test.ts test/cors.test.ts      → PASSOU (14 testes aprovados)
npm audit                                                        → EXECUTADO (sem impactos introduzidos pela remoção)
Auditoria estática de código (grep 'crypto')                     → PASSOU (nenhum import órfão)
```

---

### 6. Evidências

- **Verificação no `package.json`**:
  ```json
  "dependencies": {
    "@prisma/adapter-pg": "^7.10.0",
    "@prisma/client": "^7.10.0",
    "@prisma/config": "^7.10.0",
    "bcryptjs": "^3.0.3",
    "cors": "^2.8.5",
    "dotenv": "^16.5.0",
    "express": "^5.1.0",
    "express-rate-limit": "^8.7.0",
    "http-status-codes": "^2.3.0",
    "jsonwebtoken": "^9.0.3",
    "nodemailer": "^9.0.1",
    "pg": "^8.23.0",
    "uuid": "^14.0.0",
    "yup": "^1.6.1",
    "zod": "^4.4.3"
  }
  ```

- **Resultado do Build TypeScript (`npm run build`)**:
  ```text
  > vtx@1.0.0 build
  > tsc
  ```
  *(Código de saída 0 — sem erros de compilação)*

- **Execução dos Testes Automatizados (`vitest`)**:
  ```text
   RUN  v4.1.11 C:/_Brito/project-vtx

   Test Files  2 passed (2)
        Tests  14 passed (14)
     Duration  1.74s
  ```

---

### 7. Problemas encontrados

```text
Nenhum problema encontrado. A dependência não possuía acoplamento com o código-fonte da aplicação.
```

---

### 8. Riscos ou pontos para revisão

- Não há riscos residuais referentes a esta remoção. A árvore de dependências agora está isenta de um pacote deprecado que apenas gerava ruído e potenciais avisos no gerenciador de pacotes.

---

### 9. Arquivos ou alterações que NÃO foram realizados

- Nenhuma alteração nos módulos de negócio (`src/modules/*`), banco de dados ou autenticação.

---

### 10. Perguntas / bloqueios

```text
Nenhum bloqueio registrado. TASK 04 100% concluída.
```
