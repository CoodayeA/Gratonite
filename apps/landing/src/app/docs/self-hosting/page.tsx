import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Self-Hosting Guide | Gratonite',
  description: 'Complete guide to self-hosting your own Gratonite instance. One-command installer, desktop app, or manual Docker setup.',
};

export default function SelfHostingDocs() {
  return (
    <main className="min-h-screen pt-28 pb-20 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-4xl sm:text-5xl font-bold mb-2">Self-Hosting Gratonite</h1>
        <p className="text-lg text-foreground/50 mb-4">
          Run your own instance — own your data, set your own rules, stay connected to everyone via federation.
        </p>
        <p className="text-sm text-foreground/40 mb-10">
          Looking for the quick deploy page?{' '}
          <a href="/deploy" className="text-purple hover:underline font-medium">Go to Deploy &rarr;</a>
        </p>

        <section className="space-y-12">
          {/* Why self-host */}
          <div>
            <h2 className="font-display text-2xl font-bold mb-4">Why Self-Host?</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { title: 'Own Your Data', desc: 'Messages and files live on your server. If gratonite.chat goes down, your community keeps running.' },
                { title: 'Your Rules', desc: 'No platform-wide content policies overriding your moderation. Schools, companies, and communities set their own rules.' },
                { title: 'Stay Connected', desc: 'Federation links all instances. Your users can join servers on gratonite.chat and vice versa.' },
              ].map(item => (
                <div key={item.title} className="p-4 rounded-lg bg-surface neo-border-2">
                  <p className="font-semibold mb-1">{item.title}</p>
                  <p className="text-sm text-foreground/50">{item.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-foreground/40 mt-3">
              Learn more about how federation works: <a href="/federation" className="text-purple hover:underline">Federation &rarr;</a>
            </p>
          </div>

          {/* Option A: One-command installer */}
          <div>
            <h2 className="font-display text-2xl font-bold mb-4">Option A: One-Command Installer</h2>
            <p className="text-foreground/50 mb-4">
              The fastest way. Works on any Linux server, Mac, or Windows (WSL). The installer asks one question
              (local or server), then handles Docker setup, secret generation, TLS certificates, and federation.
            </p>
            <div className="bg-surface neo-border rounded-xl p-6 font-mono text-sm text-foreground/70">
              <p>curl -fsSL https://gratonite.chat/install | bash</p>
            </div>
          </div>

          {/* Option B: Desktop app */}
          <div>
            <h2 className="font-display text-2xl font-bold mb-4">Option B: Desktop App</h2>
            <p className="text-foreground/50 mb-4">
              Download <strong className="text-foreground/80">Gratonite Server</strong>, double-click, done. No terminal needed.
              Available for macOS (.dmg), Windows (.exe/.msi), and Linux (.deb/.rpm/.AppImage).
            </p>
            <a
              href="https://gratonite.chat/download"
              className="inline-block px-4 py-2 rounded-lg bg-purple text-white font-semibold neo-border-2 neo-shadow-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
            >
              Download Gratonite Server &rarr;
            </a>
          </div>

          {/* Option C: Manual */}
          <div>
            <h2 className="font-display text-2xl font-bold mb-4">Option C: Manual Setup</h2>
            <p className="text-foreground/50 mb-4">Full control over every step.</p>

            {/* What you need */}
            <h3 className="font-display text-lg font-semibold mb-3">What You Need</h3>
            <ul className="space-y-3 mb-8">
              {[
                { title: 'A Server', desc: 'Any Linux machine, VPS, or home PC. 1 GB RAM is enough for small communities.' },
                { title: 'Docker', desc: 'Docker Engine 24+ and Docker Compose v2.' },
                { title: 'A Domain', desc: 'Point an A record to your server. TLS certificates are handled automatically.' },
              ].map(item => (
                <li key={item.title} className="flex gap-3 p-4 rounded-lg bg-surface neo-border-2">
                  <span className="text-2xl text-purple">&#10003;</span>
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-foreground/50">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Steps */}
            <h3 className="font-display text-lg font-semibold mb-3">Step 1: Install Docker</h3>
            <div className="bg-surface neo-border rounded-xl p-6 font-mono text-sm space-y-2 text-foreground/70 mb-6">
              <p>curl -fsSL https://get.docker.com | sh</p>
              <p>sudo usermod -aG docker $USER</p>
              <p className="text-foreground/40"># Log out and back in, then verify:</p>
              <p>docker --version && docker compose version</p>
            </div>

            <h3 className="font-display text-lg font-semibold mb-3">Step 2: Point Your Domain</h3>
            <p className="text-foreground/50 mb-4">
              Create an <strong className="text-foreground/80">A record</strong> in your DNS pointing to your server&apos;s IP
              address. Example: <code className="bg-surface px-1.5 py-0.5 rounded text-sm">chat.yourdomain.com</code> &rarr; <code className="bg-surface px-1.5 py-0.5 rounded text-sm">203.0.113.1</code>
            </p>

            <h3 className="font-display text-lg font-semibold mb-3">Step 3: Configure &amp; Launch</h3>
            <div className="bg-surface neo-border rounded-xl p-6 font-mono text-sm space-y-2 text-foreground/70 mb-6">
              <p>git clone https://github.com/CoodayeA/Gratonite.git</p>
              <p>cd Gratonite/deploy/self-host</p>
              <p>cp .env.example .env</p>
              <p className="text-foreground/40"># Edit .env — set INSTANCE_DOMAIN, ADMIN_EMAIL, ADMIN_PASSWORD, DB_PASSWORD</p>
              <p>nano .env</p>
              <p className="text-foreground/40 mt-2"># Launch</p>
              <p>docker compose up -d</p>
            </div>
            <p className="text-sm text-foreground/40 mb-6">
              That&apos;s it. HTTPS certificates are auto-obtained via Let&apos;s Encrypt. JWT secrets are auto-generated.
              Open <code className="bg-surface px-1.5 py-0.5 rounded text-sm">https://your-domain.com</code> and log in with your admin credentials.
            </p>
          </div>

          {/* Features */}
          <div>
            <h2 className="font-display text-2xl font-bold mb-4">What You Get</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { title: 'Federation', desc: 'Your instance joins the Gratonite network. Users can cross-join servers.' },
                { title: 'Relay Network', desc: 'Works behind NAT — no ports to open, no firewall rules.' },
                { title: 'Voice & Video', desc: 'Optional LiveKit integration for voice channels and screen sharing.' },
                { title: 'E2E Encryption', desc: 'All DMs are end-to-end encrypted. Relay traffic is encrypted too.' },
                { title: 'Auto-Updates', desc: 'One command to update: docker compose pull && docker compose up -d.' },
                { title: 'Backups', desc: 'pg_dump your database. Migrations run automatically on update.' },
              ].map(item => (
                <div key={item.title} className="p-4 rounded-lg bg-surface neo-border-2">
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-foreground/50">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Voice */}
          <div>
            <h2 className="font-display text-2xl font-bold mb-4">Enable Voice &amp; Video</h2>
            <p className="text-foreground/50 mb-4">
              Voice and video require LiveKit. Start the voice profile:
            </p>
            <div className="bg-surface neo-border rounded-xl p-6 font-mono text-sm text-foreground/70">
              <p>docker compose --profile voice up -d</p>
            </div>
          </div>

          {/* Home hosting */}
          <div>
            <h2 className="font-display text-2xl font-bold mb-4">Home Hosting</h2>
            <p className="text-foreground/50 mb-4">
              Running from your home computer? Use your own tunnel or reverse proxy in front of Gratonite if you cannot open ports.
            </p>
            <div className="bg-surface neo-border rounded-xl p-6 font-mono text-sm space-y-2 text-foreground/70">
              <p className="text-foreground/40"># Standard self-host stack</p>
              <p>docker compose -f deploy/self-host/docker-compose.yml up -d</p>
              <p className="text-foreground/40 mt-2"># Then connect your own tunnel/proxy to 443</p>
            </div>
          </div>

          {/* Enable federation */}
          <div>
            <h2 className="font-display text-2xl font-bold mb-4">Enable Federation</h2>
            <p className="text-foreground/50 mb-4">
              Federation is enabled by default in the self-host preset. To explicitly enable or confirm federation settings:
            </p>
            <div className="bg-surface neo-border rounded-xl p-6 font-mono text-sm space-y-2 text-foreground/70 mb-4">
              <p className="text-foreground/40"># In your .env file, set:</p>
              <p>FEDERATION_ENABLED=true</p>
              <p>FEDERATION_DISCOVER_REGISTRATION=true</p>
              <p className="text-foreground/40 mt-2"># Restart</p>
              <p>docker compose restart api</p>
            </div>
            <p className="text-sm text-foreground/50">
              Your public servers will appear on{' '}
              <a href="https://gratonite.chat/app/discover" className="text-purple hover:underline">Discover</a>{' '}
              within 48 hours. Learn more: <a href="/federation" className="text-purple hover:underline">How Federation Works &rarr;</a>
            </p>
          </div>

          {/* Updating */}
          <div>
            <h2 className="font-display text-2xl font-bold mb-4">Updating</h2>
            <div className="bg-surface neo-border rounded-xl p-6 font-mono text-sm space-y-2 text-foreground/70">
              <p>cd Gratonite</p>
              <p>git pull</p>
              <p>docker compose -f deploy/self-host/docker-compose.yml pull</p>
              <p>docker compose -f deploy/self-host/docker-compose.yml up -d</p>
            </div>
            <p className="text-sm text-foreground/40 mt-3">
              Migrations run automatically. Data is preserved.
            </p>
          </div>

          {/* VPS providers */}
          <div>
            <h2 className="font-display text-2xl font-bold mb-4">Recommended VPS Providers</h2>
            <p className="text-foreground/50 mb-4">
              Any provider works. These are popular choices:
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { name: 'Hetzner', desc: 'Best value. CX22 from \u20AC3.79/mo (2 vCPU, 4 GB RAM).', href: 'https://console.hetzner.cloud/deploy/new' },
                { name: 'DigitalOcean', desc: 'Simple. Basic Droplet from $6/mo (1 vCPU, 1 GB RAM).', href: 'https://cloud.digitalocean.com/droplets/new' },
                { name: 'Vultr', desc: 'Global. Cloud Compute from $6/mo, 32 data centers.', href: 'https://my.vultr.com/deploy/' },
              ].map(p => (
                <a
                  key={p.name}
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-lg bg-surface neo-border-2 block hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
                >
                  <p className="font-semibold mb-1">{p.name}</p>
                  <p className="text-sm text-foreground/50">{p.desc}</p>
                </a>
              ))}
            </div>
          </div>

          {/* Full docs */}
          <div className="p-6 rounded-xl bg-purple/10 neo-border-2 border-purple/30">
            <h3 className="font-display text-xl font-bold mb-2">Full Documentation</h3>
            <p className="text-foreground/60 mb-4">
              For the complete configuration reference, troubleshooting, backup/restore, and resource usage guide:
            </p>
            <a
              href="https://github.com/CoodayeA/Gratonite/blob/main/docs/federation/self-hosting-guide.md"
              className="inline-block px-4 py-2 rounded-lg bg-purple text-white font-semibold neo-border-2 neo-shadow-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
            >
              View Full Docs on GitHub &rarr;
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
