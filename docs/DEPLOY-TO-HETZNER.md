# Deploy Gratonite to Hetzner Server

**Server:** gratonite.chat  
**User:** ferdinand  
**SSH Key:** `~/.ssh/id_ed25519_hetzner` or `~/.ssh/codex_gratonite_hetzner`  
**Status:** Landing page currently live

---

## Deployment Strategy

### Current Setup
- Landing page at `https://gratonite.chat`
- Login page at `https://gratonite.chat/login`

### New Setup (Recommended)
- Landing page at `https://gratonite.chat` (keep existing)
- Full app at `https://app.gratonite.chat` (new subdomain)
- API at `https://api.gratonite.chat` (new subdomain)

**OR** (Alternative)

- Landing page at `https://gratonite.chat` (keep existing)
- Full app at `https://gratonite.chat/app` (replace /login)
- API at `https://gratonite.chat/api` (new path)

---

## Pre-Deployment Checklist

### 1. Server Requirements
- [ ] Node.js 18+ installed
- [ ] PostgreSQL installed
- [ ] Redis installed
- [ ] Nginx installed (for reverse proxy)
- [ ] PM2 installed (for process management)
- [ ] SSL certificates (Let's Encrypt)

### 2. DNS Configuration
If using subdomains:
- [ ] Add A record: `app.gratonite.chat` → server IP
- [ ] Add A record: `api.gratonite.chat` → server IP

### 3. Environment Preparation
- [ ] Generate JWT secrets
- [ ] Set up SMTP credentials
- [ ] Prepare database credentials

---

## Step-by-Step Deployment

### Step 1: Connect to Server

```bash
# Test SSH connection
ssh -i ~/.ssh/id_ed25519_hetzner ferdinand@gratonite.chat

# Or if using the other key
ssh -i ~/.ssh/codex_gratonite_hetzner ferdinand@gratonite.chat
```

### Step 2: Install Dependencies (if needed)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server

# Install PM2 globally
sudo npm install -g pm2

# Install pnpm
sudo npm install -g pnpm

# Verify installations
node --version  # Should be v20.x
psql --version
redis-cli --version
pm2 --version
```

### Step 3: Set Up Database

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt:
CREATE DATABASE gratonite;
CREATE USER gratonite WITH PASSWORD 'CHANGE_THIS_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE gratonite TO gratonite;
\q

# Test connection
psql -U gratonite -d gratonite -h localhost
```

### Step 4: Clone and Build Application

```bash
# Create app directory
sudo mkdir -p /var/www/gratonite
sudo chown ferdinand:ferdinand /var/www/gratonite
cd /var/www/gratonite

# Clone from your local machine (or use git if you have a repo)
# For now, we'll upload the built files

# Create directory structure
mkdir -p api web
```

### Step 5: Upload Application Files

From your local machine:

```bash
# Build the application first
cd "/Volumes/Project BUS/GratoniteFinalForm"

# Build backend
cd apps/api
pnpm install
pnpm run build

# Build frontend
cd ../web
pnpm install
pnpm run build

# Upload backend to server
cd "/Volumes/Project BUS/GratoniteFinalForm/apps/api"
rsync -avz -e "ssh -i ~/.ssh/id_ed25519_hetzner" \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude 'uploads' \
  . ferdinand@gratonite.chat:/var/www/gratonite/api/

# Upload frontend build to server
cd "/Volumes/Project BUS/GratoniteFinalForm/apps/web"
rsync -avz -e "ssh -i ~/.ssh/id_ed25519_hetzner" \
  dist/ ferdinand@gratonite.chat:/var/www/gratonite/web/
```

### Step 6: Configure Environment Variables

On the server:

```bash
cd /var/www/gratonite/api

# Create .env file
cat > .env << 'EOF'
# Database
DATABASE_URL=postgresql://gratonite:CHANGE_THIS_PASSWORD@localhost:5432/gratonite

# Redis
REDIS_URL=redis://localhost:6379

# JWT Secrets (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=GENERATE_32_CHAR_RANDOM_STRING
JWT_REFRESH_SECRET=GENERATE_DIFFERENT_32_CHAR_STRING

# SMTP (use your email provider)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=YOUR_SENDGRID_API_KEY
SMTP_FROM=noreply@gratonite.chat

# URLs
APP_URL=https://app.gratonite.chat
CORS_ORIGIN=https://app.gratonite.chat
PORT=4000

# LiveKit
LIVEKIT_URL=wss://gratonite-80q9d3up.livekit.cloud
LIVEKIT_API_KEY=APImsBH6DEXWux9
LIVEKIT_API_SECRET=WFdpecnQnFqs8j9m9SyOhuJOkFcLlClVRSenKBeMelBB
EOF

# Generate JWT secrets
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(32).toString('hex')"

# Edit .env and paste the generated secrets
nano .env
```

### Step 7: Install Backend Dependencies and Run Migrations

```bash
cd /var/www/gratonite/api

# Install production dependencies
pnpm install --prod

# Run database migrations
pnpm run db:migrate

# Test the backend
node dist/index.js
# Press Ctrl+C after verifying it starts
```

### Step 8: Set Up PM2 for Backend

```bash
cd /var/www/gratonite/api

# Start with PM2
pm2 start dist/index.js --name gratonite-api

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
# Follow the command it outputs

# Check status
pm2 status
pm2 logs gratonite-api
```

### Step 9: Configure Nginx

```bash
# Create Nginx configuration for API
sudo nano /etc/nginx/sites-available/gratonite-api

# Paste this configuration:
```

```nginx
server {
    listen 80;
    server_name api.gratonite.chat;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket support
        proxy_read_timeout 86400;
    }
}
```

```bash
# Create Nginx configuration for frontend
sudo nano /etc/nginx/sites-available/gratonite-app
```

```nginx
server {
    listen 80;
    server_name app.gratonite.chat;
    root /var/www/gratonite/web;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable sites
sudo ln -s /etc/nginx/sites-available/gratonite-api /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/gratonite-app /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 10: Set Up SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificates
sudo certbot --nginx -d api.gratonite.chat -d app.gratonite.chat

# Certbot will automatically configure HTTPS
# Follow the prompts

# Test auto-renewal
sudo certbot renew --dry-run
```

### Step 11: Configure Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# Check status
sudo ufw status
```

### Step 12: Verify Deployment

```bash
# Check backend is running
curl http://localhost:4000/health

# Check PM2 status
pm2 status

# Check Nginx status
sudo systemctl status nginx

# Check logs
pm2 logs gratonite-api
sudo tail -f /var/log/nginx/error.log
```

### Step 13: Test from Browser

1. Visit `https://api.gratonite.chat/health` - Should return `{"status":"ok"}`
2. Visit `https://app.gratonite.chat` - Should load the app
3. Try registering a new account
4. Test all features

---

## Alternative: Deploy Under Existing Domain

If you want to keep everything under `gratonite.chat`:

### Nginx Configuration (Single Domain)

```nginx
# Main site (existing landing page)
server {
    listen 80;
    server_name gratonite.chat;
    root /var/www/gratonite/landing;  # Your existing landing page
    index index.html;

    # API endpoint
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # App (replaces /login)
    location /app {
        alias /var/www/gratonite/web;
        try_files $uri $uri/ /app/index.html;
    }

    # Root landing page
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Then update frontend .env:
```env
VITE_API_URL=https://gratonite.chat/api
```

And backend .env:
```env
APP_URL=https://gratonite.chat/app
CORS_ORIGIN=https://gratonite.chat
```

---

## Maintenance Commands

```bash
# View logs
pm2 logs gratonite-api

# Restart backend
pm2 restart gratonite-api

# Stop backend
pm2 stop gratonite-api

# Update application
cd /var/www/gratonite/api
git pull  # or rsync from local
pnpm install --prod
pm2 restart gratonite-api

# Database backup
pg_dump -U gratonite gratonite > backup_$(date +%Y%m%d).sql

# Check disk space
df -h

# Check memory
free -h

# Check processes
pm2 status
```

---

## Troubleshooting

### Backend won't start
```bash
# Check logs
pm2 logs gratonite-api --lines 100

# Check if port 4000 is in use
sudo lsof -i :4000

# Check environment variables
cd /var/www/gratonite/api
cat .env
```

### Database connection fails
```bash
# Test PostgreSQL connection
psql -U gratonite -d gratonite -h localhost

# Check PostgreSQL is running
sudo systemctl status postgresql

# Check database exists
sudo -u postgres psql -l
```

### Nginx errors
```bash
# Check Nginx error log
sudo tail -f /var/log/nginx/error.log

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### SSL certificate issues
```bash
# Renew certificates manually
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

---

## Security Checklist

- [ ] Change default PostgreSQL password
- [ ] Set strong JWT secrets
- [ ] Configure firewall (UFW)
- [ ] Enable SSL/HTTPS
- [ ] Set up automatic security updates
- [ ] Configure fail2ban for SSH protection
- [ ] Set up database backups
- [ ] Monitor disk space
- [ ] Set up log rotation

---

## Next Steps After Deployment

1. **Test Everything**
   - Register account
   - Create guild
   - Send messages
   - Join voice
   - Test all features

2. **Monitor**
   - Watch PM2 logs for errors
   - Check Nginx access logs
   - Monitor server resources

3. **Optimize**
   - Set up Redis persistence
   - Configure PostgreSQL for production
   - Enable gzip compression in Nginx
   - Set up CDN for static assets

4. **Scale** (when needed)
   - Add more PM2 instances (cluster mode)
   - Set up database read replicas
   - Add Redis cluster
   - Use load balancer

---

## Quick Deploy Script

Save this as `deploy.sh` on your local machine:

```bash
#!/bin/bash
set -e

echo "Building application..."
cd "/Volumes/Project BUS/GratoniteFinalForm"

# Build backend
cd apps/api
pnpm run build

# Build frontend
cd ../web
pnpm run build

echo "Uploading to server..."
# Upload backend
rsync -avz -e "ssh -i ~/.ssh/id_ed25519_hetzner" \
  --exclude 'node_modules' \
  --exclude '.env' \
  apps/api/ ferdinand@gratonite.chat:/var/www/gratonite/api/

# Upload frontend
rsync -avz -e "ssh -i ~/.ssh/id_ed25519_hetzner" \
  apps/web/dist/ ferdinand@gratonite.chat:/var/www/gratonite/web/

echo "Restarting backend..."
ssh -i ~/.ssh/id_ed25519_hetzner ferdinand@gratonite.chat "cd /var/www/gratonite/api && pnpm install --prod && pm2 restart gratonite-api"

echo "Deployment complete!"
```

Make it executable:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

**Ready to deploy? Let me know if you want me to help with any specific step!**
