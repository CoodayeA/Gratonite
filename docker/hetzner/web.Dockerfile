FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/landing/package.json apps/landing/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/profile-resolver/package.json packages/profile-resolver/package.json

RUN pnpm install --frozen-lockfile

COPY . .

ARG VITE_API_URL
ARG VITE_TUNNEL_STATUS=production:hetzner
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_TUNNEL_STATUS=${VITE_TUNNEL_STATUS}

# Build landing page
RUN pnpm --filter @gratonite/landing build

# Build web app
RUN pnpm --filter @gratonite/web build

FROM nginx:1.27-alpine

# Landing page at root
COPY --from=builder /app/apps/landing/dist /usr/share/nginx/landing

# Web app at /app/ subdirectory
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html/app

COPY docker/hetzner/nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
