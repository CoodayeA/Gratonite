# Quick Deploy Guide - Gratonite

**Status:** ✅ READY TO DEPLOY  
**Time to Production:** 2-3 days with infrastructure setup

---

## ✅ Pre-Deployment Checklist

- [x] All code complete
- [x] All builds passing
- [x] Zero lint warnings
- [x] Security vulnerabilities patched
- [x] Database migrations ready
- [ ] Infrastructure provisioned
- [ ] Environment variables configured
- [ ] Monitoring set up

---

## 🚀 Quick Start (Staging)

### 1. Set Up Infrastructure (1-2 hours)
```bash
# Option A: Use managed services (recommended)
# - DigitalOcean App Platform
# - Heroku
# - Railway
# - Render

# Option B: Use Docker Compose (for staging)
cd apps/api
docker compose up -d  # Starts PostgreSQL, Redis, LiveKit
```

### 2. Configure Environment (30 minutes)
```bash
# Backend (.env)
cd apps/api
cp .env.example .env

# Edit .env and set:
DATABASE_URL=postgresql://user:pass@host:5432/gratonite
REDIS_URL=redis://host:6379
JWT_SECRET=<generate-32-char-random-string>
JWT_REFRESH_SECRET=<generate-different-32-char-string>
SMTP_HOST=smtp.sendgrid.net  # or your SMTP provider
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<your-sendgrid-api-key>
APP_URL=https://your-domain.com
CORS_ORIGIN=https://your-domain.com
LIVEKIT_URL=wss://gratonite-80q9d3up.livekit.cloud
LIVEKIT_API_KEY=APImsBH6DEXWux9
LIVEKIT_API_SECRET=WFdpecnQnFqs8j9m9SyOhuJOkFcLlClVRSenKBeMelBB

# Frontend (.env.local)
cd apps/web
echo "VITE_API_URL=https://api.your-domain.com" > .env.local
```

### 3. Run Database Migrations (5 minutes)
```bash
cd apps/api
pnpm install
pnpm run db:migrate
```

### 4. Build and Deploy (10 minutes)
```bash
# Backend
cd apps/api
pnpm run build
pnpm start  # or use PM2: pm2 start dist/index.js

# Frontend
cd apps/web
pnpm run build
# Serve dist/ folder with Nginx, Caddy, or CDN
```

### 5. Verify Deployment (15 minutes)
- [ ] Visit frontend URL
- [ ] Register a new account
- [ ] Verify email works
- [ ] Create a guild
- [ ] Send a message
- [ ] Join voice channel
- [ ] Check admin panel

---

## 🔧 Production Configuration

### Required Environment Variables

#### Backend (apps/api/.env)
```env
# Database (required)
DATABASE_URL=postgresql://user:pass@host:5432/gratonite

# Redis (required)
REDIS_URL=redis://host:6379

# JWT Secrets (required - generate random 32+ char strings)
JWT_SECRET=<CHANGE_ME_32_CHARS_MIN>
JWT_REFRESH_SECRET=<CHANGE_ME_DIFFERENT_32_CHARS>

# SMTP (required for email)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<your-api-key>
SMTP_FROM=noreply@your-domain.com

# URLs (required)
APP_URL=https://your-domain.com
CORS_ORIGIN=https://your-domain.com
PORT=4000

# LiveKit (required for voice/video)
LIVEKIT_URL=wss://gratonite-80q9d3up.livekit.cloud
LIVEKIT_API_KEY=APImsBH6DEXWux9
LIVEKIT_API_SECRET=WFdpecnQnFqs8j9m9SyOhuJOkFcLlClVRSenKBeMelBB
```

#### Frontend (apps/web/.env.local)
```env
VITE_API_URL=https://api.your-domain.com
```

### Generate Secure Secrets
```bash
# Generate JWT secrets (run twice for two different secrets)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📦 Deployment Options

### Option 1: Managed Platform (Easiest)
**Recommended for:** Quick deployment, minimal DevOps

**Platforms:**
- **Railway** - One-click deploy, auto-scaling
- **Render** - Free tier available, easy setup
- **Heroku** - Classic PaaS, well-documented
- **DigitalOcean App Platform** - Simple, affordable

**Steps:**
1. Connect GitHub repo
2. Set environment variables in dashboard
3. Deploy with one click
4. Platform handles SSL, scaling, monitoring

### Option 2: VPS (Most Control)
**Recommended for:** Custom setup, cost optimization

**Providers:**
- **DigitalOcean** - $12/month droplet
- **Linode** - Similar pricing
- **Vultr** - Good performance
- **Hetzner** - Cheapest option

**Steps:**
1. Provision VPS (Ubuntu 22.04 recommended)
2. Install Node.js, PostgreSQL, Redis
3. Set up Nginx reverse proxy
4. Configure SSL with Let's Encrypt
5. Use PM2 for process management

### Option 3: Docker (Containerized)
**Recommended for:** Consistent environments

**Steps:**
1. Create Dockerfile for backend
2. Create Dockerfile for frontend
3. Use docker-compose for orchestration
4. Deploy to any Docker host

---

## 🔍 Monitoring Setup

### Error Tracking (Recommended: Sentry)
```bash
# Install Sentry SDK
cd apps/api
pnpm add @sentry/node

# Add to src/index.ts
import * as Sentry from '@sentry/node';
Sentry.init({ dsn: 'your-sentry-dsn' });
```

### Logging
```bash
# Install Winston
pnpm add winston

# Replace console.log with structured logging
```

### Health Checks
```typescript
// Add to src/index.ts
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});
```

---

## 🚨 Common Issues

### Issue: Database connection fails
**Solution:** Check DATABASE_URL format and firewall rules

### Issue: CORS errors
**Solution:** Ensure CORS_ORIGIN matches frontend URL exactly

### Issue: Email not sending
**Solution:** Verify SMTP credentials and check spam folder

### Issue: Voice not working
**Solution:** Verify LiveKit credentials and WebSocket connection

### Issue: Build fails
**Solution:** Run `pnpm install` and check Node.js version (18+)

---

## 📊 Performance Tips

### Backend
- Use connection pooling for PostgreSQL
- Enable Redis persistence
- Set up CDN for file uploads
- Use PM2 cluster mode for multi-core

### Frontend
- Enable gzip compression
- Use CDN for static assets
- Enable browser caching
- Consider code splitting

### Database
- Add indexes for frequently queried columns
- Set up read replicas for scaling
- Enable query logging for optimization
- Regular VACUUM and ANALYZE

---

## 🔐 Security Checklist

- [ ] Change all default passwords
- [ ] Generate strong JWT secrets
- [ ] Enable SSL/TLS (HTTPS)
- [ ] Set up firewall rules
- [ ] Enable rate limiting
- [ ] Set up database backups
- [ ] Configure CORS properly
- [ ] Use environment variables (never commit secrets)
- [ ] Enable security headers (Helmet.js)
- [ ] Set up DDoS protection (Cloudflare)

---

## 📈 Scaling Strategy

### Phase 1: Single Server (0-1K users)
- One VPS with everything
- PostgreSQL + Redis on same server
- Cost: ~$20/month

### Phase 2: Separated Services (1K-10K users)
- Separate database server
- Separate Redis server
- Multiple API instances behind load balancer
- Cost: ~$100/month

### Phase 3: Distributed (10K+ users)
- Database read replicas
- Redis cluster
- CDN for static assets
- Auto-scaling API instances
- Cost: ~$500+/month

---

## 🎯 Launch Checklist

### Pre-Launch
- [ ] Deploy to staging
- [ ] Test all features
- [ ] Load test critical endpoints
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Prepare rollback plan

### Launch Day
- [ ] Deploy to production
- [ ] Verify all services running
- [ ] Test critical flows
- [ ] Monitor error rates
- [ ] Watch server resources
- [ ] Be ready to rollback

### Post-Launch
- [ ] Monitor for 24-48 hours
- [ ] Fix critical bugs immediately
- [ ] Gather user feedback
- [ ] Plan next features

---

## 📞 Quick Commands

```bash
# Start development
cd apps/api && docker compose up -d
cd apps/api && pnpm run dev
cd apps/web && pnpm run dev

# Build for production
cd apps/api && pnpm run build
cd apps/web && pnpm run build

# Run migrations
cd apps/api && pnpm run db:migrate

# Check logs (PM2)
pm2 logs gratonite-api

# Restart service (PM2)
pm2 restart gratonite-api

# Database backup
pg_dump -U user -h host gratonite > backup.sql
```

---

## 🎉 You're Ready!

Your Gratonite platform is production-ready. Follow this guide to deploy in 2-3 days.

**Need help?** Check `docs/PRODUCTION-READINESS-ASSESSMENT.md` for detailed information.

**Good luck! 🚀**
