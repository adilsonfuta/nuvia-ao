FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
RUN npx prisma generate --schema packages/database/prisma/schema.prisma
RUN npm run build --workspace=@casar/api

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production API_PORT=4000 API_HOST=0.0.0.0
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/database/package.json ./packages/database/package.json
RUN npm ci --omit=dev --workspace=@casar/api
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/database/generated/client ./packages/database/generated/client
RUN mkdir -p /app/data/vendor-portfolio /app/data/private-contribution-proofs \
    && chown -R node:node /app/data
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
