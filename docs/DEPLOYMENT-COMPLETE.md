# Gratonite Deployment - COMPLETE ✅

**Date:** March 4, 2026  
**Server:** gratonite.chat (Hetzner)  
**Status:** API DEPLOYED AND LIVE

---

## ✅ What's Deployed

### Backend API
- **URL:** https://api.gratonite.chat
- **Status:** ✅ LIVE AND RUNNING
- **Health Check:** https://api.gratonite.chat/health
- **Container:** `gratonite-api` (Node.js 20)
- **Database:** PostgreSQL 16 (all 11 migrations applied)
- **Cache:** Redis 7
- **Process Manager:** Docker Compose

### Database
- **Type:** PostgreSQL 16 (Alpine)
- **Container:** `gratonite-postgres`
- **Status:** ✅ Healthy
- **Migrations:** ✅ All 11 migrations applied successfully
- **Password:** Secure random password generated

### Cache
- **Type:** Redis 7 (Alpine)
- **Container:** `gratonite-redis`
- **Status:** ✅ Healthy
- **Persistence:** Enabled (AOF)

### Frontend (Staging)
- **Container:** `gratonite-web` (Nginx)
- **Status:** ✅ Running
- **Build:** Production build with API URL: https://api.gratonite.chat
- **Waiting for:** DNS configuration for app.gratonite.chat

### Reverse Proxy
- **Type:** Caddy 2.11
- **Container:** `gratonite-caddy-1` (existing)
- **SSL:** ✅ Automatic HTTPS with Let's Encrypt
- **Status:** ✅ Running
- **Routes:**
  - gratonite.chat → Landing page (existing)
  - api.gratonite.chat → Backend API (NEW)
  - app.gratonite.chat → Frontend app (READY, needs DNS)

---

## 🎯 Current Status

### Working Now
✅ Backend API is live at https://api.gratonite.chat  
✅ Database is running with all tables created  
✅ Redis cache is operational  
✅ SSL certificates are active  
✅ Landing page still works at https://gratonite.chat  
✅ All Docker containers healthy  

### Needs DNS Configuration
⏳ app.gratonite.chat - Add A record pointing to server IP

---

## 📋 Next Steps

### 1. Configure DNS (REQUIRED)

Add this A record in your DNS provider (Hetzner DNS or wherever your domain is managed):

```
Type: A
Name: app
Value: [Your server IP address]
TTL: 300 (or default)
```

To find your server IP:
```bash
ssh -i ~/.ssh/codex_gratonite_hetzner ferdinand@gratonite.chat "curl -s ifconfig.me"
```

### 2. Wait for DNS Propagation (5-30 minutes)

Check DNS propagation:
```bash
dig app.gratonite.chat
# or
nslookup app.gratonite.chat
```

### 3. Test the Application

Once DNS is configured, visit:
- https://app.gratonite.chat

Caddy will automatically provision SSL certificate for app.gratonite.chat

### 4. Configure SMTP (Optional but Recommended)

Update the SMTP settings in `/home/ferdinand/gratonite-app/.env.production`:

```bash
ssh -i ~/.ssh/codex_gratonite_hetzner ferdinand@gratonite.chat
nano /home/ferdinand/gratonite-app/.env.production
```

Update these lines:
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=YOUR_SENDGRID_API_KEY_HERE
```

Then restart the API:
```bash
docker restart gratonite-api
```

---

## 🔧 Management Commands

### View Logs
```bash
# API logs
docker logs -f gratonite-api

# Database logs
docker logs -f gratonite-postgres

# Redis logs
docker logs -f gratonite-redis

# Web logs
docker logs -f gratonite-web

# Caddy logs
docker logs -f gratonite-caddy-1
```

### Restart Services
```bash
# Restart API
docker restart gratonite-api

# Restart all services
cd /home/ferdinand/gratonite-app
docker compose -f docker-compose.production.yml restart
```

### Check Status
```bash
# Container status
docker ps

# API health
curl https://api.gratonite.chat/health

# Check specific container
docker inspect gratonite-api
```

### Database Access
```bash
# Connect to database
docker exec -it gratonite-postgres psql -U gratonite -d gratonite

# Inside psql:
\dt              # List tables
\d users         # Describe users table
SELECT COUNT(*) FROM users;
\q               # Quit
```

### Backup Database
```bash
# Create backup
docker exec gratonite-postgres pg_dump -U gratonite gratonite > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
cat backup_file.sql | docker exec -i gratonite-postgres psql -U gratonite -d gratonite
```

### Update Application
```bash
# On your local machine:
cd "/Volumes/Project BUS/GratoniteFinalForm"

# Build
cd apps/api && pnpm run build && cd ../..
cd apps/web && pnpm run build && cd ../..

# Upload
rsync -avz -e "ssh -i ~/.ssh/codex_gratonite_hetzner" \
  apps/api/dist/ ferdinand@gratonite.chat:/home/ferdinand/gratonite-app/api/dist/

rsync -avz -e "ssh -i ~/.ssh/codex_gratonite_hetzner" \
  apps/web/dist/ ferdinand@gratonite.chat:/home/ferdinand/gratonite-app/web/dist/

# Restart
ssh -i ~/.ssh/codex_gratonite_hetzner ferdinand@gratonite.chat \
  "docker restart gratonite-api gratonite-web"
```

---

## 🔒 Security Information

### Generated Secrets
- ✅ JWT_SECRET: Generated and configured
- ✅ JWT_REFRESH_SECRET: Generated and configured
- ✅ DB_PASSWORD: Secure random password generated

### LiveKit Credentials
- ✅ LIVEKIT_URL: wss://gratonite-80q9d3up.livekit.cloud
- ✅ LIVEKIT_API_KEY: Configured
- ✅ LIVEKIT_API_SECRET: Configured

### SSL/TLS
- ✅ Automatic HTTPS via Caddy + Let's Encrypt
- ✅ Certificates auto-renew
- ✅ HTTPS enforced

---

## 📊 Container Details

```
CONTAINER NAME         IMAGE                STATUS      PORTS
gratonite-api          node:20-alpine       Healthy     Internal
gratonite-postgres     postgres:16-alpine   Healthy     Internal
gratonite-redis        redis:7-alpine       Healthy     Internal
gratonite-web          nginx:alpine         Running     Internal
gratonite-caddy-1      caddy:2.11          Running     80, 443
```

### Networks
- `gratonite-app_gratonite-network` - Internal network for new containers
- `gratonite_default` - Original network (landing page)
- Caddy is connected to both networks

### Volumes
- `gratonite-app_postgres_data` - Database storage
- `gratonite-app_redis_data` - Redis persistence
- `gratonite-app_api_uploads` - File uploads
- `gratonite_caddy_config` - Caddy configuration
- `gratonite_caddy_data` - SSL certificates

---

## 🧪 Testing Checklist

Once DNS is configured, test these features:

### Authentication
- [ ] Register new account
- [ ] Verify email (if SMTP configured)
- [ ] Login
- [ ] Logout
- [ ] Refresh token

### Guilds
- [ ] Create guild
- [ ] Create channels
- [ ] Send messages
- [ ] Upload files
- [ ] React to messages
- [ ] Pin messages

### Voice/Video
- [ ] Join voice channel
- [ ] Test audio
- [ ] Test video
- [ ] Screen share

### Real-Time
- [ ] Messages appear instantly
- [ ] Typing indicators work
- [ ] Presence updates (online/offline)
- [ ] Notifications

### Economy
- [ ] Check wallet
- [ ] Daily reward
- [ ] Shop purchases
- [ ] Marketplace

---

## 🐛 Troubleshooting

### API Not Responding
```bash
# Check if container is running
docker ps | grep gratonite-api

# Check logs
docker logs gratonite-api --tail 50

# Restart
docker restart gratonite-api
```

### Database Connection Issues
```bash
# Check if postgres is healthy
docker ps | grep gratonite-postgres

# Check logs
docker logs gratonite-postgres

# Test connection
docker exec gratonite-api sh -c 'wget -qO- http://localhost:4000/health'
```

### Frontend Not Loading
```bash
# Check DNS
dig app.gratonite.chat

# Check if web container is running
docker ps | grep gratonite-web

# Check Caddy logs
docker logs gratonite-caddy-1 --tail 50
```

### SSL Certificate Issues
```bash
# Check Caddy logs
docker logs gratonite-caddy-1 | grep -i cert

# Force certificate renewal
docker exec gratonite-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

---

## 📈 Monitoring

### Health Checks
```bash
# API health
curl https://api.gratonite.chat/health

# Should return:
# {"status":"ok","ts":1234567890}
```

### Resource Usage
```bash
# Container stats
docker stats

# Disk usage
docker system df

# Volume sizes
docker volume ls
du -sh /var/lib/docker/volumes/gratonite-app_*
```

---

## 🎉 Success Metrics

✅ API responding at https://api.gratonite.chat  
✅ Health check returns 200 OK  
✅ Database migrations applied (11/11)  
✅ All containers healthy  
✅ SSL certificates active  
✅ Landing page preserved  
✅ Zero downtime deployment  

---

## 📞 Support

### Logs Location
- API: `docker logs gratonite-api`
- Database: `docker logs gratonite-postgres`
- All logs: `docker compose -f /home/ferdinand/gratonite-app/docker-compose.production.yml logs`

### Configuration Files
- Docker Compose: `/home/ferdinand/gratonite-app/docker-compose.production.yml`
- Environment: `/home/ferdinand/gratonite-app/.env.production`
- Nginx: `/home/ferdinand/gratonite-app/web/nginx.conf`

### Quick Commands
```bash
# SSH into server
ssh -i ~/.ssh/codex_gratonite_hetzner ferdinand@gratonite.chat

# Check everything
docker ps && docker compose -f /home/ferdinand/gratonite-app/docker-compose.production.yml ps

# View all logs
docker compose -f /home/ferdinand/gratonite-app/docker-compose.production.yml logs -f
```

---

**Deployment Status:** ✅ BACKEND LIVE  
**Next Step:** Configure DNS for app.gratonite.chat  
**ETA to Full Launch:** 5-30 minutes (DNS propagation)

🚀 **You're almost there!**
