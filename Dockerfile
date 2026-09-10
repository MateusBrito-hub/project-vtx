# ==========================================
# Estágio 1: Builder (Compilação e Artefatos)
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copia manifestos de pacotes
COPY package.json package-lock.json ./

# Instala todas as dependências (inclusive devDependencies para compilar)
RUN npm install --legacy-peer-deps

# Copia schema do Prisma e código-fonte
COPY prisma ./prisma/
COPY tsconfig.json ./
COPY src ./src/

# Gera o Prisma Client
RUN npx prisma generate

# Compila o TypeScript para dist/
RUN npm run build

# Copia a pasta gerada pelo Prisma para dentro de dist/ garantindo a resolução do require
RUN cp -r src/generated dist/generated

# ==========================================
# Estágio 2: Runner (Imagem Final de Produção)
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copia manifestos de pacotes
COPY package.json package-lock.json ./

# Instala APENAS dependências de produção (imagem enxuta sem compiladores)
RUN npm install --omit=dev --legacy-peer-deps

# Copia artefatos compilados e Prisma schema do estágio anterior
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

# Ajusta propriedade dos arquivos para o usuário não-root nativo do Alpine (node)
RUN chown -R node:node /usr/src/app

# Aplica o Princípio do Menor Privilégio: executa como usuário não-root
USER node

EXPOSE 4000

# Executa migrações de forma determinística e inicia o servidor compilado em JavaScript
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]