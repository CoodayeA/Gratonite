import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import {
  MessageSquareIcon,
  GlobeIcon,
  MonitorIcon,
  SmartphoneIcon,
  CheckIcon,
  ServerIcon,
  ClockIcon,
  UsersIcon,
} from "./icons";
import { DockerExplainer } from "./DockerExplainer";
import { CopyButton } from "./CopyButton";

const trustItems = [
  "100% open source",
  "No ads, no data selling",
  "Free forever",
  "Export your data anytime",
];

export function ServerSection() {
  return (
    <section id="server" className="py-16">
      {/* ── Header ──────────────────────────────────────────────── */}
      <ScrollReveal>
        <p className="neo-sticker neo-sticker-gold inline-block mb-4">
          Gratonite Server
        </p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-2">
          Create your portal
        </h2>
        <p className="text-foreground/60 text-base mb-10 max-w-lg">
          A portal is your own community space — entirely yours. Use ours for
          free, or host it yourself.
        </p>
      </ScrollReveal>

      {/* ── Use Gratonite (hosted) ──────────────────────────────── */}
      <ScrollReveal>
        <Card accent="purple" className="relative overflow-hidden mb-10">
          {/* "Most Popular" corner badge */}
          <div className="absolute top-4 right-4 bg-purple text-white text-xs font-bold px-3 py-1 rounded-md neo-border-2 neo-shadow-sm">
            Most Popular
          </div>

          <div className="w-12 h-12 rounded-xl bg-purple/10 flex items-center justify-center mb-4">
            <MessageSquareIcon size={24} className="text-purple" />
          </div>

          <h3 className="font-display text-2xl font-bold mb-1">
            Use Gratonite
          </h3>
          <p className="text-foreground/50 text-sm mb-4">
            No setup needed. Just sign up and go.
          </p>
          <p className="text-foreground/70 text-sm leading-relaxed mb-6 max-w-xl">
            Create a portal and invite your friends in under a minute. We handle
            the servers, updates, and backups. You just chat.
          </p>

          {/* App pills */}
          <div className="flex flex-wrap gap-3 mb-6">
            <span className="inline-flex items-center gap-2 neo-border-2 rounded-lg px-3 py-1.5 text-sm font-semibold bg-surface">
              <GlobeIcon size={16} /> Web App
            </span>
            <span className="inline-flex items-center gap-2 neo-border-2 rounded-lg px-3 py-1.5 text-sm font-semibold bg-surface">
              <MonitorIcon size={16} /> Desktop App
            </span>
            <span className="inline-flex items-center gap-2 neo-border-2 rounded-lg px-3 py-1.5 text-sm font-semibold bg-surface">
              <SmartphoneIcon size={16} /> Mobile App
            </span>
          </div>

          {/* Trust row */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 mb-8">
            {trustItems.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 text-sm text-foreground/70"
              >
                <CheckIcon size={16} className="text-green-500" />
                {item}
              </span>
            ))}
          </div>

          <Button variant="primary" size="md" href="https://gratonite.chat/app">
            Get Started
          </Button>
        </Card>
      </ScrollReveal>

      {/* ── Bridging text ───────────────────────────────────────── */}
      <ScrollReveal>
        <p className="text-center text-foreground/50 text-sm mb-10 max-w-md mx-auto">
          When you use Gratonite above, your portals live on our servers. Below,
          you can run your own copy of Gratonite so your portals live on hardware you control.
        </p>
      </ScrollReveal>

      {/* ── Divider ─────────────────────────────────────────────── */}
      <ScrollReveal>
        <div className="flex items-center gap-4 mb-12">
          <hr className="flex-1 border-foreground/10" />
          <span className="text-foreground/40 text-sm font-semibold whitespace-nowrap">
            Want to host Gratonite yourself?
          </span>
          <hr className="flex-1 border-foreground/10" />
        </div>
      </ScrollReveal>

      {/* ── Self-hosting cards ──────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-6">
        {/* Run on Your Computer */}
        <ScrollReveal>
          <Card className="h-full flex flex-col">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center mb-4">
              <MonitorIcon size={24} className="text-amber-500" />
            </div>

            <h3 className="font-display text-xl font-bold mb-1">
              Run on Your Computer
            </h3>
            <p className="text-foreground/50 text-sm mb-5">
              Perfect for trying self-hosting or running a portal for a small
              group of friends on your own machine.
            </p>

            {/* Keep in mind box */}
            <div className="neo-border-2 rounded-xl p-4 bg-surface/50 mb-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/40">
                Keep in mind
              </p>
              <div className="flex items-start gap-2.5 text-sm text-foreground/60">
                <ClockIcon size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Your portal is only online while your computer is on and the
                  app is running.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-sm text-foreground/60">
                <GlobeIcon size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Friends outside your local network need port-forwarding or a
                  tunnel to connect.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-sm text-foreground/60">
                <UsersIcon size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Best for up to ~20 concurrent users depending on your
                  hardware.
                </span>
              </div>
            </div>

            <DockerExplainer />

            <div className="mt-auto pt-5">
              <Button
                variant="secondary"
                size="sm"
                href="https://github.com/CoodayeA/Gratonite/releases/tag/server-v0.1.2"
                className="w-full"
              >
                Download Server App
              </Button>
              <p className="text-foreground/40 text-xs mt-3 text-center">
                Requires Docker Desktop to be installed first.
              </p>
            </div>
          </Card>
        </ScrollReveal>

        {/* Always-On Server */}
        <ScrollReveal delay={0.08}>
          <Card className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-500/10 flex items-center justify-center">
                <ServerIcon size={24} className="text-green-500" />
              </div>
              <Badge color="gold" className="text-xs !px-2 !py-0.5">
                Best for Communities
              </Badge>
            </div>

            <h3 className="font-display text-xl font-bold mb-1">
              Always-On Server
            </h3>
            <p className="text-foreground/50 text-sm mb-5">
              Deploy Gratonite to a cloud server so your portal is available
              24/7. Recommended for communities and teams.
            </p>

            {/* Benefits box */}
            <div className="neo-border-2 rounded-xl p-4 bg-surface/50 mb-5 space-y-3">
              <div className="flex items-start gap-2.5 text-sm text-foreground/60">
                <CheckIcon size={16} className="text-green-500 shrink-0 mt-0.5" />
                <span>Always online, no downtime when you close your laptop.</span>
              </div>
              <div className="flex items-start gap-2.5 text-sm text-foreground/60">
                <CheckIcon size={16} className="text-green-500 shrink-0 mt-0.5" />
                <span>Accessible from anywhere without port-forwarding.</span>
              </div>
              <div className="flex items-start gap-2.5 text-sm text-foreground/60">
                <CheckIcon size={16} className="text-green-500 shrink-0 mt-0.5" />
                <span>
                  Handles any community size, from 5 to 5,000 members.
                </span>
              </div>
            </div>

            <DockerExplainer />

            {/* CLI command */}
            <div className="mt-5 flex items-center gap-2 neo-border-2 rounded-lg bg-charcoal px-4 py-3">
              <code className="text-xs text-white/80 font-mono flex-1 overflow-x-auto">
                curl -fsSL https://gratonite.chat/install | bash
              </code>
              <CopyButton text="curl -fsSL https://gratonite.chat/install | bash" />
            </div>

            <div className="mt-auto pt-5 text-center">
              <a
                href="/deploy/"
                className="text-purple text-sm font-bold hover:underline"
              >
                Read the full deploy guide &rarr;
              </a>
            </div>
          </Card>
        </ScrollReveal>
      </div>
    </section>
  );
}
