# ==========================================
# Estágio 1: Builder (Compilação e Artefatos)
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Recebe o build-arg do docker-compose e disponibiliza no ambiente para o prisma generate
ARG DATABASE_URL="postgresql://postgres:postgres@postgres:5432/vtx_db?schema=public"
ENV DATABASE_URL=${DATABASE_URL}

COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY tsconfig.json ./
COPY src ./src/

RUN npx prisma generate
RUN npm run build
RUN cp -r src/generated dist/generated

# ==========================================
# Estágio 2: Runner (Imagem Final de Produção)
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/prisma.config.ts ./prisma.config.ts

RUN chown -R node:node /usr/src/app

USER node

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]