# Plano de Execução --- Sprint 1 de Segurança do `project-vtx`

## 1. Objetivo do Sprint

**Sprint:** 1 --- Contenção de riscos críticos\
**Projeto:** `MateusBrito-hub/project-vtx`\
**Branch base:** `development`\
**Perfil de execução:** desenvolvedor independente\
**Duração de referência:** 1 semana, ajustável conforme a capacidade
real de desenvolvimento

### Objetivo do PO

Eliminar os três riscos classificados como críticos no Relatório de
Análise de Segurança e aproveitar o mesmo ciclo para executar duas
correções de baixo esforço:

1.  Rotacionar/proteger as credenciais do PostgreSQL e eliminar sua
    exposição desnecessária.
2.  Adicionar rate limiting ao `POST /auth/login`.
3.  Restringir o CORS a origens conhecidas.
4.  Remover a dependência `crypto` não utilizada.
5.  Adicionar `helmet`.

O relatório original classifica os itens 1, 2 e 3 como críticos e os
itens 10 e 11 como baixo/informativo. O plano de sprint original agrupou
exatamente esses cinco itens na Sprint 1. fileciteturn0file0L15-L19
fileciteturn0file1L17-L21

------------------------------------------------------------------------

# 2. Forma de trabalho

Como este projeto é desenvolvido individualmente, as tarefas abaixo são
organizadas para funcionar como uma **delegação de PO para um único
desenvolvedor**.

Cada task possui:

-   objetivo;
-   contexto;
-   escopo;
-   critérios de aceite;
-   validações obrigatórias;
-   entrega esperada;
-   relatório de alterações obrigatório.

### Regra principal do Sprint

**Uma task só deve ser considerada concluída quando o código estiver
alterado, as validações forem executadas e o relatório da task for
entregue.**

O relatório de alterações não é opcional. Ele será utilizado
posteriormente para revisão técnica e validação do PO.

------------------------------------------------------------------------

# 3. Ordem de execução

A ordem recomendada é:

  Ordem   Task                            Prioridade   Dependências
  ------- ------------------------------- ------------ --------------
  1       Proteção do PostgreSQL          🔴 Crítica   Nenhuma
  2       Rate limiting no login          🔴 Crítica   Nenhuma
  3       Restrição do CORS               🔴 Crítica   Nenhuma
  4       Remoção do `crypto`             🟢 Baixa     Nenhuma
  5       Adição do `helmet`              🟢 Baixa     Nenhuma
  6       Validação integrada do Sprint   🔴 Crítica   Tasks 1--5

A Task 6 não representa um item adicional do relatório de segurança. Ela
existe para garantir que as cinco alterações do sprint funcionem
conjuntamente antes do fechamento da sprint.

------------------------------------------------------------------------

# TASK 01 --- Proteção das credenciais e exposição do PostgreSQL

## Prioridade

🔴 **Crítica**

## Objetivo

Eliminar o uso de credenciais triviais/default do PostgreSQL e impedir
que a porta do banco fique exposta desnecessariamente pelo Docker
Compose em ambiente de produção.

## Contexto

O relatório identificou:

``` yaml
POSTGRES_USER: postgres
POSTGRES_PASSWORD: postgres

ports:
  - "5432:5432"
```

O risco ocorre principalmente caso essa configuração seja utilizada em
um servidor acessível externamente.

O relatório recomenda senha forte via variável de ambiente/secret
manager e remoção do mapeamento da porta do PostgreSQL em produção,
mantendo o banco acessível somente pela rede interna do Docker quando
possível. fileciteturn0file0L24-L39

## Escopo

Analisar e alterar a configuração responsável por:

-   usuário do PostgreSQL;
-   senha do PostgreSQL;
-   conexão da aplicação com o banco;
-   publicação da porta `5432`;
-   separação entre configuração adequada para desenvolvimento e
    produção, caso a arquitetura atual permita essa distinção sem
    complexidade desnecessária.

## Não alterar

Não é objetivo desta task:

-   modificar o schema Prisma;
-   criar migrations;
-   alterar models;
-   modificar regras de negócio;
-   alterar autenticação da aplicação.

## Critérios de aceite

A task será considerada concluída quando:

-   [ ] A senha `postgres` não estiver sendo utilizada como credencial
    de produção.
-   [ ] As credenciais forem fornecidas por configuração externa
    apropriada.
-   [ ] O PostgreSQL não estiver com `5432:5432` publicado em produção,
    salvo justificativa técnica documentada.
-   [ ] A API continuar conseguindo conectar ao PostgreSQL.
-   [ ] O ambiente de desenvolvimento continuar funcional.
-   [ ] Nenhuma credencial real seja adicionada ao Git.
-   [ ] O `.env` continue protegido pelo `.gitignore`.
-   [ ] A aplicação consiga iniciar normalmente após a alteração.

## Validações

Executar, conforme aplicável:

``` bash
docker compose config
docker compose up -d
docker compose ps
npm run build
npm run test
```

Também verificar se a porta do PostgreSQL está realmente acessível
apenas conforme o desenho pretendido.

## Entrega

Ao finalizar, entregar o **Relatório de Alterações da TASK 01** seguindo
o modelo do final deste documento.

------------------------------------------------------------------------

# TASK 02 --- Rate limiting no login

## Prioridade

🔴 **Crítica**

## Objetivo

Impedir tentativas ilimitadas de autenticação contra:

``` http
POST /auth/login
```

## Contexto

O relatório identificou ausência de middleware de limitação de
tentativas e recomendou `express-rate-limit` ou equivalente, com
possibilidade de backoff progressivo. fileciteturn0file0L41-L46

O plano da sprint estabelece como aceite um mecanismo capaz de bloquear
novas tentativas após um determinado número de falhas por IP/e-mail.
fileciteturn0file1L30-L35

## Escopo

Implementar rate limiting especificamente no fluxo de login.

A solução deve:

-   limitar tentativas;
-   retornar resposta adequada quando o limite for atingido;
-   não impedir o funcionamento normal de usuários legítimos;
-   possuir configuração clara dos limites adotados;
-   ser compatível com Express 5 e a arquitetura atual.

## Decisão esperada do desenvolvedor

Antes da implementação, definir:

-   quantidade máxima de tentativas;
-   janela de tempo;
-   comportamento após atingir o limite;
-   chave utilizada para limitação;
-   mensagem/status HTTP retornado.

Essas decisões deverão constar no relatório.

## Não alterar

Não modificar nesta task:

-   algoritmo de hash das senhas;
-   estrutura do JWT;
-   modelo de usuário;
-   regras de autorização;
-   cadastro de usuários.

## Critérios de aceite

-   [ ] Existe mecanismo de rate limiting no `POST /auth/login`.
-   [ ] Tentativas consecutivas além do limite são bloqueadas.
-   [ ] Uma tentativa legítima dentro do limite continua funcionando.
-   [ ] O comportamento após atingir o limite está documentado.
-   [ ] O middleware não foi aplicado indiscriminadamente a toda a API
    sem necessidade.
-   [ ] Teste manual ou automatizado comprova o bloqueio.

## Validações

Executar:

``` bash
npm run build
npm run test
```

Além disso, realizar teste específico do endpoint de login simulando
tentativas consecutivas.

Registrar no relatório:

-   número de tentativas utilizado;
-   janela configurada;
-   resposta recebida ao atingir o limite;
-   como o limite foi resetado.

## Entrega

**Relatório de Alterações da TASK 02.**

------------------------------------------------------------------------

# TASK 03 --- Restrição do CORS

## Prioridade

🔴 **Crítica**

## Objetivo

Substituir a configuração aberta:

``` ts
app.use(cors())
```

por uma política explícita de origens permitidas.

## Contexto

O relatório classificou o CORS totalmente aberto como risco crítico e
recomendou whitelist explícita das origens permitidas.
fileciteturn0file0L48-L57

## Escopo

Configurar o CORS para aceitar somente origens conhecidas.

A configuração deverá ser adequada para o ambiente atual do projeto e
permitir evolução para diferentes ambientes, se necessário.

## Decisão esperada do desenvolvedor

Definir e documentar:

-   quais origens são permitidas;
-   como essas origens serão configuradas;
-   se haverá diferença entre desenvolvimento e produção;
-   se `credentials` será necessário.

O relatório original recomenda utilizar `credentials: true` somente
quando estritamente necessário. fileciteturn0file0L55-L57

## Critérios de aceite

-   [ ] `cors()` não permanece totalmente aberto.
-   [ ] Existe whitelist explícita.
-   [ ] Origem autorizada consegue consumir a API.
-   [ ] Origem não autorizada é rejeitada.
-   [ ] A configuração não depende de inserir segredo diretamente no
    código.
-   [ ] O comportamento está documentado.
-   [ ] A aplicação inicia normalmente.

## Validações

Executar:

``` bash
npm run build
npm run test
```

E testar pelo menos:

1.  requisição com origem autorizada;
2.  requisição com origem não autorizada;
3.  requisição sem origem, quando aplicável ao comportamento esperado da
    API.

## Entrega

**Relatório de Alterações da TASK 03.**

------------------------------------------------------------------------

# TASK 04 --- Remoção da dependência `crypto`

## Prioridade

🟢 **Baixa**

## Objetivo

Remover a dependência npm `crypto` que não é utilizada pelo projeto.

## Contexto

O relatório identificou `"crypto": "^1.0.1"` como dependência direta sem
uso no código. O Node.js já possui o módulo nativo `crypto`.
fileciteturn0file0L138-L142

## Escopo

-   remover a dependência;
-   atualizar `package-lock.json`;
-   verificar se não existem imports externos do pacote;
-   garantir que o projeto continue funcionando.

## Critérios de aceite

-   [ ] `crypto` não está mais em `package.json`.
-   [ ] Lockfile atualizado.
-   [ ] Não existem imports que dependam do pacote removido.
-   [ ] Build continua funcionando.
-   [ ] Testes continuam funcionando.

## Validações

``` bash
npm uninstall crypto
npm run build
npm run test
npm audit
```

## Entrega

**Relatório de Alterações da TASK 04.**

------------------------------------------------------------------------

# TASK 05 --- Adição do Helmet

## Prioridade

🟢 **Baixa**

## Objetivo

Adicionar headers HTTP de segurança à aplicação Express.

## Contexto

O relatório identificou ausência de `helmet` ou equivalente e recomendou
sua adoção. fileciteturn0file0L143-L146

O plano da Sprint 1 estabelece como aceite a aplicação de `helmet()` no
`app.ts` e a presença de headers de segurança na resposta.
fileciteturn0file1L30-L36

## Escopo

-   instalar/configurar `helmet`;
-   integrar no ponto apropriado da aplicação;
-   verificar os headers adicionados;
-   garantir compatibilidade com o restante dos middlewares.

## Não alterar

Não modificar nesta task:

-   autenticação JWT;
-   CORS;
-   rate limiting;
-   rotas;
-   controllers;
-   regras de negócio.

## Critérios de aceite

-   [ ] `helmet` está instalado.
-   [ ] `helmet()` está configurado no `app.ts` ou ponto equivalente.
-   [ ] Headers de segurança são retornados pela API.
-   [ ] Build funciona.
-   [ ] Testes continuam funcionando.
-   [ ] A configuração não quebra o consumo normal da API.

## Validações

``` bash
npm run build
npm run test
```

Realizar também uma requisição HTTP e verificar os headers retornados.

## Entrega

**Relatório de Alterações da TASK 05.**

------------------------------------------------------------------------

# TASK 06 --- Validação integrada e fechamento da Sprint 1

## Prioridade

🔴 **Crítica**

## Objetivo

Garantir que as cinco correções implementadas funcionem conjuntamente e
que nenhuma alteração tenha introduzido regressões.

Esta task corresponde ao fechamento técnico da sprint, não a um novo
achado de segurança.

## Pré-requisito

Tasks 01 a 05 concluídas.

## Validações obrigatórias

Executar:

``` bash
npm audit
npm run build
npm run test
```

E validar manualmente:

### PostgreSQL

-   [ ] Banco não está exposto externamente de maneira indevida.
-   [ ] API consegue acessar o banco.

### Login

-   [ ] Login válido funciona.
-   [ ] Tentativas excessivas são bloqueadas.

### CORS

-   [ ] Origem autorizada funciona.
-   [ ] Origem não autorizada é rejeitada.

### Helmet

-   [ ] Headers de segurança estão presentes.

### Dependências

-   [ ] `crypto` não está mais instalado como dependência direta.
-   [ ] Não surgiram vulnerabilidades novas no `npm audit`.

O Definition of Done original da Sprint 1 exige validação dos três
riscos críticos em ambiente de homologação: brute-force bloqueado, banco
não acessível externamente e CORS rejeitando origem não autorizada.
fileciteturn0file1L38-L38

## Critério de aceite da Sprint

A Sprint 1 somente será considerada **Concluída** quando:

-   [ ] Tasks 01--05 estiverem concluídas.
-   [ ] Build passar.
-   [ ] Suíte de testes passar.
-   [ ] `npm audit` não apresentar nova vulnerabilidade.
-   [ ] Os três riscos críticos forem revalidados.
-   [ ] Todos os relatórios individuais forem entregues.
-   [ ] Um relatório final da sprint for entregue.

------------------------------------------------------------------------

# 4. Modelo obrigatório de Relatório de Alterações

Ao terminar **cada task**, não envie apenas "feito".

Retorne o relatório abaixo preenchido.

## Relatório de Alterações --- TASK XX

**Task:**\
`TASK XX — Nome da task`

**Status:**\
`Concluído` / `Bloqueado` / `Em Validação`

### 1. Resumo

Descreva brevemente o que foi alterado e qual problema foi resolvido.

### 2. Arquivos alterados

Liste todos os arquivos modificados:

``` text
- arquivo1
- arquivo2
- arquivo3
```

Para cada arquivo, informe resumidamente o motivo da alteração.

### 3. Alterações realizadas

Descreva tecnicamente:

-   o que foi implementado;
-   como foi implementado;
-   decisões tomadas;
-   configurações adotadas;
-   eventuais mudanças de arquitetura.

### 4. Decisões técnicas

Informe as decisões tomadas durante a implementação.

Exemplo:

``` text
Rate limit:
- Janela: 15 minutos
- Limite: 5 tentativas
- Chave: IP
- Resposta ao exceder: HTTP 429
```

### 5. Validações executadas

Liste os comandos e resultados:

``` text
npm run build       → PASSOU
npm run test        → PASSOU
npm audit           → PASSOU
Teste manual X     → PASSOU
```

### 6. Evidências

Informe evidências relevantes.

Exemplos:

-   resposta HTTP;
-   status code;
-   trecho de log;
-   resultado de comando;
-   comportamento observado;
-   screenshot, quando realmente necessário.

### 7. Problemas encontrados

Se nenhum:

``` text
Nenhum problema encontrado.
```

Caso contrário, descreva:

-   problema;
-   causa;
-   solução aplicada;
-   impacto.

### 8. Riscos ou pontos para revisão

Informe qualquer coisa que você considere que eu, como PO/revisor,
deveria analisar.

### 9. Arquivos ou alterações que NÃO foram realizados

Informe explicitamente qualquer alteração planejada que acabou não sendo
feita.

### 10. Perguntas / bloqueios

Se houver alguma decisão que você não conseguiu tomar sozinho, registre
aqui.

------------------------------------------------------------------------

# 5. Como será minha validação

Após cada relatório, vou atuar como **PO + revisor técnico**.

Minha análise seguirá quatro níveis:

### 🟢 Aprovado

A implementação atende ao objetivo e aos critérios de aceite.

A task será considerada concluída.

### 🟡 Ajustes necessários

A solução está próxima do esperado, mas existe alguma melhoria ou
correção necessária.

Vou indicar exatamente o que precisa ser alterado antes da aprovação.

### 🔴 Reprovado

A implementação não atende ao requisito de segurança ou introduziu um
problema relevante.

A task deverá retornar para desenvolvimento.

### 🔵 Bloqueado

Existe uma decisão técnica, dependência ou problema externo que impede a
conclusão.

Nesse caso, vou ajudar a definir a próxima ação antes de continuar.

------------------------------------------------------------------------

# 6. Regra para o desenvolvimento

Durante esta sprint, **não implemente várias tasks simultaneamente**.

A dinâmica será:

``` text
TASK 01
   ↓
Desenvolvimento
   ↓
Validação
   ↓
Relatório de Alterações
   ↓
Minha análise
   ↓
Aprovada?
   ├── NÃO → Ajustar → novo relatório
   └── SIM
        ↓
TASK 02
```

Isso permite manter rastreabilidade das alterações e evita que um
problema em uma correção contamine a validação das demais.

------------------------------------------------------------------------

# 7. Definition of Done da Sprint 1

A Sprint 1 seguirá o Definition of Done definido no plano original, com
uma camada adicional de rastreabilidade para o desenvolvimento
individual. fileciteturn0file1L38-L38

A sprint estará encerrada quando:

-   [ ] PostgreSQL protegido.
-   [ ] Credenciais não triviais e externas ao código.
-   [ ] Porta do PostgreSQL não exposta indevidamente.
-   [ ] Rate limiting funcionando no login.
-   [ ] CORS restrito.
-   [ ] Dependência `crypto` removida.
-   [ ] `helmet` configurado.
-   [ ] Build aprovado.
-   [ ] Testes aprovados.
-   [ ] `npm audit` reexecutado.
-   [ ] Brute-force validado.
-   [ ] CORS não autorizado validado.
-   [ ] Acesso externo ao PostgreSQL validado.
-   [ ] Relatório de cada task aprovado.
-   [ ] Relatório final da Sprint 1 aprovado.

------------------------------------------------------------------------

# 8. Primeiro passo

**Não execute todas as tasks de uma vez.**

Comece exclusivamente pela:

> **TASK 01 --- Proteção das credenciais e exposição do PostgreSQL**

Quando terminar, retorne somente o **Relatório de Alterações da TASK
01** seguindo o modelo deste documento.

A partir desse relatório, a implementação será revisada antes da
liberação da TASK 02.
