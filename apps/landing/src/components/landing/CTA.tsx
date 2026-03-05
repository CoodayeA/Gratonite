import { Button } from "@/components/ui/Button";
import { ScrollReveal } from "@/components/effects/ScrollReveal";

export function CTA() {
  return (
    <section className="py-16 lg:py-20 px-6 relative overflow-hidden">
      <div className="neo-divider mb-16" />
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="bg-yellow neo-border rounded-2xl p-12 md:p-20 text-center relative overflow-hidden neo-shadow-lg">
            {/* Decorative elements */}
            <div className="absolute top-6 left-6 w-16 h-16 neo-border rounded-full bg-purple opacity-80 tilt-1" />
            <div className="absolute bottom-8 right-8 w-12 h-12 neo-border rounded-lg bg-blue-light opacity-80 tilt-2" />
            <div className="absolute top-8 right-8 neo-sticker neo-sticker-purple hidden md:inline-flex">
              FREE FOREVER
            </div>

            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4 relative z-10">
              Built by friends, for friends.
            </h2>
            <p className="text-lg text-black/60 max-w-lg mx-auto mb-8 relative z-10">
              Bring your community home. Chat, voice, cosmetics, collectibles,
              auction house, and a place that actually feels human.
            </p>
            <div className="flex flex-wrap justify-center gap-4 relative z-10">
              <Button variant="primary" size="lg" href="/download">
                Get Gratonite
              </Button>
              <Button variant="outline" size="lg" href="/discover">
                Explore Communities
              </Button>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
