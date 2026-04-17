"use client";

import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function CTA() {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const card = cardRef.current;
    const glow = glowRef.current;
    if (!card) return;

    // Card entrance: scale from 0.96 with rotation correction
    gsap.fromTo(card,
      { scale: 0.96, rotate: 0.5, opacity: 0 },
      { scale: 1, rotate: 0, opacity: 1, duration: 0.6, ease: "power3.out",
        scrollTrigger: { trigger: card, start: "top 85%", once: true },
      },
    );

    // Background glow parallax on scroll
    if (glow) {
      gsap.to(glow, {
        y: -30,
        scrollTrigger: { trigger: card, start: "top bottom", end: "bottom top", scrub: 1 },
      });
    }

    return () => ScrollTrigger.getAll().forEach(t => { if (t.trigger === card) t.kill(); });
  }, []);

  return (
    <section className="section-pad px-6 relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div
          ref={cardRef}
          className="bg-gradient-to-br from-purple to-[#5B21B6] text-white neo-border rounded-2xl p-12 md:p-20 text-center relative overflow-hidden neo-shadow-lg"
        >
          {/* Subtle radial glow */}
          <div
            ref={glowRef}
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(167,139,250,0.2)_0%,transparent_70%)] pointer-events-none"
          />

          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4 relative z-10">
            Your space. Your rules.
          </h2>
          <p className="text-lg text-white/60 max-w-lg mx-auto mb-8 relative z-10">
            Bring your people somewhere that feels owned, not rented. Chat,
            voice, collectibles, self-hosting, and room for a community
            culture that actually feels like yours.
          </p>
          <div className="flex flex-wrap justify-center gap-4 relative z-10">
            <Button variant="secondary" size="lg" href="/download">
              Get Gratonite
            </Button>
            <Button variant="outline" size="lg" href="/app" className="border-white/40 text-white hover:bg-white/10">
              Open in Browser
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
