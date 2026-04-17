import { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Self-Host Gratonite | One-Click Deploy",
  description:
    "Deploy your own Gratonite instance in minutes. Self-host on your computer or a VPS with one command. Federation included.",
  path: "/deploy/",
  keywords: [
    "self-host Gratonite",
    "Gratonite self-hosting",
    "deploy Gratonite",
    "Gratonite server",
    "self-hosted community platform",
    "federated chat server",
  ],
});

const providers = [
  {
    icon: "🟢",
    name: "Hetzner",
    description: "Best value. Starting at €3.79/mo for a CX22 (2 vCPU, 4GB RAM).",
    accent: "green" as const,
    href: "https://console.hetzner.cloud/deploy/new",
    guide: "Choose Ubuntu 22.04, CX22, paste the cloud-init script below.",
  },
  {
    icon: "🔵",
    name: "DigitalOcean",
    description: "Simple. Starting at $6/mo for a Basic Droplet (1 vCPU, 1GB RAM).",
    accent: "blue" as const,
    href: "https://cloud.digitalocean.com/droplets/new",
    guide: "Choose Ubuntu 22.04, $6/mo, add cloud-init in Advanced Options.",
  },
  {
    icon: "🟣",
    name: "Vultr",
    description: "Global. Starting at $6/mo with 32 data center locations.",
    accent: "purple" as const,
    href: "https://my.vultr.com/deploy/",
    guide: "Choose Cloud Compute, Ubuntu 22.04, $6/mo, paste startup script.",
  },
];

export default function DeployPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-4xl mx-auto px-6 py-20">
        <ScrollReveal>
          <div className="text-center mb-16">
            <Badge color="purple" className="mb-4">
              Self-Hosting
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight mb-4">
              Deploy Your Own Gratonite
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Run your own instance in minutes. Full federation included —
              your users can talk to anyone on any Gratonite instance.
            </p>
          </div>
        </ScrollReveal>

        {/* Why self-host */}
        <ScrollReveal delay={0.05}>
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="p-6 bg-gray-900/50">
              <h3 className="font-semibold mb-2">Own Your Data</h3>
              <p className="text-sm text-gray-400">
                Messages, files, and user data live on your server. Not ours, not anyone else&apos;s.
                If gratonite.chat goes down, your community keeps running.
              </p>
            </Card>
            <Card className="p-6 bg-gray-900/50">
              <h3 className="font-semibold mb-2">Your Rules</h3>
              <p className="text-sm text-gray-400">
                No platform-wide content policies overriding your decisions.
                Schools can enforce FERPA. Companies keep data in-house. You decide.
              </p>
            </Card>
            <Card className="p-6 bg-gray-900/50">
              <h3 className="font-semibold mb-2">Stay Connected</h3>
              <p className="text-sm text-gray-400">
                Federation means your self-hosted instance isn&apos;t isolated.
                Your users can join communities on gratonite.chat and vice versa.{" "}
                <a href="/federation" className="text-purple-400 hover:text-purple-300">Learn more</a>
              </p>
            </Card>
          </div>
        </ScrollReveal>

        {/* Quick start */}
        <ScrollReveal delay={0.1}>
          <Card className="mb-12 p-8 bg-gray-900/50 border-purple-500/20">
            <h2 className="text-2xl font-semibold mb-2">Quick Start</h2>
            <p className="text-gray-400 mb-6">
              Works on any Linux server, Mac, or Windows with Docker.
            </p>
            <div className="bg-gray-950 rounded-lg p-4 font-mono text-sm">
              <span className="text-gray-500">$</span>{" "}
              <span className="text-purple-400">curl</span>{" "}
              <span className="text-gray-300">-fsSL https://gratonite.chat/install | bash</span>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              The installer asks whether you want local or server mode, then handles Docker setup,
              secret generation, TLS certificates, and federation automatically.
            </p>
          </Card>
        </ScrollReveal>

        {/* Local hosting */}
        <ScrollReveal delay={0.2}>
          <Card className="mb-12 p-8 bg-gray-900/50 border-green-500/20">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">💻</span>
              <div>
                <h2 className="text-xl font-semibold">Host on Your Computer</h2>
                <p className="text-sm text-gray-400">No server needed — try it locally</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-2">Desktop App (recommended)</h3>
                <p className="text-sm text-gray-400 mb-3">
                  Download Gratonite Server, double-click, done. No terminal needed.
                </p>
                <a
                  href="/download#server"
                  className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Download Gratonite Server
                </a>
              </div>
              <div>
                <h3 className="font-medium mb-2">CLI Installer</h3>
                <p className="text-sm text-gray-400 mb-3">
                  One command, minimal prompts. Instance running at localhost:8443.
                </p>
                <code className="text-xs text-purple-300 bg-gray-950 px-3 py-1.5 rounded block">
                  curl -fsSL gratonite.chat/install | bash
                </code>
              </div>
            </div>
          </Card>
        </ScrollReveal>

        {/* VPS providers */}
        <ScrollReveal delay={0.3}>
          <h2 className="text-2xl font-semibold mb-6 text-center">
            Deploy on a VPS
          </h2>
          <p className="text-gray-400 text-center mb-8">
            For a public instance with your own domain. Pick any provider —
            they all work the same way.
          </p>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {providers.map((p, i) => (
            <ScrollReveal key={p.name} delay={0.4 + i * 0.1}>
              <Card className="p-6 bg-gray-900/50 h-full flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{p.icon}</span>
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                </div>
                <p className="text-sm text-gray-400 mb-4 flex-1">
                  {p.description}
                </p>
                <p className="text-xs text-gray-500 mb-4">{p.guide}</p>
                <a
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors text-center"
                >
                  Deploy on {p.name} →
                </a>
              </Card>
            </ScrollReveal>
          ))}
        </div>

        {/* Cloud-init script */}
        <ScrollReveal delay={0.7}>
          <Card className="mb-12 p-8 bg-gray-900/50 border-yellow-500/20">
            <h2 className="text-xl font-semibold mb-2">Cloud-Init Script</h2>
            <p className="text-gray-400 text-sm mb-4">
              Paste this into your provider&apos;s &quot;User Data&quot; or &quot;Startup Script&quot; field.
              Replace the domain and email with yours.
            </p>
            <pre className="bg-gray-950 rounded-lg p-4 text-xs overflow-x-auto text-gray-300">
{`#!/bin/bash
# Gratonite Self-Host — Cloud-Init Script
# Paste this into your VPS provider's user-data field

export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Bootstrap self-host config (non-interactive)
GRATONITE_DOMAIN="chat.yourdomain.com"
GRATONITE_EMAIL="you@yourdomain.com"
GRATONITE_PASSWORD="$(openssl rand -hex 12)"

mkdir -p /root/gratonite && cd /root/gratonite

curl -fsSL https://raw.githubusercontent.com/CoodayeA/Gratonite/main/deploy/self-host/docker-compose.yml -o docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/CoodayeA/Gratonite/main/deploy/self-host/Caddyfile -o Caddyfile

cat > .env << EOF
INSTANCE_DOMAIN=$GRATONITE_DOMAIN
ADMIN_EMAIL=$GRATONITE_EMAIL
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$GRATONITE_PASSWORD
DB_USER=gratonite
DB_PASSWORD=$(openssl rand -hex 16)
DB_NAME=gratonite
JWT_SECRET=$(openssl rand -base64 48)
JWT_REFRESH_SECRET=$(openssl rand -base64 48)
MFA_ENCRYPTION_KEY=$(openssl rand -hex 32)
BULLBOARD_ADMIN_TOKEN=$(openssl rand -hex 32)
FEDERATION_ENABLED=true
FEDERATION_ALLOW_INBOUND=true
FEDERATION_ALLOW_OUTBOUND=true
FEDERATION_ALLOW_JOINS=true
FEDERATION_HUB_URL=https://gratonite.chat
RELAY_ENABLED=true
RELAY_URL=wss://relay.gratonite.chat
TLS_MODE=$GRATONITE_EMAIL
HTTP_PORT=80
HTTPS_PORT=443
EOF

docker compose pull && docker compose up -d

echo "Gratonite deployed at https://$GRATONITE_DOMAIN"
echo "Admin password: $GRATONITE_PASSWORD"`}
            </pre>
          </Card>
        </ScrollReveal>

        {/* Features */}
        <ScrollReveal delay={0.8}>
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <div className="text-center">
              <div className="text-3xl mb-2">🔗</div>
              <h3 className="font-semibold mb-1">Federation Built In</h3>
              <p className="text-sm text-gray-400">
                Your instance connects to the Gratonite network automatically.
                Users can join guilds across instances.
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🔒</div>
              <h3 className="font-semibold mb-1">Your Data, Your Rules</h3>
              <p className="text-sm text-gray-400">
                Messages, files, and user data stay on your server.
                No telemetry, no tracking.
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🔄</div>
              <h3 className="font-semibold mb-1">Easy Updates</h3>
              <p className="text-sm text-gray-400">
                One command to update: docker compose pull && docker compose up -d.
                Migrations run automatically.
              </p>
            </div>
          </div>
        </ScrollReveal>

        {/* Docs link */}
        <ScrollReveal delay={0.9}>
          <div className="text-center">
            <p className="text-gray-500 text-sm mb-2">
              Hit an error? Generate a support bundle from your install folder:
              <code className="ml-1">bash ./collect-logs.sh</code>
            </p>
            <p className="text-gray-500 text-sm mb-4">
              On PowerShell: <code>pwsh ./collect-logs.ps1</code>
            </p>
            <p className="text-gray-400 mb-4">
              Need help? Check the self-hosting documentation.
            </p>
            <a
              href="https://github.com/CoodayeA/Gratonite/blob/main/docs/self-hosting.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 font-medium"
            >
              Self-Hosting Docs →
            </a>
          </div>
        </ScrollReveal>
      </div>
    </main>
  );
}
