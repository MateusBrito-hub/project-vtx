FROM node:20-alpine

WORKDIR /usr/src/app

RUN apk add --no-cache bash git openssh

COPY package.json package-lock.json ./

RUN npm install --legacy-peer-deps

COPY . .

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

RUN npx prisma generate

EXPOSE 4000

CMD ["npm", "run", "dev"]