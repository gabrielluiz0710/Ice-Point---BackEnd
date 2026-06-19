# Estágio 1: Dependências e Build
FROM node:22-alpine AS builder

WORKDIR /app

# Instala ferramentas necessárias para build de bibliotecas nativas (se necessário, como bcrypt ou sharp)
RUN apk add --no-cache python3 make g++ vips-dev

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Estágio 2: Produção (Imagem mais leve)
FROM node:22-alpine AS production

WORKDIR /app

# Instala apenas dependências do sharp/vips em produção
RUN apk add --no-cache vips

COPY package*.json ./
RUN npm ci --omit=dev

# Copia os arquivos compilados do estágio 1
COPY --from=builder /app/dist ./dist

# Garante que o sharp foi instalado corretamente
RUN npm rebuild sharp

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/main"]
