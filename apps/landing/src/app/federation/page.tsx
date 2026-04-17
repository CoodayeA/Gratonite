import { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Federation | How Gratonite Decentralization Works",
  description:
    "Gratonite is federated — anyone can run their own instance and connect to the network. Learn how decentralization works and why it matters.",
  path: "/federation/",
  keywords: [
    "Gratonite federation",
    "decentralized chat",
    "federated community software",
    "self-hosted chat federation",
    "open source federated messaging",
  ],
});

export default function FederationPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-4xl mx-auto px-6 py-20">
        {/* Hero */}
        <ScrollReveal>
          <div className="text-center mb-20">
            <Badge color="purple" className="mb-4">
              Decentralized
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              No Single Point of Failure.
              <br />
              <span className="text-purple-400">No Single Point of Control.</span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Gratonite is federated. Anyone can run their own instance and be part of the network.
              Your data stays on your server. Your community stays connected to everyone.
            </p>
          </div>
        </ScrollReveal>

        {/* What is Federation */}
        <ScrollReveal delay={0.1}>
          <div className="mb-20">
            <h2 className="text-2xl font-bold mb-6">What is Federation?</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <p className="text-gray-300 mb-4">
                  Think of it like email. You can use Gmail, your company can use Outlook,
                  and your friend can run their own mail server — but you can all email each other.
                  The servers are independent, but they speak the same language.
                </p>
                <p className="text-gray-300">
                  Gratonite works the same way. Each instance is independent — you control your
                  data, your rules, your community. But users on any instance can discover and
                  join guilds on any other instance.
                </p>
              </div>
              <Card className="p-6 bg-gray-900/50 font-mono text-sm">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-purple-400">gratonite.chat</span>
                    <span className="text-gray-600">←→</span>
                    <span className="text-green-400">chat.school.edu</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-purple-400">gratonite.chat</span>
                    <span className="text-gray-600">←→</span>
                    <span className="text-blue-400">gaming.example.com</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-green-400">chat.school.edu</span>
                    <span className="text-gray-600">←→</span>
                    <span className="text-blue-400">gaming.example.com</span>
                  </div>
                  <div className="border-t border-gray-800 pt-3 text-gray-500 text-xs">
                    Three independent instances. All connected.
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </ScrollReveal>

        {/* Why Self-Host */}
        <ScrollReveal delay={0.15}>
          <div className="mb-20">
            <h2 className="text-2xl font-bold mb-4">Why Self-Host Instead of Using gratonite.chat?</h2>
            <p className="text-gray-400 mb-8">
              Using gratonite.chat is like renting an apartment — it&apos;s easy and works great. Self-hosting is like
              owning your house. Both are good choices, depending on what matters to you.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium"></th>
                    <th className="text-left py-3 px-4 text-purple-400 font-medium">gratonite.chat</th>
                    <th className="text-left py-3 px-4 text-green-400 font-medium">Self-Hosted</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-gray-800/50">
                    <td className="py-3 px-4 font-medium">Setup</td>
                    <td className="py-3 px-4">Sign up and go</td>
                    <td className="py-3 px-4">One command, takes 5 minutes</td>
                  </tr>
                  <tr className="border-b border-gray-800/50">
                    <td className="py-3 px-4 font-medium">Who owns the data</td>
                    <td className="py-3 px-4">Managed on Gratonite infrastructure</td>
                    <td className="py-3 px-4">You own everything</td>
                  </tr>
                  <tr className="border-b border-gray-800/50">
                    <td className="py-3 px-4 font-medium">Moderation rules</td>
                    <td className="py-3 px-4">Platform-wide rules apply</td>
                    <td className="py-3 px-4">You set all the rules</td>
                  </tr>
                  <tr className="border-b border-gray-800/50">
                    <td className="py-3 px-4 font-medium">If gratonite.chat goes down</td>
                    <td className="py-3 px-4">Your community is offline</td>
                    <td className="py-3 px-4">Your community keeps running</td>
                  </tr>
                  <tr className="border-b border-gray-800/50">
                    <td className="py-3 px-4 font-medium">Compliance (FERPA, GDPR, etc.)</td>
                    <td className="py-3 px-4">Depends on our policies</td>
                    <td className="py-3 px-4">Full control over data residency</td>
                  </tr>
                  <tr className="border-b border-gray-800/50">
                    <td className="py-3 px-4 font-medium">Custom domain</td>
                    <td className="py-3 px-4">gratonite.chat/app</td>
                    <td className="py-3 px-4">chat.yourschool.edu, etc.</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium">Can talk to other instances</td>
                    <td className="py-3 px-4">Yes, via federation</td>
                    <td className="py-3 px-4">Yes, via federation</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              The best part: it doesn&apos;t have to be one or the other. Federation means users on
              gratonite.chat and users on your self-hosted instance can be in the same communities together.
            </p>
          </div>
        </ScrollReveal>

        {/* Who it's for */}
        <ScrollReveal delay={0.17}>
          <div className="mb-20">
            <h2 className="text-2xl font-bold mb-6">Who Self-Hosts?</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-6 bg-gray-900/50">
                <h3 className="font-semibold mb-2">Schools and Universities</h3>
                <p className="text-sm text-gray-400">
                  Keep student data on campus servers. Meet FERPA and institutional
                  requirements. Brand it as your own with a .edu domain.
                </p>
              </Card>
              <Card className="p-6 bg-gray-900/50">
                <h3 className="font-semibold mb-2">Gaming Communities</h3>
                <p className="text-sm text-gray-400">
                  Your instance, your content rules. No platform banning your community
                  for content that&apos;s legal but against someone else&apos;s ToS.
                </p>
              </Card>
              <Card className="p-6 bg-gray-900/50">
                <h3 className="font-semibold mb-2">Companies and Teams</h3>
                <p className="text-sm text-gray-400">
                  Internal chat that stays internal. No data leaving your
                  infrastructure. Full audit logs for compliance.
                </p>
              </Card>
              <Card className="p-6 bg-gray-900/50">
                <h3 className="font-semibold mb-2">Privacy-Conscious Communities</h3>
                <p className="text-sm text-gray-400">
                  If you care about who has access to your conversations, self-hosting
                  means the answer is always &quot;only you.&quot;
                </p>
              </Card>
            </div>
          </div>
        </ScrollReveal>

        {/* How it Works */}
        <ScrollReveal delay={0.2}>
          <div className="mb-20">
            <h2 className="text-2xl font-bold mb-8">How It Works</h2>
            <div className="space-y-8">
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">1</div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">You Run an Instance</h3>
                  <p className="text-gray-400">
                    Self-host on your computer, a VPS, or anywhere Docker runs.
                    The installer generates a unique Ed25519 keypair that identifies
                    your instance cryptographically — like a digital passport.
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">2</div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">The Relay Connects You</h3>
                  <p className="text-gray-400">
                    Your instance connects outbound to <code className="text-purple-300 bg-gray-900 px-1.5 py-0.5 rounded text-sm">relay.gratonite.chat</code> over
                    a WebSocket. No ports to open, no firewall rules — it just works, even from
                    behind your home router. The relay authenticates your keypair and routes
                    encrypted messages between instances. It never reads the content.
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">3</div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Discovery Happens Automatically</h3>
                  <p className="text-gray-400">
                    After your instance has been connected for 48 hours with no abuse reports,
                    your public guilds automatically appear in the Discover page on gratonite.chat.
                    Users anywhere on the network can find and join your communities.
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">4</div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Messages Flow Across Instances</h3>
                  <p className="text-gray-400">
                    When someone from gratonite.chat joins a guild on your instance, a &ldquo;shadow user&rdquo;
                    is created locally. Messages are signed with the sender&apos;s instance key and
                    routed through the relay. To your users, it looks like everyone is in the same room.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Architecture Diagram */}
        <ScrollReveal delay={0.3}>
          <Card className="mb-20 p-8 bg-gray-900/50 border-purple-500/20">
            <h2 className="text-xl font-bold mb-6 text-center">Network Architecture</h2>
            <pre className="text-sm text-gray-300 overflow-x-auto leading-relaxed">
{`
  ┌─────────────────┐                              ┌─────────────────┐
  │  Your Instance   │     outbound WSS (443)       │   gratonite.chat │
  │                  │ ────────────────────────────▶ │                  │
  │  Ed25519 keypair │                              │  Ed25519 keypair │
  │  PostgreSQL      │         ┌──────────┐         │  PostgreSQL      │
  │  Redis           │ ◀──────▶│  Relay   │◀──────▶ │  Redis           │
  │  Your rules      │         │  Server  │         │  Open community  │
  └─────────────────┘         └──────────┘         └─────────────────┘
                               relay.gratonite.chat
                               Routes encrypted envelopes
                               Never reads content
                               Verifies instance identity

  ┌─────────────────┐
  │  Another Instance│
  │  gaming.club     │ ────────────────────────────▶ (same relay)
  │  Their rules     │
  └─────────────────┘
`}
            </pre>
          </Card>
        </ScrollReveal>

        {/* Why it Matters */}
        <ScrollReveal delay={0.4}>
          <h2 className="text-2xl font-bold mb-8 text-center">Why This Matters</h2>
          <div className="grid md:grid-cols-3 gap-6 mb-20">
            <Card className="p-6 bg-gray-900/50">
              <div className="text-3xl mb-3">🛡️</div>
              <h3 className="font-semibold mb-2">No Single Point of Failure</h3>
              <p className="text-sm text-gray-400">
                If gratonite.chat goes down, your instance keeps running.
                Your data, your conversations, your community — all safe on your server.
              </p>
            </Card>
            <Card className="p-6 bg-gray-900/50">
              <div className="text-3xl mb-3">🔒</div>
              <h3 className="font-semibold mb-2">Your Data, Your Rules</h3>
              <p className="text-sm text-gray-400">
                Schools can enforce FERPA compliance. Companies can meet GDPR.
                Gaming communities can set their own moderation standards. You set the rules.
              </p>
            </Card>
            <Card className="p-6 bg-gray-900/50">
              <div className="text-3xl mb-3">🌐</div>
              <h3 className="font-semibold mb-2">No Vendor Lock-in</h3>
              <p className="text-sm text-gray-400">
                Export your account and move to any instance.
                The protocol is open — anyone can build compatible software.
              </p>
            </Card>
          </div>
        </ScrollReveal>

        {/* Trust Model */}
        <ScrollReveal delay={0.5}>
          <div className="mb-20">
            <h2 className="text-2xl font-bold mb-6">Trust &amp; Safety</h2>
            <p className="text-gray-400 mb-6">
              Federation doesn&apos;t mean chaos. Every instance earns trust over time.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-900/50">
                <span className="w-3 h-3 rounded-full bg-gray-500" />
                <div>
                  <span className="font-medium">New Instance</span>
                  <span className="text-gray-500 ml-2">— Connected, building trust. Not yet in Discover.</span>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-900/50">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <div>
                  <span className="font-medium">Trusted</span>
                  <span className="text-gray-500 ml-2">— 48h+ uptime, no abuse reports. Guilds visible in Discover.</span>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-900/50">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <div>
                  <span className="font-medium">Verified</span>
                  <span className="text-gray-500 ml-2">— Manually verified by the Gratonite team. Green badge in Discover.</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* The Relay */}
        <ScrollReveal delay={0.6}>
          <Card className="mb-20 p-8 bg-gray-900/50 border-green-500/20">
            <h2 className="text-xl font-bold mb-4">About the Relay</h2>
            <p className="text-gray-400 mb-4">
              The relay at <code className="text-green-300 bg-gray-950 px-1.5 py-0.5 rounded text-sm">relay.gratonite.chat</code> is
              shared infrastructure operated by the Gratonite project. It&apos;s the glue that lets
              instances behind firewalls and NAT communicate.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-2 text-green-400">What it does</h3>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>Routes encrypted envelopes between instances</li>
                  <li>Authenticates instances via Ed25519 signatures</li>
                  <li>Tracks uptime and reputation scores</li>
                  <li>Enables NAT traversal (no ports to open)</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-2 text-green-400">What it doesn&apos;t do</h3>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>Read or store message content</li>
                  <li>Control what instances can do</li>
                  <li>Act as a single point of failure</li>
                  <li>Prevent you from running your own relay</li>
                </ul>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              The relay is open source. Anyone can run their own — the mesh networking
              protocol supports multiple relays.{" "}
              <a href="https://github.com/CoodayeA/Gratonite/blob/main/docs/self-hosting/federation.md"
                 target="_blank" rel="noopener noreferrer"
                 className="text-purple-400 hover:text-purple-300">
                Learn more →
              </a>
            </p>
          </Card>
        </ScrollReveal>

        {/* CTA */}
        <ScrollReveal delay={0.7}>
          <div className="text-center">
            <p className="text-gray-500 text-sm mb-3">
              Self-host troubleshooting bundle: <code>bash ./collect-logs.sh</code>
              <span className="mx-1">or</span>
              <code>pwsh ./collect-logs.ps1</code>
            </p>
            <h2 className="text-2xl font-bold mb-4">Join the Network</h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Run your own instance and be part of a decentralized community.
              One command is all it takes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/deploy"
                 className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors">
                Self-Host Now
              </a>
              <a href="/app"
                 className="inline-block bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors">
                Try on gratonite.chat
              </a>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </main>
  );
}
