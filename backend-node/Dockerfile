
FROM node:20-slim

RUN apt-get update && apt-get install -y openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src

RUN mkdir -p /data/storage

EXPOSE 8000

CMD sh -c "npx prisma migrate deploy && npx tsx src/server.ts"

