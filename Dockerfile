# -----------------------------
# Core Dockerfile
# -----------------------------

# Base Node 18 Alpine leve
FROM node:20-alpine

# Diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Instalar dependências do sistema
RUN apk add --no-cache bash git openssh

# Copiar arquivos de dependências
COPY package.json package-lock.json ./

# Instalar dependências
RUN npm install --legacy-peer-deps

# Copiar todo o código do Core
COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# Expor porta do backend (ajuste se necessário)
EXPOSE 4000

# Comando default ao rodar o container
CMD ["sh", "-c", "npx prisma migrate dev --name init && npm run dev"]