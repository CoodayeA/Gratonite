import { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Gratonite Pricing | Free Forever Discord Alternative",
  description:
    "See Gratonite pricing: 100% free forever with no ads, no tracking, and no paywalled core features. An open-source Discord alternative that puts community over profit.",
  path: "/pricing/",
  keywords: [
    "Gratonite pricing",
    "is Gratonite free",
    "free Discord alternative",
    "Discord alternative no ads",
  ],
});

const included = [
  "Unlimited messages",
  "Voice and video hangouts",
  "Servers, channels, and threads",
  "Community bots and themes",
  "Cosmetics, collectibles, and auction house",
  "Desktop and browser access",
  "iOS + Android builds (rolling out)",
  "Open source transparency",
];

const promises = [
  "No microtransactions",
  "No ads",
  "No user tracking",
  "No paywalled core features",
];

export default function PricingPage() {
  return (
    <div className="pt-28 pb-16 px-6 relative overflow-hidden">
      <div className="neo-burst neo-burst-purple top-10 left-[-90px]" />
      <div className="neo-burst neo-burst-gold top-40 right-[-80px]" />
      <div className="neo-burst neo-burst-blue bottom-12 left-[12%]" />

      <div className="max-w-7xl mx-auto relative z-10">
        <ScrollReveal>
          <div className="mb-8">
            <Badge color="yellow" rotate className="mb-4">
              Pricing
            </Badge>
            <p className="font-display text-sm sm:text-base font-bold uppercase tracking-wider text-foreground/50">
              No monetization circus. Just community.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <section className="bg-surface neo-border rounded-3xl p-8 md:p-12 lg:p-16 mb-10 relative overflow-hidden">
            <div className="absolute top-6 right-6 hidden md:block">
              <Badge color="purple" rotate>
                Seriously.
              </Badge>
            </div>

            <h1 className="font-display text-[2.7rem] sm:text-6xl lg:text-8xl font-bold leading-[0.9] tracking-tight mb-4">
              FREE now.
              <br />
              <span className="bg-purple text-white px-3 -mx-1 inline-block tilt-3">
                FREE forever.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-foreground/65 max-w-2xl mb-7">
              No microtransactions. No ads. Just a place where friends can
              talk, play, study, and build culture together.
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              {promises.map((item, i) => (
                <div
                  key={item}
                  className={`neo-border rounded-lg px-4 py-2 font-display font-bold text-sm ${
                    i % 2 === 0
                      ? "bg-yellow text-black tilt-1"
                      : "bg-blue-light text-black tilt-2"
                  }`}
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-4">
              <Button variant="primary" size="lg" href="/download">
                Get Gratonite
              </Button>
              <Button variant="outline" size="lg" href="/app">
                Open in Browser
              </Button>
            </div>
          </section>
        </ScrollReveal>

        <section className="grid lg:grid-cols-2 gap-6">
          <ScrollReveal delay={0.05}>
            <div className="bg-charcoal text-white neo-border rounded-2xl p-8 h-full">
              <h2 className="font-display text-3xl font-bold mb-4">
                Everything included
              </h2>
              <ul className="space-y-3">
                {included.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded bg-yellow text-black neo-border-2 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      ✓
                    </span>
                    <span className="text-white/85">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.12}>
            <div className="bg-yellow neo-border rounded-2xl p-8 h-full">
              <h2 className="font-display text-3xl font-bold mb-3 text-black">
                Why this pricing model?
              </h2>
              <p className="text-black/75 text-lg leading-relaxed mb-5">
                {"Gratonite is the hangout app we wanted for our own friends. If it makes community better, it stays. If it feels like monetization theater, it goes."}
              </p>
              <p className="font-display text-2xl font-bold text-black">
                Built by friends, for friends.
              </p>
              <div className="mt-6 neo-border rounded-xl bg-white/60 px-4 py-4">
                <p className="font-display font-bold text-black mb-2">
                  Want to support the project?
                </p>
                <p className="text-black/75 leading-relaxed mb-3">
                  Gratonite is free forever. If you want to help keep it going,
                  you can support development with a donation.
                </p>
                <a
                  href="https://buymeacoffee.com/codya"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 font-display font-bold text-black hover:text-purple transition-colors"
                >
                  Buy me a coffee
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          </ScrollReveal>
        </section>
      </div>
    </div>
  );
}
