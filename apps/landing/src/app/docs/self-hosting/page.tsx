import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Self-Hosting Guide | Gratonite',
  description: 'Run your own Gratonite instance in 5 minutes. Complete guide for self-hosting.',
};

export default function SelfHostingDocs() {
  return (
    <main className="min-h-screen pt-28 pb-20 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-4xl sm:text-5xl font-bold mb-2">Self-Hosting Gratonite</h1>
        <p className="text-lg text-foreground/50 mb-10">Run your own instance in 5 minutes. No programming required.</p>

        <section className="space-y-10">
          <div>
            <h2 className="font-display text-2xl font-bold mb-4">Quick Start</h2>
            <div className="bg-surface neo-border rounded-xl p-6 font-mono text-sm space-y-2 text-foreground/70">
              <p className="text-foreground/40"># Clone and start</p>
              <p>git clone https://github.com/CoodayeA/Gratonite.git</p>
              <p>cd Gratonite/deploy/self-host</p>
              <p>cp .env.example .env</p>
              <p>docker compose up -d</p>
              <p className="text-foreground/40 mt-4"># Open https://your-domain.com/setup</p>
            </div>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold mb-4">What You Need</h2>
            <ul className="space-y-3">
              {[
                { title: 'A Server', desc: 'Any Linux machine, VPS, or even your home PC' },
                { title: 'Docker', desc: 'Docker and Docker Compose installed' },
                { title: 'A Domain', desc: 'Or use Cloudflare Tunnel for zero-config hosting' },
              ].map(item => (
                <li key={item.title} className="flex gap-3 p-4 rounded-lg bg-surface neo-border-2">
                  <span className="text-2xl text-purple">✓</span>
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-foreground/50">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold mb-4">Features</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { title: 'Federation', desc: 'Connect with other Gratonite servers' },
                { title: 'Relay Network', desc: 'Works behind NAT, no port forwarding' },
                { title: 'Voice & Video', desc: 'Optional LiveKit integration' },
                { title: 'E2E Encryption', desc: 'Messages encrypted between instances' },
                { title: 'Setup Wizard', desc: 'Beautiful UI for first-time config' },
                { title: 'Auto-Updates', desc: 'Pull latest image and restart' },
              ].map(item => (
                <div key={item.title} className="p-4 rounded-lg bg-surface neo-border-2">
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-foreground/50">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold mb-4">Home Hosting</h2>
            <p className="text-foreground/50 mb-4">
              Want to run Gratonite from your home computer? No problem. Use Cloudflare Tunnel for
              zero-port-forwarding hosting:
            </p>
            <div className="bg-surface neo-border rounded-xl p-6 font-mono text-sm space-y-2 text-foreground/70">
              <p className="text-foreground/40"># Add tunnel token to .env</p>
              <p>CLOUDFLARE_TUNNEL_TOKEN=your-token</p>
              <p className="text-foreground/40 mt-2"># Start with tunnel</p>
              <p>docker compose --profile tunnel up -d</p>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-purple/10 neo-border-2 border-purple/30">
            <h3 className="font-display text-xl font-bold mb-2">Full Documentation</h3>
            <p className="text-foreground/60 mb-4">
              For complete configuration reference, troubleshooting, and advanced setup, see the full docs in the repository.
            </p>
            <a href="https://github.com/CoodayeA/Gratonite/tree/main/docs/self-hosting" className="inline-block px-4 py-2 rounded-lg bg-purple text-white font-semibold neo-border-2 neo-shadow-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all">
              View Full Docs →
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
