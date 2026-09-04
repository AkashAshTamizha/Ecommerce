FROM node:18-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 5000
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]