import { ScrollReveal } from "@/components/effects/ScrollReveal";

export const faqs = [
  {
    question: "Is Gratonite actually free?",
    answer:
      "Yes. 100% free. No credit card, no catch, and no fake limits that force upgrades.",
  },
  {
    question: "Who is this for?",
    answer:
      "Friend groups, guilds, classes, study circles, and creator communities who want a better place to hang out.",
  },
  {
    question: "What makes it different?",
    answer:
      "It feels like your own place. Chat and voice are the core, then your community adds cosmetics, collectibles, and auction-house culture on top.",
  },
  {
    question: "Do I need to install anything?",
    answer:
      "No. You can use it in the browser right now. Desktop apps are available, and native iOS + Android builds are in active rollout.",
  },
  {
    question: "Is this open source?",
    answer:
      "Yes. The code is open. You can inspect it, contribute to it, and build on it with us.",
  },
];

export function FAQ() {
  return (
    <section className="py-16 lg:py-20 px-6 relative overflow-hidden">
      <div className="neo-burst neo-burst-purple bottom-8 left-[-90px] opacity-70" />
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="mb-12 relative">
            <div className="absolute -top-8 right-0 hidden md:block neo-sticker neo-sticker-gold tilt-2">
              Straight Answers
            </div>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
              Questions, answered.
            </h2>
            <p className="text-lg text-foreground/60 max-w-2xl">
              The real questions people ask before moving their community.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 gap-6">
          {faqs.map((faq, i) => (
            <ScrollReveal key={faq.question} delay={i * 0.06}>
              <article
                className={`bg-surface neo-border rounded-xl p-6 h-full ${
                  i % 2 === 0 ? "rotate-[-0.6deg]" : "rotate-[0.6deg]"
                }`}
              >
                <h3 className="font-display text-2xl font-bold leading-tight mb-3">
                  {faq.question}
                </h3>
                <p className="text-foreground/65 leading-relaxed">
                  {faq.answer}
                </p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
