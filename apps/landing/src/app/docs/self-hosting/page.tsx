import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Self-Hosting Guide — Gratonite',
  description: 'Run your own Gratonite instance in 5 minutes. Complete guide for self-hosting.',
};

export default function SelfHostingDocs() {
  return (
    <main className="min-h-screen bg-[#0f0f1a] text-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-2">Self-Hosting Gratonite</h1>
        <p className="text-lg text-gray-400 mb-8">Run your own instance in 5 minutes. No programming required.</p>

        <section className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold mb-4">Quick Start</h2>
            <div className="bg-[#1e1e2e] rounded-xl p-6 font-mono text-sm space-y-2">
              <p className="text-gray-400"># Clone and start</p>
              <p>git clone https://github.com/CoodayeA/Gratonite.git</p>
              <p>cd Gratonite/deploy/self-host</p>
              <p>cp .env.example .env</p>
              <p>docker compose up -d</p>
              <p className="text-gray-400 mt-4"># Open https://your-domain.com/setup</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4">What You Need</h2>
            <ul className="space-y-3">
              {[
                { title: 'A Server', desc: 'Any Linux machine, VPS, or even your home PC' },
                { title: 'Docker', desc: 'Docker and Docker Compose installed' },
                { title: 'A Domain', desc: 'Or use Cloudflare Tunnel for zero-config hosting' },
              ].map(item => (
                <li key={item.title} className="flex gap-3 p-4 rounded-lg bg-[#1e1e2e]">
                  <span className="text-2xl">✓</span>
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-gray-400">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4">Features</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { title: 'Federation', desc: 'Connect with other Gratonite servers' },
                { title: 'Relay Network', desc: 'Works behind NAT — no port forwarding' },
                { title: 'Voice & Video', desc: 'Optional LiveKit integration' },
                { title: 'E2E Encryption', desc: 'Messages encrypted between instances' },
                { title: 'Setup Wizard', desc: 'Beautiful UI for first-time config' },
                { title: 'Auto-Updates', desc: 'Pull latest image and restart' },
              ].map(item => (
                <div key={item.title} className="p-4 rounded-lg bg-[#1e1e2e]">
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-gray-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4">Home Hosting</h2>
            <p className="text-gray-400 mb-4">
              Want to run Gratonite from your home computer? No problem. Use Cloudflare Tunnel for
              zero-port-forwarding hosting:
            </p>
            <div className="bg-[#1e1e2e] rounded-xl p-6 font-mono text-sm space-y-2">
              <p className="text-gray-400"># Add tunnel token to .env</p>
              <p>CLOUDFLARE_TUNNEL_TOKEN=your-token</p>
              <p className="text-gray-400 mt-2"># Start with tunnel</p>
              <p>docker compose --profile tunnel up -d</p>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
            <h3 className="text-xl font-bold mb-2">Full Documentation</h3>
            <p className="text-gray-300 mb-4">
              For complete configuration reference, troubleshooting, and advanced setup, see the full docs in the repository.
            </p>
            <a href="https://github.com/CoodayeA/Gratonite/tree/main/docs/self-hosting" className="inline-block px-4 py-2 rounded-lg bg-indigo-500 text-white font-semibold hover:bg-indigo-600 transition-all">
              View Full Docs →
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
