import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ScrollReveal } from "@/components/effects/ScrollReveal";

const benefits = [
  {
    title: "Total Privacy",
    description:
      "Your data stays on your hardware. No analytics, no tracking, no third-party access. Ever.",
    accent: "purple" as const,
  },
  {
    title: "Federation",
    description:
      "Connect with the entire Gratonite network. Your users can join servers on other instances and vice versa.",
    accent: "gold" as const,
  },
  {
    title: "Zero Lock-in",
    description:
      "Export everything. Move to another host. Fork it. It's open source and yours to keep.",
    accent: "blue" as const,
  },
];

export function SelfHosting() {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="neo-burst neo-burst-purple bottom-12 left-[-60px] neo-wobble opacity-40" />

      <div className="max-w-7xl mx-auto relative z-10">
        <ScrollReveal>
          <div className="text-center mb-16">
            <p className="text-sm font-bold uppercase tracking-wider text-purple mb-3">
              Self-Hosting
            </p>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
              YOUR SERVER.
              <br />
              <span className="text-purple">YOUR RULES.</span>
            </h2>
            <p className="text-lg text-foreground/60 max-w-2xl mx-auto">
              Run your own Gratonite instance in 5 minutes. Full control over
              your data, your community, your way. No coding required.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {benefits.map((benefit, i) => (
            <ScrollReveal key={benefit.title} delay={i * 0.1}>
              <Card accent={benefit.accent}>
                <h3 className="font-display text-xl font-bold mb-2">
                  {benefit.title}
                </h3>
                <p className="text-foreground/60 text-sm leading-relaxed">
                  {benefit.description}
                </p>
              </Card>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={0.3}>
          <div className="bg-surface neo-border rounded-xl p-8 sm:p-10 neo-shadow text-center">
            <div className="max-w-xl mx-auto">
              <p className="font-display text-2xl font-bold mb-2">
                5 commands. That's it.
              </p>
              <div className="bg-background neo-border rounded-lg p-4 mb-6 text-left font-mono text-sm text-foreground/70 space-y-1">
                <p>
                  <span className="text-purple">$</span> git clone
                  github.com/CoodayeA/Gratonite
                </p>
                <p>
                  <span className="text-purple">$</span> cd
                  Gratonite/deploy/self-host
                </p>
                <p>
                  <span className="text-purple">$</span> cp .env.example .env
                </p>
                <p>
                  <span className="text-purple">$</span> nano .env
                </p>
                <p>
                  <span className="text-purple">$</span> docker compose up -d
                </p>
              </div>
              <p className="text-foreground/50 text-sm mb-6">
                Works on any Linux machine, VPS, or even your home PC. Behind
                NAT? Use the built-in relay network — no port forwarding needed.
              </p>
              <Button variant="primary" size="lg" href="/docs/self-hosting">
                Get Started
              </Button>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
