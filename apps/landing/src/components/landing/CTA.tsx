import { Button } from "@/components/ui/Button";
import { ScrollReveal } from "@/components/effects/ScrollReveal";

export function CTA() {
  return (
    <section className="section-pad px-6 relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="bg-gradient-to-br from-purple to-[#5B21B6] text-white neo-border rounded-2xl p-12 md:p-20 text-center relative overflow-hidden neo-shadow-lg">
            {/* Subtle radial glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(167,139,250,0.2)_0%,transparent_70%)] pointer-events-none" />

            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4 relative z-10">
              Your space. Your rules.
            </h2>
            <p className="text-lg text-white/60 max-w-lg mx-auto mb-8 relative z-10">
              Bring your community home. Chat, voice, cosmetics, collectibles,
              auction house, and a place that actually feels human.
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
        </ScrollReveal>
      </div>
    </section>
  );
}
