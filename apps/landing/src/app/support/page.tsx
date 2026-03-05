import { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ScrollReveal } from "@/components/effects/ScrollReveal";

export const metadata: Metadata = {
  title: "Support — Gratonite",
  description:
    "Real human support from the people building Gratonite.",
};

const cards = [
  {
    title: "Help Center",
    description: "Find answers, browse guides, and figure stuff out fast.",
    href: "/blog",
    cta: "Read Guides",
    color: "bg-purple",
  },
  {
    title: "Report a Bug",
    description: "Something broken? Tell us exactly what went wrong.",
    href: "mailto:bugs@gratonite.chat?subject=Bug%20Report",
    cta: "Email Bugs",
    color: "bg-gold",
  },
  {
    title: "Suggest Features",
    description: "Got an idea? We actually read these and ship from them.",
    href: "mailto:features@gratonite.chat?subject=Feature%20Suggestion",
    cta: "Send Idea",
    color: "bg-blue-light",
  },
];

export default function SupportPage() {
  return (
    <div className="pt-28 pb-16 px-6 relative overflow-hidden">
      <div className="neo-burst neo-burst-blue top-20 right-[-80px]" />

      <div className="max-w-6xl mx-auto relative z-10">
        <ScrollReveal>
          <Badge color="gold" rotate className="mb-4">
            Support
          </Badge>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-4">
            {"We're just humans."}
            <br />
            <span className="bg-yellow text-black px-3 -mx-1 inline-block tilt-3">
              {"We'll help."}
            </span>
          </h1>
          <p className="text-lg text-foreground/60 max-w-xl mb-12">
            No support maze. No canned replies. Just people who care about your
            community and actually read what you send.
          </p>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {cards.map((card, i) => (
            <ScrollReveal key={card.title} delay={i * 0.08}>
              <a
                href={card.href}
                className="block bg-surface neo-border rounded-2xl p-7 neo-shadow neo-shadow-hover h-full"
              >
                <div
                  className={`w-12 h-12 rounded-lg neo-border-2 mb-4 ${card.color}`}
                />
                <h2 className="font-display text-2xl font-bold mb-2">
                  {card.title}
                </h2>
                <p className="text-foreground/65 mb-6">{card.description}</p>
                <p className="font-display text-lg font-bold text-purple">
                  {card.cta} {"->"}
                </p>
              </a>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <div className="bg-charcoal text-white neo-border rounded-2xl p-8 md:p-10">
            <p className="font-display text-2xl md:text-3xl font-bold mb-3">
              {"Can't find what you need?"}
            </p>
            <p className="text-white/70 mb-4">
              Shoot us an email and a human will reply.
            </p>
            <Link
              href="mailto:hello@gratonite.chat"
              className="font-display text-xl font-bold text-yellow hover:underline"
            >
              hello@gratonite.chat
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
