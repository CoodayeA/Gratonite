import { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Why Gratonite | A Better Place to Hang Out Online",
  description:
    "Why people switch to Gratonite: no phone-number gate, no ads, friend-first design, self-hosting, and communities that feel owned instead of rented.",
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
    title: "No phone-number gate",
    description: "Join communities without handing over your number just to get through the door.",
    accent: "purple" as const,
  },
  {
    title: "We build for people, not retention charts",
    description: "No ads, no tracking, no engagement tricks. We build features that make hanging out better, not stickier.",
    accent: "yellow" as const,
  },
  {
    title: "Community-made culture",
    description: "Creators make skins and collectibles. Communities trade them, show them off, and make the place feel like theirs.",
    accent: "blue" as const,
  },
  {
    title: "Read the source",
    description: "Inspect the code, contribute, and keep us honest. Gratonite does not ask for blind trust.",
    accent: "gold" as const,
  },
];

const faqs = [
  {
    question: "What makes Gratonite different?",
    answer:
      "Gratonite is open source, has no ads, asks for no phone number, and gives your community actual ownership of its space. It also ships things most platforms do not — spatial voice, community-made cosmetics, and a built-in marketplace.",
  },
  {
    question: "Can I use Gratonite without a phone number?",
    answer:
      "Absolutely. We do not require phone verification to join or create communities.",
  },
  {
    question: "Is Gratonite open source?",
    answer:
      "Yes. The code is public on GitHub, so you can inspect it, contribute to it, and verify what we claim.",
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
              Gratonite is for people who want their online space to feel owned,
              not rented. No ads, no phone-number gate, self-hosting if you want
              it, and room for a community to feel like itself.
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
              The stuff that matters, without the platform baggage.
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Free forever", detail: "No paywalled core features, ever." },
               { label: "Open source", detail: "Full code on GitHub. Read it yourself." },
              { label: "No ads, no tracking", detail: "Your data is not our business model." },
              { label: "No phone number needed", detail: "Sign up without giving up your digits." },
              { label: "Spatial voice", detail: "Move around a room. Hear who's near you." },
               { label: "Community culture", detail: "Cosmetics, collectibles, marketplace." },
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
              Join a community platform that treats people like people. No credit
              card, no phone number, no catch.
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
