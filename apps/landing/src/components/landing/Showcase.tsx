"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { Badge } from "@/components/ui/Badge";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface PlatformStats {
  guilds: number;
  users: number;
  messages: number;
}

export function Showcase() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("https://api.gratonite.chat/api/v1/stats/public")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setStats)
      .catch(() => setError(true));
  }, []);

  return (
    <section className="section-pad px-6 bg-charcoal text-white relative overflow-hidden">
      <div className="neo-burst neo-burst-purple top-8 left-[-70px] opacity-70" />
      <div className="neo-burst neo-burst-gold bottom-[-50px] right-[10%] opacity-70" />
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-16">
            <Badge color="purple" className="mb-6">
              Real people. Real communities.
            </Badge>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
              A better place to hang out.
            </h2>
            <p className="text-lg text-white/50 max-w-lg mx-auto">
              For friends, guilds, classmates, and creative communities that
              want a hangout, not another feed.
            </p>
          </div>
        </ScrollReveal>

        {/* Showcase grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Panel 1 — Live platform stats */}
          <ScrollReveal delay={0.1}>
            <div className="bg-white/5 border-3 border-white/20 rounded-xl p-6 hover:border-purple transition-colors">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-lg">
                  Platform Stats
                </h3>
                <span className="text-sm text-white/40">live</span>
              </div>
              <div className="space-y-4">
                {stats ? (
                  <>
                    <StatRow
                      label="Communities"
                      value={stats.guilds.toLocaleString()}
                      color="bg-purple"
                    />
                    <StatRow
                      label="Users"
                      value={stats.users.toLocaleString()}
                      color="bg-gold"
                    />
                    <StatRow
                      label="Messages sent"
                      value={stats.messages.toLocaleString()}
                      color="bg-blue-light"
                    />
                  </>
                ) : error ? (
                  <p className="text-white/40 text-sm py-4">
                    Stats unavailable right now.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-12 bg-white/5 rounded-lg animate-pulse"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollReveal>

          {/* Panel 2 — Testimonial (kept) */}
          <ScrollReveal delay={0.2}>
            <div className="bg-purple neo-border rounded-xl p-6 neo-shadow text-white">
              <h3 className="font-display font-bold text-lg mb-2">
                {'"My friend group moved here and nobody looked back."'}
              </h3>
              <p className="text-white/70 text-sm mt-4">
                Early Gratonite community feedback
              </p>
              <div className="mt-6 flex gap-2">
                {["Gaming", "Study", "Creators"].map((tag) => (
                  <span
                    key={tag}
                    className="bg-white/20 text-white text-xs font-bold px-2 py-1 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Panel 3 — Built in the open */}
          <ScrollReveal delay={0.3}>
            <div className="bg-white/5 border-3 border-white/20 rounded-xl p-6 hover:border-gold transition-colors">
              <h3 className="font-display font-bold text-lg mb-4">
                Built in the open
              </h3>
              <div className="space-y-4">
                <OpenStatRow label="License" value="AGPL" />
                <OpenStatRow label="Self-hostable" value="Yes" />
                <div className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3 border border-white/10">
                  <span className="font-medium">100% Open source</span>
                  <a
                    href="https://github.com/CoodayeA/Gratonite"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-purple font-bold hover:underline"
                  >
                    GitHub
                  </a>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

function StatRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const numRef = useRef<HTMLSpanElement>(null);
  const numericValue = parseInt(value.replace(/,/g, ''), 10);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = numRef.current;
    if (!el || isNaN(numericValue) || hasAnimated.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { el.textContent = value; return; }

    const obj = { val: 0 };
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () => {
        hasAnimated.current = true;
        gsap.to(obj, {
          val: numericValue,
          duration: 1.2,
          ease: 'power2.out',
          snap: { val: 1 },
          onUpdate: () => { el.textContent = obj.val.toLocaleString(); },
        });
      },
    });
    return () => trigger.kill();
  }, [numericValue, value]);

  return (
    <div className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3 border border-white/10">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${color}`} />
        <span className="font-medium">{label}</span>
      </div>
      <span ref={numRef} className="text-sm font-bold text-white/80">0</span>
    </div>
  );
}

function OpenStatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3 border border-white/10">
      <span className="text-white/60">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
