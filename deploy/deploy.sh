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
echo "🔐 Step 3: Generating JWT secrets..."
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Update .env.production with generated secrets
sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" deploy/.env.production
sed -i.bak "s/JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET/" deploy/.env.production
rm deploy/.env.production.bak

echo "✅ JWT secrets generated!"

echo ""
echo "📡 Step 4: Uploading to server..."
ssh -i $SSH_KEY $USER@$SERVER "mkdir -p $REMOTE_DIR"

rsync -avz --progress -e "ssh -i $SSH_KEY" \
  deploy/ $USER@$SERVER:$REMOTE_DIR/

echo "✅ Upload complete!"

echo ""
echo "🐳 Step 5: Setting up Docker containers on server..."
ssh -i $SSH_KEY $USER@$SERVER << 'ENDSSH'
cd /home/ferdinand/gratonite-app

# Stop existing containers if any
docker-compose -f docker-compose.production.yml down 2>/dev/null || true

# Start new containers
docker-compose -f docker-compose.production.yml up -d

# Wait for database to be ready
echo "Waiting for database to be ready..."
sleep 10

# Run database migrations
echo "Running database migrations..."
docker exec gratonite-api sh -c "cd /app && npx drizzle-kit migrate"

# Check container status
docker-compose -f docker-compose.production.yml ps

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your application is now available at:"
echo "   - Landing: https://gratonite.chat"
echo "   - App: https://app.gratonite.chat"
echo "   - API: https://api.gratonite.chat"
echo ""
echo "📊 To view logs:"
echo "   docker logs -f gratonite-api"
echo "   docker logs -f gratonite-web"
echo ""
ENDSSH

echo ""
echo "🎉 Deployment successful!"
echo ""
echo "⚠️  IMPORTANT: Update DNS records to point to your server:"
echo "   - Add A record: app.gratonite.chat → your server IP"
echo "   - Add A record: api.gratonite.chat → your server IP"
echo ""
echo "📝 Next steps:"
echo "   1. Update .env.production with your SMTP credentials"
echo "   2. Update DNS records"
echo "   3. Test the application"
echo ""
