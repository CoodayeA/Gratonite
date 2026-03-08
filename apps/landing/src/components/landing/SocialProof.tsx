import { ScrollReveal } from "@/components/effects/ScrollReveal";

const categories = [
  "Gaming",
  "Study",
  "Creative",
  "Music",
  "Startups",
  "Anime",
];

const stats = [
  { label: "Open source", value: "100%" },
  { label: "Self-hostable", value: "Yes" },
  { label: "Tracking", value: "None" },
];

export function SocialProof() {
  return (
    <section className="px-6 py-12 lg:py-14 relative overflow-hidden">
      <div className="neo-burst neo-burst-blue top-8 right-[-70px] opacity-70" />
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="bg-surface neo-border rounded-2xl p-8 md:p-10">
            <p className="font-display text-sm sm:text-base font-bold uppercase tracking-wider text-foreground/50 mb-6">
              Built for every kind of community
            </p>

            <div className="grid md:grid-cols-2 gap-8 md:gap-10">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {categories.map((name) => (
                  <div
                    key={name}
                    className="neo-border-2 rounded-lg px-3 py-2 text-sm font-semibold bg-off-white/60 dark:bg-charcoal/40 odd:rotate-[-1deg] even:rotate-[1deg]"
                  >
                    {name}
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3 gap-4">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="neo-border-2 rounded-lg p-4 bg-purple/5"
                  >
                    <p className="font-display text-2xl font-bold leading-none mb-2">
                      {stat.value}
                    </p>
                    <p className="text-sm text-foreground/60">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
