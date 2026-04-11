"use client";

import { useRef, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const benefits = [
  {
    title: "Total Privacy",
    description:
      "Your data stays on your hardware. No analytics, no tracking, no third-party access. Ever.",
    accent: "purple" as const,
  },
  {
    title: "Federation",
    description:
      "Federation is live — your instance connects to the relay automatically. Users can join servers on other instances and vice versa.",
    accent: "gold" as const,
  },
  {
    title: "Zero Lock-in",
    description:
      "Export everything. Move to another host. Fork it. It's open source and yours to keep.",
    accent: "blue" as const,
  },
];

const CURL_CMD = "curl -fsSL https://gratonite.chat/install | bash";

export function SelfHosting() {
  const cmdRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = cmdRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (el) el.textContent = CURL_CMD;
      return;
    }
    el.textContent = "";
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top 90%",
      once: true,
      onEnter: () => {
        const chars = CURL_CMD.split("");
        const obj = { i: 0 };
        gsap.to(obj, {
          i: chars.length,
          duration: 1.2,
          ease: "none",
          snap: { i: 1 },
          onUpdate: () => { el.textContent = chars.slice(0, obj.i).join(""); },
        });
      },
    });
    return () => trigger.kill();
  }, []);

  return (
    <section className="section-pad-lg px-6 relative overflow-hidden">

      <div className="max-w-7xl mx-auto relative z-10">
        <ScrollReveal>
          <div className="text-center mb-16">
            <p className="text-sm font-bold uppercase tracking-wider text-purple mb-3">
              Self-Hosting
            </p>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
              YOUR SERVER.
              <br />
              <span className="text-purple">YOUR RULES.</span>
            </h2>
            <p className="text-lg text-foreground/60 max-w-2xl mx-auto">
              Run your own Gratonite instance in 5 minutes. Full control over
              your data, your community, your way. No coding required.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {benefits.map((benefit, i) => (
            <ScrollReveal key={benefit.title} delay={i * 0.1}>
              <Card accent={benefit.accent}>
                <h3 className="font-display text-xl font-bold mb-2">
                  {benefit.title}
                </h3>
                <p className="text-foreground/60 text-sm leading-relaxed">
                  {benefit.description}
                </p>
              </Card>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={0.3}>
          <div className="bg-surface neo-border rounded-xl p-8 sm:p-10 neo-shadow text-center">
            <div className="max-w-xl mx-auto">
              <p className="font-display text-2xl font-bold mb-2">
                1 command. That's it.
              </p>
              <div className="bg-background neo-border rounded-lg p-4 mb-6 text-left font-mono text-sm text-foreground/70 space-y-1" style={{ boxShadow: "0 0 60px rgba(124, 58, 237, 0.1)" }}>
                <p>
                  <span className="text-purple">$</span>{" "}
                  <span ref={cmdRef}>{CURL_CMD}</span>
                </p>
              </div>
              <p className="text-foreground/50 text-sm mb-6">
                Works on any Linux machine, VPS, or even your home PC. Behind
                NAT? Use the built-in relay network. No port forwarding needed.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button variant="primary" size="lg" href="/deploy">
                  Get Started
                </Button>
                <Button variant="outline" size="lg" href="https://gratonite.chat/download">
                  Download Desktop App
                </Button>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
