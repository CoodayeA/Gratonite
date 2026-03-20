# VPS Deploy Button Design

## Problem
Self-hosting on a VPS still requires SSH access and running a terminal command. We want a web-based "Deploy" button on gratonite.chat.

## Solution
A `/deploy` page on the Gratonite landing site with cloud provider integration. User clicks a provider → configures via web form → server provisioned automatically.

## User Flow
1. Visit `gratonite.chat/deploy`
2. Choose provider: Hetzner, DigitalOcean, Vultr
3. Enter: domain name, admin email, admin password
4. Authenticate with provider (API key or OAuth)
5. Click "Deploy" → we provision a server via their API
6. Progress screen: "Creating server... Installing Docker... Starting Gratonite..."
7. Done: "Your instance is live at https://your-domain.com"

## Phase 1: Cloud-Init Scripts (simplest)
Instead of building full API integrations, use each provider's cloud-init / user-data feature:

- Generate a cloud-init script that runs our installer
- Provide "Deploy to Hetzner" / "Deploy to DigitalOcean" links that pre-fill their server creation forms
- User still creates the server through the provider's UI, but our cloud-init script handles everything

This is how many OSS projects do it (e.g., "Deploy to DigitalOcean" buttons).

## Phase 2: Full API Integration (later)
- OAuth with each provider
- Server provisioning via API from our backend
- DNS configuration assistance
- Post-deploy status webhook

## Implementation
Add a `/deploy` page to `apps/landing/` with:
- Provider cards (Hetzner, DO, Vultr)
- Cloud-init script generator (embeds domain + email + password)
- Direct links to provider with pre-filled user-data

## File Structure
```
apps/landing/src/app/deploy/
├── page.tsx              — Deploy page with provider cards
└── cloud-init.ts         — Cloud-init script generator
```
