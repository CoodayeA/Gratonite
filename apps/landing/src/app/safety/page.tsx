import { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Gratonite Safety and Privacy",
  description:
    "Learn how Gratonite protects privacy with no tracking, strong safety tools, and optional end-to-end encrypted DMs.",
  path: "/safety/",
  keywords: [
    "Gratonite privacy",
    "Gratonite safety",
    "private Discord alternative",
    "no tracking chat app",
  ],
});

const points = [
  {
    title: "Your data is yours",
    description:
      "We don't sell your info. We don't build profiles on you. We don't even want your phone number.",
    color: "bg-purple",
  },
  {
    title: "Private by default",
    description:
      "Your messages stay your messages. DMs support optional end-to-end encryption \u2014 the server never sees the content. Guild messages are delivered through our servers, never sold or mined.",
    color: "bg-gold",
  },
  {
    title: "Block and report",
    description:
      "Got a jerk? Block them. Report them. We keep tools close so bad vibes leave fast.",
    color: "bg-blue-light",
  },
  {
    title: "No tracking",
    description:
      "No analytics SDKs. No ad trackers. No behavioral profiling. We process messages to deliver them \u2014 that's it.",
    color: "bg-yellow",
  },
  {
    title: "End-to-end encryption",
    description:
      "DMs can be end-to-end encrypted using ECDH key exchange and AES-GCM. Your private key never leaves your device.",
    color: "bg-charcoal",
  },
];

export default function SafetyPage() {
  return (
    <div className="pt-28 pb-16 px-6 relative overflow-hidden">
      <div className="neo-burst neo-burst-purple top-24 left-[-90px]" />
      <div className="neo-burst neo-burst-gold bottom-16 right-[-70px]" />

      <div className="max-w-6xl mx-auto relative z-10">
        <ScrollReveal>
          <Badge color="yellow" rotate className="mb-4">
            Safety
          </Badge>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-4">
            Keep it
            <br />
            <span className="bg-blue-light text-black px-3 -mx-1 inline-block tilt-2">
              chill.
            </span>
          </h1>
          <p className="text-lg text-foreground/60 max-w-2xl mb-12">
            {"Your safety matters. Here's how we keep Gratonite healthy while staying true to \"built by friends, for friends.\" A good hangout should feel safe."}
          </p>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 gap-6">
          {points.map((point, i) => (
            <ScrollReveal key={point.title} delay={i * 0.08}>
              <article className="bg-surface neo-border rounded-2xl p-7 neo-shadow h-full">
                <div
                  className={`w-12 h-12 rounded-lg neo-border-2 mb-4 ${point.color}`}
                />
                <h2 className="font-display text-2xl font-bold mb-2">
                  {point.title}
                </h2>
                <p className="text-foreground/65 leading-relaxed">
                  {point.description}
                </p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </div>
  );
}
