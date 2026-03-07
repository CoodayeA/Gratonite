# DNS Configuration for Gratonite

## Server Information
- **Server IP (IPv4):** `<your-server-ipv4>`
- **Server IP (IPv6):** `<your-server-ipv6>`
- **Domain:** gratonite.chat

---

## Required DNS Record

Add this A record to your DNS provider:

```
Type: A
Name: app
Value: <your-server-ipv4>
TTL: 300 (or Auto)
```

This will make your app accessible at: **https://app.gratonite.chat**

---

## Where to Add DNS Record

### If using Hetzner DNS:
1. Go to https://dns.hetzner.com
2. Select your domain `gratonite.chat`
3. Click "Add Record"
4. Select type: A
5. Name: app
6. Value: <your-server-ipv4>
7. TTL: 300
8. Save

### If using another DNS provider:
1. Log into your DNS provider (Cloudflare, Namecheap, GoDaddy, etc.)
2. Find DNS management for gratonite.chat
3. Add new A record:
   - Host/Name: app
   - Type: A
   - Value/Points to: <your-server-ipv4>
   - TTL: 300 or Auto
4. Save changes

---

## Verification

### Check DNS Propagation
```bash
# Check if DNS is configured
dig app.gratonite.chat

# Or use online tool
# https://dnschecker.org/#A/app.gratonite.chat
```

### Test the Application
Once DNS propagates (5-30 minutes), visit:
- https://app.gratonite.chat

Caddy will automatically provision an SSL certificate for the subdomain.

---

## Current Status

✅ **api.gratonite.chat** - LIVE (Backend API)  
✅ **gratonite.chat** - LIVE (Landing page)  
⏳ **app.gratonite.chat** - Waiting for DNS configuration

---

## What Happens After DNS is Configured?

1. DNS propagates (5-30 minutes)
2. Caddy detects the new subdomain
3. Caddy automatically requests SSL certificate from Let's Encrypt
4. Certificate is issued (usually within 1 minute)
5. Your app becomes accessible at https://app.gratonite.chat
6. Users can register, login, and use all features

---

## Testing After DNS Configuration

```bash
# Test DNS resolution
dig app.gratonite.chat

# Test HTTPS access
curl -I https://app.gratonite.chat

# Should return 200 OK with HTML
```

---

## Optional: IPv6 Support

If you want to support IPv6, also add an AAAA record:

```
Type: AAAA
Name: app
Value: <your-server-ipv6>
TTL: 300
```

---

## Troubleshooting

### DNS not resolving after 30 minutes?
- Check if you added the record to the correct domain
- Verify the IP address is correct for your server
- Try flushing your local DNS cache:
  ```bash
  # macOS
  sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
  
  # Windows
  ipconfig /flushdns
  
  # Linux
  sudo systemd-resolve --flush-caches
  ```

### SSL certificate not provisioning?
- Wait a few minutes after DNS propagates
- Check Caddy logs: `docker logs gratonite-caddy-1`
- Caddy will automatically retry

### App not loading?
- Verify DNS is resolving: `dig app.gratonite.chat`
- Check if containers are running: `docker ps`
- Check web container logs: `docker logs gratonite-web`

---

**Next Step:** Add the DNS record and wait for propagation!
