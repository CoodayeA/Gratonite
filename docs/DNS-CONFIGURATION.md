# DNS Configuration

This guide covers DNS setup for a self-hosted Gratonite deployment.

## Required DNS Records

Create **A records** pointing to your server's IP address for each subdomain:

| Type | Name        | Value              | TTL  |
|------|-------------|--------------------|------|
| A    | `@`         | `<your-server-ip>` | 300  |
| A    | `api`       | `<your-server-ip>` | 300  |
| A    | `app`       | `<your-server-ip>` | 300  |

- `yourdomain.com` — landing page
- `api.yourdomain.com` — API server
- `app.yourdomain.com` — web client

If you serve the web client from a subpath (e.g. `yourdomain.com/app`), the `app` record is not needed.

## Optional: IPv6

Add **AAAA records** for each subdomain if your server supports IPv6:

| Type | Name  | Value               | TTL  |
|------|-------|---------------------|------|
| AAAA | `@`   | `<your-server-ipv6>`| 300  |
| AAAA | `api` | `<your-server-ipv6>`| 300  |
| AAAA | `app` | `<your-server-ipv6>`| 300  |

## Verification

```bash
# Check A record resolution
dig api.yourdomain.com +short
dig app.yourdomain.com +short

# Or use nslookup
nslookup api.yourdomain.com
```

DNS propagation typically takes 5–30 minutes. You can monitor it at [dnschecker.org](https://dnschecker.org).

## SSL / TLS

If you use the default Docker Compose setup with Caddy, SSL certificates are provisioned automatically via Let's Encrypt once DNS records resolve to your server. No manual certificate setup is required.

## Troubleshooting

**DNS not resolving after 30 minutes:**
- Verify the record was saved with the correct IP
- Flush your local DNS cache:
  ```bash
  # macOS
  sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
  # Linux
  sudo systemd-resolve --flush-caches
  # Windows
  ipconfig /flushdns
  ```

**SSL certificate not provisioning:**
- Confirm DNS is resolving: `dig api.yourdomain.com +short`
- Check Caddy logs: `docker logs gratonite-caddy`
- Caddy retries automatically — wait a few minutes after DNS propagation
