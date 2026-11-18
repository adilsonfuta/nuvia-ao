FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci
ARG API_INTERNAL_URL=http://api:4000/api/v1
ENV NODE_ENV=production \
    DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    API_INTERNAL_URL=${API_INTERNAL_URL} \
    NEXT_PUBLIC_API_URL=/api/v1
RUN npx prisma generate --schema packages/database/prisma/schema.prisma
RUN npm run build --workspace=@casar/web

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
RUN npm ci --omit=dev --workspace=@casar/web
COPY --from=builder /app/apps/web ./apps/web
COPY --from=builder /app/packages/contracts ./packages/contracts
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "apps/web", "--hostname", "0.0.0.0", "--port", "3000"]
