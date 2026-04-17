import { ScrollReveal } from "@/components/effects/ScrollReveal";

export const faqs = [
  {
    question: "Is Gratonite actually free?",
    answer:
      "Yes. No credit card, no catch, and no fake ceiling that appears the second your community gets lively.",
  },
  {
    question: "Who is this for?",
    answer:
      "Friend groups, guilds, classes, study circles, and creator communities who want a better place to hang out.",
  },
  {
    question: "What makes it different?",
    answer:
      "It feels like your own place. Chat and voice are the foundation, then your community adds its own culture on top.",
  },
  {
    question: "Do I need to install anything?",
    answer:
      "No. You can use it in the browser right now. Desktop apps are ready, and iOS + Android are in active rollout.",
  },
  {
    question: "Is this open source?",
    answer:
      "Yes. The code is open. You can inspect it, contribute to it, and build on it with us.",
  },
];

const accentColors = ["border-l-purple", "border-l-gold"];

export function FAQ() {
  return (
    <section className="section-pad px-6 relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="mb-12 relative">
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
              What people ask before they move in.
            </h2>
            <p className="text-lg text-foreground/60 max-w-2xl">
              The practical stuff, answered plainly.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 gap-6">
          {faqs.map((faq, i) => (
            <ScrollReveal key={faq.question} delay={i * 0.06}>
              <article
                className={`bg-surface neo-border rounded-xl p-6 h-full border-l-4 ${accentColors[i % 2]}`}
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
