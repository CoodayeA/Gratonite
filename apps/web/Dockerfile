# Stage 1: Build with pnpm workspace
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /build

# Copy workspace config and package files
COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/

# Install dependencies (shamefully-hoist ensures all deps are accessible to vite)
RUN echo "shamefully-hoist=true" > .npmrc && pnpm install --no-frozen-lockfile

# Copy source files
COPY packages/types/ packages/types/
COPY apps/web/ apps/web/

# Remove .env so VITE_API_URL defaults to relative /api/v1 (works for self-hosted)
RUN rm -f apps/web/.env apps/web/.env.production apps/web/.env.local

# Build types first, then web (skip tsc — vite handles transpilation)
RUN cd packages/types && pnpm run build
RUN cd apps/web && npx vite build

# Stage 2: Serve
FROM nginx:1.27-alpine

COPY --from=builder /build/apps/web/dist /usr/share/nginx/html/app

# SPA fallback config — app is built with base: /app/
# Files are placed at /usr/share/nginx/html/app/ so /app/assets/* resolves correctly
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location /app/ { \
        try_files $uri $uri/ /app/index.html; \
    } \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ { \
        expires 30d; \
        add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/app/ || exit 1
