import { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Why Gratonite | Open-Source Community Platform",
  description:
    "See what makes Gratonite different: open source, no ads, no tracking, no phone verification, spatial voice, and a community-created economy. Your space, your rules.",
  path: "/why-gratonite/",
  keywords: [
    "why Gratonite",
    "open source community platform",
    "no ads chat app",
    "privacy-first community",
    "federated community platform",
  ],
});

const differentiators = [
  {
    title: "No phone verification required",
    description: "Join communities without giving up your phone number. Your identity is yours to share on your own terms.",
    accent: "purple" as const,
  },
  {
    title: "Your attention is not our product",
    description: "No ads, no tracking, no engagement tricks. We build features that make conversations better, not stickier.",
    accent: "yellow" as const,
  },
  {
    title: "Community-created economy",
    description: "Cosmetics, collectibles, and an auction house built by the community. Creators earn, collectors curate, everyone benefits.",
    accent: "blue" as const,
  },
  {
    title: "Open source and transparent",
    description: "Inspect the code, contribute, and verify our claims. No black boxes, no hidden agendas.",
    accent: "gold" as const,
  },
];

const faqs = [
  {
    question: "What makes Gratonite different?",
    answer:
      "Gratonite is fully open source, has no ads, requires no phone number, and gives your community actual ownership of their space. We also ship things most platforms don't — spatial voice, a cosmetics marketplace, and a built-in auction house.",
  },
  {
    question: "Can I use Gratonite without a phone number?",
    answer:
      "Absolutely. We don\u2019t require phone verification to join or create communities. Your privacy matters.",
  },
  {
    question: "Is Gratonite open source?",
    answer:
      "Yes. Our code is publicly available on GitHub. You can inspect it, contribute, and verify that we do what we say.",
  },
  {
    question: "Does Gratonite work for gaming communities?",
    answer:
      "Yes. Gratonite was built with gaming communities in mind \u2014 low-latency voice, rich text chat, and community cosmetics make it a natural fit.",
  },
  {
    question: "Is Gratonite free for large communities?",
    answer:
      "Yes. There are no user limits, no message limits, and no premium tiers required for larger servers.",
  },
];

// Static FAQ structured data for SEO - contains no user input, safe to inline
const faqJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
});

export default function WhyGratonitePage() {
  return (
    <div className="pt-28 pb-16 px-6 relative overflow-hidden">
      {/* FAQ JSON-LD structured data - static content, no user input */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqJsonLd }}
      />

      <div className="neo-burst neo-burst-purple top-16 right-[-80px]" />
      <div className="neo-burst neo-burst-gold top-[40%] left-[-90px]" />
      <div className="neo-burst neo-burst-blue bottom-20 right-[10%]" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Hero */}
        <ScrollReveal>
          <div className="mb-20">
            <Badge color="yellow" rotate className="mb-4">
              Why Switch?
            </Badge>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              A better way to
              <br />
              <span className="bg-purple text-white px-3 -mx-1 inline-block tilt-2">
                hang out online.
              </span>
            </h1>
            <p className="max-w-2xl text-lg text-foreground/60 leading-relaxed">
              Gratonite is a free, open-source community platform with no ads, no
              tracking, and no phone verification. Spatial voice, user-created
              cosmetics, and a built-in auction house make it more than a chat
              app.
            </p>
          </div>
        </ScrollReveal>

        {/* What you get */}
        <section className="mb-20">
          <ScrollReveal>
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              What you get with Gratonite
            </h2>
            <p className="text-foreground/60 mb-10 max-w-xl">
              Everything you need to run a community — without the compromises.
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Free forever", detail: "No paywalled core features, ever." },
              { label: "Open source", detail: "Full code on GitHub. Audit us." },
              { label: "No ads, no tracking", detail: "Your data is not our business model." },
              { label: "No phone number needed", detail: "Sign up without giving up your digits." },
              { label: "Spatial voice", detail: "Move around a room. Hear who's near you." },
              { label: "Community economy", detail: "Cosmetics, collectibles, auction house." },
              { label: "Federated", detail: "Self-host. Connect instances. Own your data." },
              { label: "E2E encrypted DMs", detail: "Auto-on encryption. No setup needed." },
              { label: "Your rules", detail: "Your community, your moderation policies." },
            ].map((item, i) => (
              <ScrollReveal key={item.label} delay={i * 0.05}>
                <div className="bg-surface neo-border rounded-xl p-5">
                  <p className="font-display font-bold text-base mb-1">{item.label}</p>
                  <p className="text-foreground/55 text-sm">{item.detail}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Differentiators */}
        <section className="mb-20">
          <ScrollReveal>
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-10">
              What sets Gratonite apart
            </h2>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 gap-6">
            {differentiators.map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 0.1}>
                <Card accent={item.accent} className="h-full">
                  <h3 className="font-display text-xl font-bold mb-2">
                    {item.title}
                  </h3>
                  <p className="text-foreground/60 leading-relaxed">
                    {item.description}
                  </p>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-20">
          <ScrollReveal>
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-10">
              Frequently asked questions
            </h2>
          </ScrollReveal>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <ScrollReveal key={faq.question} delay={i * 0.08}>
                <div className="bg-surface neo-border rounded-xl p-6 sm:p-8">
                  <h3 className="font-display text-lg font-bold mb-2">
                    {faq.question}
                  </h3>
                  <p className="text-foreground/60 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <ScrollReveal>
          <div className="bg-charcoal text-white neo-border rounded-2xl p-12 md:p-16 text-center">
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              Ready to try?
            </h2>
            <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">
              Join a community that respects your privacy, your time, and your
              creativity. No credit card, no phone number, no catch.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="primary" size="lg" href="/download">
                Download Gratonite
              </Button>
              <Button variant="outline" size="lg" href="/app" className="text-white border-white/20">
                Open in Browser
              </Button>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
