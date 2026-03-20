import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Relay Operator Guide | Gratonite',
  description: 'Run a Gratonite relay node to help the federation network. Lightweight, easy to deploy.',
};

export default function RelayDocs() {
  return (
    <main className="min-h-screen bg-[#0f0f1a] text-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-2">Run a Relay Node</h1>
        <p className="text-lg text-gray-400 mb-8">
          Help the Gratonite network by running a relay. Lightweight, requires minimal resources.
        </p>

        <section className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold mb-4">What is a Relay?</h2>
            <p className="text-gray-300 leading-relaxed">
              A relay routes encrypted messages between Gratonite instances that can&apos;t reach each other directly
              (e.g., servers behind NAT). The relay <strong>never reads message content</strong>. It only sees
              encrypted envelopes and forwards them.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4">Quick Start</h2>
            <div className="bg-[#1e1e2e] rounded-xl p-6 font-mono text-sm space-y-2">
              <p>cd apps/relay</p>
              <p>cp .env.example .env</p>
              <p>docker compose up -d</p>
            </div>
            <p className="text-sm text-gray-400 mt-2">That&apos;s it. Your relay is running.</p>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4">Requirements</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'CPU', value: '1 vCPU', note: 'Minimal compute' },
                { label: 'RAM', value: '256 MB', note: 'Redis + relay' },
                { label: 'Bandwidth', value: '10 Mbps', note: 'Scales with usage' },
              ].map(item => (
                <div key={item.label} className="p-4 rounded-lg bg-[#1e1e2e] text-center">
                  <p className="text-2xl font-bold text-indigo-400">{item.value}</p>
                  <p className="font-semibold mt-1">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4">Reputation System</h2>
            <p className="text-gray-300 mb-4">Every relay has a public reputation score (0-100).</p>
            <div className="space-y-2">
              {[
                { factor: 'Uptime', weight: '30%', desc: 'Keep your relay online' },
                { factor: 'Delivery Rate', weight: '30%', desc: 'Successfully forward envelopes' },
                { factor: 'Latency', weight: '20%', desc: 'Lower latency = higher score' },
                { factor: 'Age', weight: '10%', desc: 'Trust builds over time' },
                { factor: 'Reports', weight: '10%', desc: 'Avoid abuse reports' },
              ].map(item => (
                <div key={item.factor} className="flex items-center justify-between p-3 rounded-lg bg-[#1e1e2e]">
                  <div>
                    <span className="font-semibold">{item.factor}</span>
                    <span className="text-sm text-gray-400 ml-2">{item.desc}</span>
                  </div>
                  <span className="text-indigo-400 font-mono">{item.weight}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4">Monitoring</h2>
            <p className="text-gray-300 mb-4">
              Built-in health and Prometheus metrics endpoints:
            </p>
            <div className="bg-[#1e1e2e] rounded-xl p-6 font-mono text-sm space-y-2">
              <p className="text-gray-400"># Health check</p>
              <p>curl https://your-relay.com/health</p>
              <p className="text-gray-400 mt-2"># Prometheus metrics</p>
              <p>curl https://your-relay.com/metrics</p>
              <p className="text-gray-400 mt-2"># Relay identity</p>
              <p>curl https://your-relay.com/.well-known/gratonite-relay</p>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
            <h3 className="text-xl font-bold mb-2">Full Documentation</h3>
            <p className="text-gray-300 mb-4">
              Advanced configuration, mesh setup, TURN proxy, and more.
            </p>
            <a href="https://github.com/CoodayeA/Gratonite/tree/main/docs/relay" className="inline-block px-4 py-2 rounded-lg bg-indigo-500 text-white font-semibold hover:bg-indigo-600 transition-all">
              View Full Docs →
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
