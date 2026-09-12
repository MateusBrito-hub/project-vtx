# Relatório de Alterações — TASK 03 (Sprint 1 - Tenant)
## Módulo de Certificado Digital A1 com Criptografia em Repouso (AES-256-GCM)

---

### 1. Identificação da Tarefa
* **Projeto:** `project-vtx`
* **Fase:** 2 (VTX Tenant — Sistema Fiscal Cloud e Multi-Filial)
* **Sprint:** 1 (Fundação Multi-Tenant, Banco Dedicado e Certificados Digitais A1)
* **Task:** 03 — Módulo de Certificado Digital A1 com Criptografia em Repouso
* **Data:** 12/09/2026
* **Status:** 🟢 **Concluído e Aprovado**

---

### 2. Objetivo da Alteração
Implementar os módulos de segurança criptográfica em repouso (`src/modules/tenant/certificate/certificate.crypto.ts`) e o parser de certificados digitais ICP-Brasil (`src/modules/tenant/certificate/certificate.parser.ts`), garantindo a ingestão segura de arquivos `.pfx`/`.p12`, validação de autenticidade via AES-256-GCM com HKDF e extração de CNPJ titular, Razão Social, vigência e chaves PEM para emissão na SEFAZ.

---

### 3. Contexto e Justificativa
O Certificado Digital A1 contém o par de chaves criptográficas RSA que assina juridicamente documentos fiscais eletrônicos (NF-e e NFC-e). Armazenar o arquivo PFX ou sua senha em texto plano no banco de dados representaria uma falha crítica de segurança. Por esse motivo, foi estabelecido um padrão de envelope criptográfico em que a chave simétrica de cada tenant é derivada pelo algoritmo HKDF-SHA256 combinando o segredo mestre do ambiente com o `slug` único da empresa, além de verificação de autenticidade (GCM auth tag e AAD).

---

### 4. Arquivos Modificados/Criados

| Tipo | Caminho do Arquivo | Descrição |
|:---:|---|---|
| **[NEW]** | `src/modules/tenant/certificate/certificate.crypto.ts` | Criptografia simétrica autenticada AES-256-GCM com derivação HKDF por slug |
| **[NEW]** | `src/modules/tenant/certificate/certificate.parser.ts` | Parser PKCS#12 para ICP-Brasil com extração de CNPJ, vigência e conversão PEM |
| **[NEW]** | `test/tenant.certificate.test.ts` | Suíte de testes unitários validando integridade, AAD, parser e senhas |
| **[MODIFY]** | `package.json` | Instalação das dependências `node-forge` e `@types/node-forge` |

---

### 5. Detalhamento das Alterações Técnicas

1. **Derivação de Chaves HKDF (`deriveTenantKey`):**
   * Utiliza `crypto.hkdfSync('sha256', masterSecret, salt, info, 32)`;
   * Vincula o `slug` do tenant ao *salt*, garantindo que mesmo dois certificados idênticos gerem cifras completamente distintas em tenants diferentes.

2. **Criptografia Autenticada AES-256-GCM (`encryptCertificateData` / `decryptCertificateData`):**
   * Gera IV aleatório de 12 bytes (96 bits) por operação;
   * Aplica AAD (*Additional Authenticated Data*) com o slug do tenant, impedindo ataques de *copy-paste* de registros criptografados entre clientes;
   * Retorna payload autenticado no formato `iv:authTag:ciphertext`;
   * Lança erro explícito de violação de autenticidade caso ocorra adulteração de qualquer bit no authTag ou no texto cifrado.

3. **Parser de Certificado A1 ICP-Brasil (`parsePfxCertificate`):**
   * Descompacta o contêiner PKCS#12 binário ou Base64 utilizando a biblioteca `node-forge`;
   * Extrai e valida a presença de certificado X.509 e chave privada RSA;
   * Analisa os atributos do Subject do certificado no padrão brasileiro (`RAZAO SOCIAL:CNPJ`);
   * Valida vigência (`notBefore` e `notAfter`), sinalizando certificados já expirados (`isExpired: true`);
   * Converte certificado e chave privada para o formato PEM (`-----BEGIN CERTIFICATE-----` e `-----BEGIN RSA PRIVATE KEY-----`), preparando os insumos para a assinatura XMLDSig da SEFAZ na Sprint 3.

---

### 6. Impactos Arquiteturais e em Outros Módulos
* **Segurança de Nível Bancário:** O banco de dados do tenant nunca tem acesso às chaves em claro caso um dump seja interceptado sem a chave mestre da infraestrutura.
* **Preparação para Assinatura Fiscal:** Os métodos implementados fornecem a fundação para o futuro componente de assinatura XML (Sprint 3).

---

### 7. Validação e Testes Realizados

#### A. Testes Unitários da Task 03 (`test/tenant.certificate.test.ts`)
* **11 testes implementados e 100% aprovados:**
  * ✅ Derivação consistente de chaves por slug e segregação entre tenants;
  * ✅ Roundtrip de criptografia/descriptografia de dados binários e strings;
  * ✅ Detecção imediata de adulteração do AuthTag (GCM Authentication Tag Mismatch);
  * ✅ Rejeição de descriptografia ao utilizar slug divergente (Proteção AAD);
  * ✅ Tratamento de payloads malformados ou corrompidos;
  * ✅ Parsing completo de PKCS#12 e extração de CNPJ titular, Razão Social e datas;
  * ✅ Parsing de certificados enviados em base64;
  * ✅ Identificação de certificados expirados (`isExpired: true`);
  * ✅ Rejeição de arquivos com senha incorreta ou arquivo truncado.

#### B. Regressão Geral
* **Execução global de testes (`vitest --run`):**
  * `12 passed (12 test files)`
  * `85 passed (85 total tests)`
  * Duração: ~3.9s.
* **Compilação TypeScript (`npm run build`):**
  * `tsc` executado sem erros (código 0).

---

### 8. Riscos Identificados e Mitigações

| Risco | Severidade | Mitigação Aplicada |
|---|:---:|---|
| **Vazamento de chave privada em repouso** | Crítica | Criptografia AES-256-GCM com IV único e chave derivada por HKDF vinculada ao slug do cliente. |
| **Utilização de certificado vencido** | Alta | Checagem algorítmica de vigência (`expiresAt < Date.now()`) no parser antes de permitir o salvamento. |
| **Incompatibilidade de formato de senha** | Média | Tratamento seguro de exceções de decodificação ASN.1 com mensagens descritivas para o usuário. |

---

### 9. Próximos Passos
* **TASK 04 (Tenant) — Middleware de Resolução de Tenant, Endpoints de Configuração e Fechamento:**
  * Implementar `src/modules/tenant/tenant.middleware.ts` para capturar `Host` (subdomínio `slug.dominio.com.br`) e header `X-Tenant-Slug`.
  * Injetar o cliente do banco dedicado e o contexto do tenant em `req.tenantSlug` e `req.tenantPrisma`.
  * Criar controllers e rotas com validação Zod `.strict()` para upload do certificado A1 e consulta de configurações fiscais.
  * Emitir o Relatório Final da Sprint 1 (Tenant).

---

### 10. Parecer do Product Owner (PO)
* **Veredicto:** 🟢 **APROVADO PARA HOMOLOGAÇÃO**
* **Comentário do PO:** A entrega da Task 03 assegura a conformidade estrita com as melhores práticas de criptografia e tratamento de certificados digitais A1. O pipeline com AES-256-GCM e AAD fornece proteção robusta contra vazamento de dados confidenciais dos clientes.
