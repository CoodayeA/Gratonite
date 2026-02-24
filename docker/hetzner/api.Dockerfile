FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable

# Native deps may need build toolchain fallback (argon2/sharp).
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy manifests first for better layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/profile-resolver/package.json packages/profile-resolver/package.json

RUN pnpm install --frozen-lockfile

# Copy source after dependencies.
COPY . .

ENV NODE_ENV=production
WORKDIR /app/apps/api

EXPOSE 4000

CMD ["node", "--import", "tsx", "src/index.ts"]
