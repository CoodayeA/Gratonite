import { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ScrollReveal } from "@/components/effects/ScrollReveal";

export const metadata: Metadata = {
  title: "About Gratonite — The Open-Source Community Platform",
  description: "The story behind Gratonite, a free and open-source alternative to Discord. Built by friends who wanted a better place to hang out online.",
};

const team = [
  {
    name: "Cody Alexander",
    role: "Founder & Lead Developer",
    bio: "Building Gratonite in public because hanging out with friends online should feel better than this.",
    color: "bg-purple",
  },
  {
    name: "The Community",
    role: "Co-creators",
    bio: "Ideas, feedback, bug reports, and feature requests from real users shape every release.",
    color: "bg-gold",
  },
  {
    name: "Creators",
    role: "Cosmetics Builders",
    bio: "Designers and artists building skins, effects, and collectibles that make every server feel unique.",
    color: "bg-blue-light",
  },
  {
    name: "Collectors",
    role: "Auction House Economy",
    bio: "People trading, collecting, and curating the culture around community cosmetics.",
    color: "bg-yellow",
  },
];

const values = [
  {
    title: "Your attention is not our business model",
    description:
      "No ad feed. No selling your data. We make product calls around better conversations, not better dashboard numbers.",
  },
  {
    title: "Built by friends, for friends",
    description:
      "This is a human project, not a growth machine. If it doesn't make hanging out better, it doesn't ship.",
  },
  {
    title: "Your community, your culture",
    description:
      "User-made cosmetics, collectibles, and auction-house trading let every community build its own identity.",
  },
  {
    title: "Open source and accountable",
    description:
      "The code is open. If we claim something, you can verify it.",
  },
];

export default function AboutPage() {
  return (
    <div className="pt-28 pb-16 px-6 relative overflow-hidden">
      <div className="neo-burst neo-burst-purple top-20 right-[-70px]" />
      <div className="neo-burst neo-burst-blue bottom-10 left-[-95px]" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Hero */}
        <ScrollReveal>
          <div className="mb-20">
            <Badge color="purple" rotate className="mb-4">
              Our Story
            </Badge>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              Built by friends,
              <br />
              <span className="bg-yellow px-3 -mx-1 inline-block tilt-2">
                for friends.
              </span>
            </h1>
            <div className="max-w-2xl space-y-4 text-lg text-foreground/60 leading-relaxed">
              <p>
                Too many community apps started to feel like work software in a
                costume: noisy feeds, endless pings, and design choices built
                to keep you scrolling.
              </p>
              <p>
                Gratonite started because we wanted a place to hang out with our
                people without compromise. Fast chat, real voice, and community
                spaces with actual personality.
              </p>
              <p className="font-medium text-foreground">
                {"This is what I wish existed years ago, so I'm building it."}
              </p>
            </div>
          </div>
        </ScrollReveal>

        {/* Values */}
        <section className="mb-20">
          <ScrollReveal>
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-10">
              What we believe
            </h2>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 gap-6">
            {values.map((value, i) => (
              <ScrollReveal key={value.title} delay={i * 0.1}>
                <div className="bg-surface neo-border rounded-xl p-8 neo-shadow">
                  <h3 className="font-display text-xl font-bold mb-2">
                    {value.title}
                  </h3>
                  <p className="text-foreground/60 leading-relaxed">
                    {value.description}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Team */}
        <section className="mb-20">
          <ScrollReveal>
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              The team
            </h2>
            <p className="text-foreground/50 mb-10">
              Small, personal, and community-built.
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((person, i) => (
              <ScrollReveal key={person.name + person.role} delay={i * 0.1}>
                <Card className="h-full text-center">
                  <div
                    className={`w-16 h-16 rounded-xl neo-border-2 mx-auto mb-4 ${person.color} flex items-center justify-center text-white font-display font-bold text-xl`}
                  >
                    {person.name === "You"
                      ? "F"
                      : person.name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)}
                  </div>
                  <h3 className="font-display font-bold">{person.name}</h3>
                  <p className="text-sm font-medium text-purple mb-2">
                    {person.role}
                  </p>
                  <p className="text-foreground/50 text-sm">{person.bio}</p>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Pull quote */}
        <ScrollReveal>
          <div className="bg-charcoal text-white neo-border rounded-2xl p-12 md:p-16 text-center">
            <blockquote className="font-display text-3xl sm:text-4xl font-bold leading-tight max-w-3xl mx-auto">
              {'"Software for friendship should feel like friendship."'}
            </blockquote>
            <p className="mt-6 text-white/50">— Cody Alexander, building Gratonite</p>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
