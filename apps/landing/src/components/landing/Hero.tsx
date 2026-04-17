"use client";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useGsap, gsap } from "@/hooks/useGsap";

export function Hero() {
  const containerRef = useGsap(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    // Stagger left-side elements: badge → title → subtitle → description → buttons → stats
    tl.fromTo('[data-hero="badge"]',    { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55 })
      .fromTo('[data-hero="title"]',    { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55 }, 0.08)
      .fromTo('[data-hero="subtitle"]', { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55 }, 0.18)
      .fromTo('[data-hero="desc"]',     { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55 }, 0.26)
      .fromTo('[data-hero="buttons"]',  { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55 }, 0.34)
      .fromTo('[data-hero="stats"]',    { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55 }, 0.43);

    // Preview card enters from right with slight rotation
    tl.fromTo('[data-hero="preview"]',
      { x: 20, opacity: 0, rotate: 2 },
      { x: 0, opacity: 1, rotate: 0, duration: 0.6, ease: 'power3.out' },
    0.2);

    // Subtle scroll parallax on burst elements
    gsap.utils.toArray<HTMLElement>('.neo-burst').forEach((el) => {
      gsap.to(el, {
        y: -40,
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1 },
      });
    });
  }, []);

  return (
    <section ref={containerRef} className="min-h-[86vh] flex items-center pt-24 pb-14 px-6 relative overflow-hidden">
      <div className="neo-burst neo-burst-purple top-24 left-[-90px] neo-float" />
      <div className="neo-burst neo-burst-blue bottom-10 right-[-85px] neo-float" />

      <div className="max-w-7xl mx-auto w-full relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — Copy */}
          <div>
            <div data-hero="badge" style={{ opacity: 0 }}>
              <Badge color="gold" rotate className="mb-6">
                Friend-first software.
              </Badge>
            </div>

            <h1
              data-hero="title"
              className="font-display text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-extrabold leading-[0.95] tracking-tight mb-6"
              style={{ opacity: 0 }}
            >
              BUILT BY
              <br />
              <span className="text-purple" style={{ textShadow: "0 0 40px rgba(124, 58, 237, 0.3)" }}>
                FRIENDS,
              </span>
              <br />
              FOR FRIENDS.
            </h1>

            <div data-hero="subtitle" className="mb-5" style={{ opacity: 0 }}>
              <p className="text-sm font-bold uppercase tracking-wider text-foreground/50">
                Open source &middot; No ads &middot; No phone-number gate
              </p>
            </div>

            <p
              data-hero="desc"
              className="text-lg sm:text-xl text-foreground/60 max-w-lg mb-8 leading-relaxed"
              style={{ opacity: 0 }}
            >
              Gratonite is where your group can chat, hop in voice, study, game,
              trade goofy cosmetics, and just be online together without being
              nudged, farmed, or boxed in.
            </p>

            <div data-hero="buttons" className="flex flex-wrap gap-4 mb-12" style={{ opacity: 0 }}>
              <Button variant="primary" size="lg" href="/download">
                Get Gratonite
              </Button>
              <Button variant="outline" size="lg" href="/app">
                Open in Browser
              </Button>
              <a
                href="/deploy"
                className="inline-flex items-center gap-2 text-sm font-bold text-foreground/50 hover:text-purple transition-colors underline underline-offset-4 decoration-foreground/20 hover:decoration-purple self-center"
              >
                Self-Host It
              </a>
            </div>

            {/* Stats strip */}
            <div
              data-hero="stats"
              className="flex flex-wrap gap-8 pt-8"
              style={{
                opacity: 0,
                borderTop: "3px solid var(--neo-border-color)",
              }}
            >
              {[
                { label: "Platforms", value: "4" },
                { label: "Deploy", value: "5 min" },
                { label: "License", value: "AGPL" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-xs font-bold uppercase tracking-wider text-foreground/40">
                    {stat.label}
                  </p>
                  <p className="font-display font-bold text-lg">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Neobrutalist app preview */}
          <div data-hero="preview" className="relative" style={{ opacity: 0 }}>
            {/* App window mock */}
            <div className="neo-border rounded-xl overflow-hidden neo-shadow-lg bg-surface">
              {/* Title bar */}
              <div className="bg-charcoal px-4 py-3 flex items-center gap-2 border-b-3 border-black">
                <div className="w-3 h-3 rounded-full bg-red-400 border border-black" />
                <div className="w-3 h-3 rounded-full bg-yellow border border-black" />
                <div className="w-3 h-3 rounded-full bg-green-400 border border-black" />
                <span className="ml-3 text-white/60 text-sm font-medium">
                  Gratonite / Gratonite Lounge
                </span>
              </div>

              {/* Content area */}
              <div className="p-6 space-y-4">
                {/* Channel list */}
                <div className="flex gap-3">
                  <div className="bg-purple/10 neo-border-2 rounded-lg px-3 py-2 text-sm font-bold text-purple">
                    # general
                  </div>
                  <div className="bg-gold/10 neo-border-2 rounded-lg px-3 py-2 text-sm font-bold text-gold">
                    # design
                  </div>
                  <div className="bg-blue-light/10 neo-border-2 rounded-lg px-3 py-2 text-sm font-bold text-blue-light">
                    # voice
                  </div>
                </div>

                {/* Messages */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple neo-border-2 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
                      AK
                    </div>
                    <div>
                      <p className="text-sm font-bold">
                        Alice K.{" "}
                        <span className="font-normal text-foreground/40">
                          2m ago
                        </span>
                      </p>
                      <p className="text-sm text-foreground/70">
                        Just shipped the new dashboard. Check it out!
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gold neo-border-2 flex-shrink-0 flex items-center justify-center text-black text-xs font-bold">
                      MR
                    </div>
                    <div>
                      <p className="text-sm font-bold">
                        Marcus R.{" "}
                        <span className="font-normal text-foreground/40">
                          just now
                        </span>
                      </p>
                      <p className="text-sm text-foreground/70">
                        Looks incredible. The spatial audio in voice is wild.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Voice indicator */}
                <div className="bg-purple/5 neo-border-2 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-bold">
                      Voice · 3 connected
                    </span>
                  </div>
                  <span className="text-xs font-bold text-purple">
                    Spatial Audio ON
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
