# Stage 1: Build the API (needed for migrate.js)
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /build
COPY apps/api/package.json apps/api/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY apps/api/ ./
RUN pnpm run build

# Stage 2: Setup container
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app
COPY --from=builder /build/package.json /build/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
RUN pnpm add tsx

COPY --from=builder /build/dist ./dist
COPY --from=builder /build/drizzle ./drizzle
COPY --from=builder /build/drizzle.config.ts ./
COPY deploy/setup/init.ts ./init.ts

CMD ["npx", "tsx", "init.ts"]
