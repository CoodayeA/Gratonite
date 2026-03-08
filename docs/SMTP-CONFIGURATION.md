# SMTP Configuration

Gratonite sends transactional emails for account verification, password resets, and optional notification digests. This guide covers setting up SMTP for your self-hosted deployment.

## Environment Variables

Set these in your `.env` file (or `docker-compose.yml` environment section):

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@yourdomain.com
```

## Provider Examples

### SendGrid (free tier: 100 emails/day)

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Create an API key under **Settings > API Keys**
3. Configure:
   ```env
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASS=SG.your_api_key_here
   SMTP_FROM=noreply@yourdomain.com
   ```

### Gmail (free, 500 emails/day limit)

1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Configure:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=you@gmail.com
   SMTP_PASS=your-16-char-app-password
   SMTP_FROM=you@gmail.com
   ```

### Mailgun (free tier: 100 emails/day)

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@yourdomain.com
SMTP_PASS=your-mailgun-password
SMTP_FROM=noreply@yourdomain.com
```

### Amazon SES (free with AWS Free Tier)

```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-smtp-user
SMTP_PASS=your-ses-smtp-password
SMTP_FROM=noreply@yourdomain.com
```

## Applying Changes

After updating SMTP settings, restart the API container:

```bash
docker restart gratonite-api
```

## Testing

1. Register a new account through the web client
2. Check API logs for email status:
   ```bash
   docker logs gratonite-api --tail 50 | grep -i email
   ```
3. Check your inbox (and spam folder) for the verification email

## Improving Deliverability

To avoid emails landing in spam:
- Verify your sending domain with your SMTP provider
- Add **SPF**, **DKIM**, and **DMARC** DNS records as directed by your provider
- Use a professional `SMTP_FROM` address on your own domain

## Troubleshooting

| Error | Solution |
|-------|----------|
| `Authentication failed` | Double-check username/password; for Gmail use an App Password |
| `Connection timeout` | Ensure port 587 is not blocked by your firewall; try port 465 or 2525 |
| Emails going to spam | Set up SPF/DKIM/DMARC records; verify domain with provider |
