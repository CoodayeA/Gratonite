import { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScrollReveal } from "@/components/effects/ScrollReveal";

export const metadata: Metadata = {
  title: "Why Gratonite? A Free, Open-Source Alternative to Discord",
  description:
    "Compare Gratonite vs Discord. Free, open-source, no tracking, no phone verification. Spatial voice, cosmetics, auction house, and community-first design.",
};

const comparisonRows = [
  { feature: "Price", gratonite: "Free forever", discord: "Free tier + Nitro ($9.99/mo)", win: true },
  { feature: "Open Source", gratonite: "Yes", discord: "No", win: true },
  { feature: "User Tracking", gratonite: "None", discord: "Extensive", win: true },
  { feature: "Phone Verification", gratonite: "Not required", discord: "Required for some servers", win: true },
  { feature: "Spatial Voice", gratonite: "Built-in", discord: "No", win: true },
  { feature: "Cosmetics & Collectibles", gratonite: "User-created marketplace", discord: "Nitro-only cosmetics", win: true },
  { feature: "Auction House", gratonite: "Built-in economy", discord: "No equivalent", win: true },
  { feature: "Ads", gratonite: "None", discord: "Promoted content", win: true },
  { feature: "Data Privacy", gratonite: "No data selling", discord: "Data shared with partners", win: true },
  { feature: "Community Ownership", gratonite: "Your data, your rules", discord: "Platform-controlled", win: true },
];

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
    question: "Is Gratonite really a Discord alternative?",
    answer:
      "Yes. Gratonite offers real-time text chat, voice channels, servers, and roles \u2014 the core of what makes Discord useful. But we also add spatial voice, a cosmetics marketplace, and an auction house that Discord doesn\u2019t have.",
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

        {/* Comparison Table */}
        <section className="mb-20">
          <ScrollReveal>
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-10">
              Gratonite vs Discord
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.05}>
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full bg-surface neo-border rounded-xl overflow-hidden">
                <thead>
                  <tr className="border-b-2 border-foreground/10">
                    <th className="text-left font-display font-bold p-4 sm:p-5">
                      Feature
                    </th>
                    <th className="text-left font-display font-bold p-4 sm:p-5 text-purple">
                      Gratonite
                    </th>
                    <th className="text-left font-display font-bold p-4 sm:p-5 text-foreground/50">
                      Discord
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr
                      key={row.feature}
                      className={
                        i < comparisonRows.length - 1
                          ? "border-b border-foreground/5"
                          : ""
                      }
                    >
                      <td className="p-4 sm:p-5 font-medium whitespace-nowrap">
                        {row.feature}
                      </td>
                      <td className="p-4 sm:p-5 text-purple font-semibold">
                        {row.gratonite}
                      </td>
                      <td className="p-4 sm:p-5 text-foreground/40">
                        {row.discord}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollReveal>
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
              <Button variant="outline" size="lg" href="/discover" className="text-white border-white/20">
                Explore Communities
              </Button>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
