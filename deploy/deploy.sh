#!/bin/bash
set -e

echo "🚀 Gratonite Deployment Script"
echo "================================"

# Configuration
SERVER="gratonite.chat"
USER="ferdinand"
SSH_KEY="~/.ssh/codex_gratonite_hetzner"
REMOTE_DIR="/home/ferdinand/gratonite-app"

echo ""
echo "📦 Step 1: Building application locally..."
cd "$(dirname "$0")/.."

# Build backend
echo "  Building backend..."
cd apps/api
pnpm install
pnpm run build
cd ../..

# Build frontend
echo "  Building frontend..."
cd apps/web
pnpm install
pnpm run build
cd ../..

echo "✅ Build complete!"

echo ""
echo "📤 Step 2: Creating deployment package..."
mkdir -p deploy/api
mkdir -p deploy/web/dist

# Copy backend files
cp -r apps/api/dist deploy/api/
cp -r apps/api/drizzle deploy/api/
cp apps/api/package.json deploy/api/
cp apps/api/pnpm-lock.yaml deploy/api/
cp apps/api/drizzle.config.ts deploy/api/

# Copy frontend build
cp -r apps/web/dist/* deploy/web/dist/

echo "✅ Package created!"

echo ""
echo "📡 Step 3: Uploading to server..."
ssh -i $SSH_KEY $USER@$SERVER "mkdir -p $REMOTE_DIR"

rsync -avz --progress -e "ssh -i $SSH_KEY" \
  deploy/ $USER@$SERVER:$REMOTE_DIR/

echo "✅ Upload complete!"

echo ""
echo "🐳 Step 4: Restarting containers on server..."
ssh -i $SSH_KEY $USER@$SERVER << 'ENDSSH'
cd /home/ferdinand/gratonite-app

# Recreate only api and web — leaves postgres/redis/caddy untouched (no downtime on DB)
docker compose -f docker-compose.production.yml up -d --force-recreate api web

# Run any new database migrations
echo "Running database migrations..."
docker exec gratonite-api sh -c "cd /app && npx drizzle-kit migrate" || true

# Check container status
docker compose -f docker-compose.production.yml ps

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Live at:"
echo "   - https://gratonite.chat"
echo "   - https://app.gratonite.chat"
echo "   - https://api.gratonite.chat"
echo ""
echo "📊 To view logs:"
echo "   docker logs -f gratonite-api"
echo "   docker logs -f gratonite-web"
echo ""
ENDSSH

echo ""
echo "🎉 Deployment successful!"
echo ""
