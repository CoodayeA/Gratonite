"use client";

import { useRef, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { useGsap, gsap, ScrollTrigger, prefersReducedMotion } from "@/hooks/useGsap";

const features = [
  {
    icon: "💬",
    title: "Chat that feels alive",
    description:
      "Drop in when you're around. Talk in channels, in threads, or in DMs without everything feeling like work.",
    accent: "purple" as const,
  },
  {
    icon: "🎙️",
    title: "Hop-in voice rooms",
    description:
      "Click once and you're in. Great for late-night game sessions, co-working, or just hanging out.",
    accent: "gold" as const,
  },
  {
    icon: "📹",
    title: "Video when you want it",
    description:
      "Turn cameras on when the moment calls for it. Keep it casual, not performative.",
    accent: "blue" as const,
  },
  {
    icon: "🧭",
    title: "Your own spaces",
    description:
      "Make spaces for your game crew, your study group, your guild, your friend circle. Your rules.",
    accent: "yellow" as const,
  },
  {
    icon: "✨",
    title: "Cosmetics & collectibles",
    description:
      "User-made cosmetics, collectible drops, and an auction house economy that gives communities their own flavor.",
    accent: "purple" as const,
  },
  {
    icon: "🛡️",
    title: "Built for people, not metrics",
    description:
      "No ad feed. No engagement bait. No attention traps. Just your people, your conversations, and your community culture.",
    accent: "gold" as const,
  },
];

const accentBg: Record<string, string> = {
  purple: "bg-purple/10 border-purple/30",
  gold: "bg-gold/10 border-gold/30",
  blue: "bg-blue-light/10 border-blue-light/30",
  yellow: "bg-yellow/10 border-yellow/30",
};

export function Features() {
  const gridRef = useRef<HTMLDivElement>(null);

  // Stagger-reveal cards as a group when grid enters viewport
  useEffect(() => {
    if (prefersReducedMotion || !gridRef.current) return;
    const cards = gridRef.current.querySelectorAll('[data-feature-card]');
    gsap.from(cards, {
      y: 24,
      opacity: 0,
      duration: 0.5,
      stagger: 0.08,
      ease: 'power2.out',
      scrollTrigger: { trigger: gridRef.current, start: 'top 85%', once: true },
    });
    return () => { ScrollTrigger.getAll().forEach(t => { if (t.trigger === gridRef.current) t.kill(); }); };
  }, []);

  // 3D tilt on hover
  useEffect(() => {
    if (prefersReducedMotion || !gridRef.current) return;
    const cards = gridRef.current.querySelectorAll('[data-feature-card]');
    const enterHandlers: Array<() => void> = [];
    const leaveHandlers: Array<() => void> = [];

    cards.forEach((card) => {
      const enter = () => gsap.to(card, { rotateX: -2, rotateY: 3, scale: 1.02, duration: 0.3, ease: 'power2.out' });
      const leave = () => gsap.to(card, { rotateX: 0, rotateY: 0, scale: 1, duration: 0.3, ease: 'power2.out' });
      card.addEventListener('mouseenter', enter);
      card.addEventListener('mouseleave', leave);
      enterHandlers.push(enter);
      leaveHandlers.push(leave);
    });

    return () => {
      cards.forEach((card, i) => {
        card.removeEventListener('mouseenter', enterHandlers[i]);
        card.removeEventListener('mouseleave', leaveHandlers[i]);
      });
    };
  }, []);

  return (
    <section className="section-pad px-6 relative overflow-hidden">
      <div className="neo-divider mb-20" />
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="mb-16 relative">
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
              Make it
              <br />
              <span className="bg-yellow text-black px-2 -mx-2 inline-block">
                yours.
              </span>
            </h2>
            <p className="text-lg text-foreground/60 max-w-lg">
              Built for people who want to laugh, game, study, and keep their
              corner of the internet feeling like home.
            </p>
          </div>
        </ScrollReveal>

        <div ref={gridRef} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" style={{ perspective: '800px' }}>
          {features.map((feature, i) => (
            <div
              key={feature.title}
              data-feature-card
              className={i === 0 ? "sm:col-span-2 lg:col-span-2" : ""}
              style={{ opacity: 0, transformStyle: 'preserve-3d' }}
            >
              <Card accent={feature.accent} className="h-full">
                <div className={`w-12 h-12 rounded-xl border-2 ${accentBg[feature.accent]} flex items-center justify-center text-2xl mb-4`}>
                  {feature.icon}
                </div>
                <h3 className={`font-display font-bold mb-2 ${i === 0 ? "text-2xl lg:text-3xl" : "text-xl"}`}>
                  {feature.title}
                </h3>
                <p className={`text-foreground/60 leading-relaxed ${i === 0 ? "max-w-lg text-lg" : ""}`}>
                  {feature.description}
                </p>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
