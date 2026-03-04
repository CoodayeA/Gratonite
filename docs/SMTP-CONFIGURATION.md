# SMTP Configuration Guide

**Status:** Email verification is currently failing due to placeholder SMTP credentials

---

## Current Issue

The API is configured with placeholder SMTP credentials:
```
SMTP_HOST: smtp.sendgrid.net
SMTP_PORT: 587
SMTP_USER: apikey
SMTP_PASS: YOUR_SENDGRID_API_KEY  ← This is a placeholder!
SMTP_FROM: noreply@gratonite.chat
```

Error in logs:
```
Failed to send verification email: Error: Invalid login: 535 Authentication failed
```

---

## Solution Options

### Option 1: SendGrid (Recommended - Free Tier Available)

SendGrid offers 100 emails/day on their free tier, which is perfect for getting started.

**Steps:**

1. **Sign up for SendGrid**
   - Go to https://sendgrid.com/pricing/ and sign up for the free tier
   - Verify your email address

2. **Create an API Key**
   - Log in to SendGrid dashboard
   - Go to Settings → API Keys
   - Click "Create API Key"
   - Name it "Gratonite Production"
   - Select "Full Access" or "Restricted Access" with Mail Send permissions
   - Copy the API key (you won't be able to see it again!)

3. **Update the Configuration**
   ```bash
   ssh -i ~/.ssh/codex_gratonite_hetzner ferdinand@gratonite.chat
   
   # Edit the docker-compose file
   nano /home/ferdinand/gratonite-app/docker-compose.production.yml
   
   # Find the line:
   #   SMTP_PASS: YOUR_SENDGRID_API_KEY
   # Replace with:
   #   SMTP_PASS: SG.your_actual_api_key_here
   
   # Save and exit (Ctrl+X, Y, Enter)
   
   # Restart the API
   docker restart gratonite-api
   ```

4. **Verify Domain (Optional but Recommended)**
   - In SendGrid dashboard, go to Settings → Sender Authentication
   - Verify your domain (gratonite.chat) to improve deliverability
   - Add the required DNS records to your domain

---

### Option 2: Gmail SMTP (Quick Setup)

If you have a Gmail account, you can use it for testing.

**Steps:**

1. **Enable 2-Factor Authentication**
   - Go to https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Generate App Password**
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Name it "Gratonite"
   - Copy the 16-character password

3. **Update Configuration**
   ```bash
   ssh -i ~/.ssh/codex_gratonite_hetzner ferdinand@gratonite.chat
   nano /home/ferdinand/gratonite-app/docker-compose.production.yml
   
   # Update these lines:
   #   SMTP_HOST: smtp.gmail.com
   #   SMTP_PORT: 587
   #   SMTP_USER: your.email@gmail.com
   #   SMTP_PASS: your_16_char_app_password
   #   SMTP_FROM: your.email@gmail.com
   
   # Restart the API
   docker restart gratonite-api
   ```

**Note:** Gmail has a sending limit of 500 emails/day for free accounts.

---

### Option 3: Other Email Services

You can also use:

- **Mailgun** (100 emails/day free)
  - SMTP_HOST: smtp.mailgun.org
  - SMTP_PORT: 587
  
- **Amazon SES** (62,000 emails/month free with AWS Free Tier)
  - SMTP_HOST: email-smtp.us-east-1.amazonaws.com
  - SMTP_PORT: 587

- **Postmark** (100 emails/month free)
  - SMTP_HOST: smtp.postmarkapp.com
  - SMTP_PORT: 587

---

## Quick Update Command

Once you have your SMTP credentials, use this command to update:

```bash
ssh -i ~/.ssh/codex_gratonite_hetzner ferdinand@gratonite.chat "sed -i 's|SMTP_PASS: YOUR_SENDGRID_API_KEY|SMTP_PASS: YOUR_ACTUAL_KEY_HERE|g' /home/ferdinand/gratonite-app/docker-compose.production.yml && docker restart gratonite-api"
```

Replace `YOUR_ACTUAL_KEY_HERE` with your real API key.

---

## Testing Email Delivery

After updating the SMTP configuration:

1. **Register a new account** at https://gratonite.chat/app/register
2. **Check the API logs** for email sending status:
   ```bash
   ssh -i ~/.ssh/codex_gratonite_hetzner ferdinand@gratonite.chat "docker logs gratonite-api --tail 50 | grep -i 'email\|smtp'"
   ```
3. **Check your inbox** (and spam folder) for the verification email

---

## Troubleshooting

### "Authentication failed" Error
- Double-check your API key/password is correct
- Make sure there are no extra spaces or quotes
- For Gmail, ensure you're using an App Password, not your regular password

### Emails Going to Spam
- Verify your domain with your email provider
- Set up SPF, DKIM, and DMARC DNS records
- Use a professional "from" address (e.g., noreply@gratonite.chat)

### "Connection timeout" Error
- Check that port 587 is not blocked by your firewall
- Try port 465 (SSL) or 2525 as alternatives

---

## Current Configuration Location

The SMTP settings are in:
```
/home/ferdinand/gratonite-app/docker-compose.production.yml
```

Under the `api` service, in the `environment` section.

---

## Next Steps

1. Choose an email service provider (SendGrid recommended)
2. Get your SMTP credentials
3. Update the docker-compose.production.yml file
4. Restart the API container
5. Test registration with a real email address

---

**Need Help?** Check the API logs for detailed error messages:
```bash
docker logs gratonite-api --tail 100 | grep -i email
```
