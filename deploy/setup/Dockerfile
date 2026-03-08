FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app
COPY apps/api/package.json apps/api/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
RUN pnpm add tsx

COPY apps/api/dist ./dist
COPY apps/api/drizzle ./drizzle
COPY apps/api/drizzle.config.ts ./
COPY deploy/setup/init.ts ./init.ts

CMD ["npx", "tsx", "init.ts"]
