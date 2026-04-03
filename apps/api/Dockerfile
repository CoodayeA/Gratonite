# Stage 1: Build
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /build
COPY apps/api/package.json apps/api/pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile

COPY apps/api/ ./
RUN pnpm run build

# Stage 2: Production
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app
COPY --from=builder /build/package.json /build/pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile --prod

COPY --from=builder /build/dist ./dist
COPY --from=builder /build/drizzle ./drizzle
COPY --from=builder /build/drizzle.config.ts ./
COPY apps/api/start.sh ./start.sh

# Create uploads directory
RUN mkdir -p /app/uploads /app/keys

# Non-root user
RUN addgroup -g 1001 gratonite && adduser -u 1001 -G gratonite -s /bin/sh -D gratonite
RUN chmod +x /app/start.sh
RUN chown -R gratonite:gratonite /app
USER gratonite

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["sh", "/app/start.sh"]
