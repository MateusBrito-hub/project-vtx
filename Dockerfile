FROM node:20-alpine

WORKDIR /usr/src/app

RUN apk add --no-cache bash git openssh

COPY package.json package-lock.json ./

RUN npm install --legacy-peer-deps

COPY . .

RUN npx prisma generate

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate dev --name init && npm run dev"]