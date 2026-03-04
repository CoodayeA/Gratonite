# Gratonite Deployment to Hetzner Server

## Current Status
- ✅ Backend built (`apps/api/dist`)
- ✅ Frontend built (`apps/web/dist`)
- ✅ Server has Docker and Docker Compose
- ✅ Landing page running at gratonite.chat
- ✅ Ports 80 and 443 available

## Deployment Strategy
We'll use Docker Compose to deploy:
- PostgreSQL database
- Redis cache
- Backend API (Node.js)
- Frontend (Nginx)
- Integrate with existing Caddy proxy

## Step-by-Step Deployment

### 1. Generate JWT Secrets

Run locally:
```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

Copy these values and update `deploy/.env.production`

### 2. Configure SMTP (Optional but recommended)

Update in `deploy/.env.production`:
- Get SendGrid API key from https://sendgrid.com
- Or use your own SMTP server

### 3. Update Frontend API URL

The frontend is already configured to use the API URL. We need to rebuild with production URL:

```bash
cd apps/web
echo "VITE_API_URL=https://api.gratonite.chat" > .env.production
pnpm run build
```

### 4. Create Deployment Package

```bash
# From project root
mkdir -p deploy/api
mkdir -p deploy/web/dist

# Copy backend
cp -r apps/api/dist deploy/api/
cp -r apps/api/drizzle deploy/api/
cp apps/api/package.json deploy/api/
cp apps/api/pnpm-lock.yaml deploy/api/
cp apps/api/drizzle.config.ts deploy/api/
cp -r apps/api/node_modules deploy/api/ 2>/dev/null || echo "Will install on server"

# Copy frontend
cp -r apps/web/dist/* deploy/web/dist/
```

### 5. Upload to Server

```bash
ssh -i ~/.ssh/codex_gratonite_hetzner ferdinand@gratonite.chat "mkdir -p /home/ferdinand/gratonite-app"

rsync -avz --progress -e "ssh -i ~/.ssh/codex_gratonite_hetzner" \
  deploy/ ferdinand@gratonite.chat:/home/ferdinand/gratonite-app/
```

### 6. SSH into Server and Deploy

```bash
ssh -i ~/.ssh/codex_gratonite_hetzner ferdinand@gratonite.chat
```

On the server:
```bash
cd /home/ferdinand/gratonite-app

# Start containers
docker compose -f docker-compose.production.yml up -d

# Wait for database
sleep 15

# Run migrations
docker exec gratonite-api sh -c "cd /app && npm install -g pnpm && pnpm install && npx drizzle-kit migrate"

# Check status
docker compose -f docker-compose.production.yml ps
docker logs gratonite-api
```

### 7. Update Existing Caddy Configuration

The existing Caddy container needs to be updated to proxy to our new services.

Option A: Update existing Caddy container
```bash
# Find existing Caddy config
docker exec gratonite-caddy-1 cat /etc/caddy/Caddyfile

# We need to add our new routes to it
```

Option B: Use our new Caddy container (recommended)
```bash
# Stop old Caddy
docker stop gratonite-caddy-1

# Our new Caddy will handle all routing
# Edit docker-compose.production.yml to use ports 80 and 443 instead of 8080 and 8443
```

### 8. Configure DNS

Add these A records in your DNS provider:
- `app.gratonite.chat` → your server IP
- `api.gratonite.chat` → your server IP

### 9. Test Deployment

```bash
# Check API health
curl http://localhost:4000/health

# Check from outside
curl https://api.gratonite.chat/health
```

Visit:
- https://gratonite.chat (landing page - should still work)
- https://app.gratonite.chat (new app)
- https://api.gratonite.chat/health (API health check)

## Troubleshooting

### Check container logs
```bash
docker logs -f gratonite-api
docker logs -f gratonite-postgres
docker logs -f gratonite-redis
```

### Check container status
```bash
docker compose -f docker-compose.production.yml ps
```

### Restart containers
```bash
docker compose -f docker-compose.production.yml restart
```

### Database connection issues
```bash
# Connect to database
docker exec -it gratonite-postgres psql -U gratonite -d gratonite

# Check tables
\dt
```

### API not starting
```bash
# Check environment variables
docker exec gratonite-api env

# Check if port is available
docker exec gratonite-api netstat -tlnp
```

## Maintenance

### View logs
```bash
docker logs -f gratonite-api
```

### Restart services
```bash
docker compose -f docker-compose.production.yml restart api
```

### Update application
```bash
# Build locally, upload, then:
docker compose -f docker-compose.production.yml restart api web
```

### Backup database
```bash
docker exec gratonite-postgres pg_dump -U gratonite gratonite > backup_$(date +%Y%m%d).sql
```

### Stop everything
```bash
docker compose -f docker-compose.production.yml down
```

### Start everything
```bash
docker compose -f docker-compose.production.yml up -d
```

## Security Checklist

- [ ] JWT secrets generated and set
- [ ] Database password changed from default
- [ ] SMTP credentials configured
- [ ] DNS records updated
- [ ] SSL certificates (Caddy handles automatically)
- [ ] Firewall configured (Docker handles)
- [ ] Regular backups scheduled

## Next Steps

1. Test all features
2. Monitor logs for errors
3. Set up monitoring (optional)
4. Configure backups
5. Invite users!

