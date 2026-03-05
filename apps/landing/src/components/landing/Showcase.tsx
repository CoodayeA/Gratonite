import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { Badge } from "@/components/ui/Badge";

export function Showcase() {
  return (
    <section className="py-16 lg:py-20 px-6 bg-charcoal text-white relative overflow-hidden">
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

        {/* Showcase grid — neobrutalist panels */}
        <div className="grid md:grid-cols-3 gap-6">
          <ScrollReveal delay={0.1}>
            <div className="bg-white/5 border-3 border-white/20 rounded-xl p-6 hover:border-purple transition-colors rotate-[-1deg]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-lg">Live Rooms</h3>
                <span className="text-sm text-white/40">3 active</span>
              </div>
              <div className="space-y-3">
                {[
                  {
                    name: "Arclight",
                    count: "142 online",
                    color: "bg-purple",
                  },
                  {
                    name: "Flux Studio",
                    count: "Voice Live",
                    color: "bg-gold",
                  },
                  {
                    name: "Nightshift",
                    count: "2 events",
                    color: "bg-blue-light",
                  },
                ].map((room) => (
                  <div
                    key={room.name}
                    className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3 border border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${room.color}`}
                      />
                      <span className="font-medium">{room.name}</span>
                    </div>
                    <span className="text-sm text-white/40">{room.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <div className="bg-purple neo-border rounded-xl p-6 neo-shadow text-white md:translate-y-[-20px] rotate-[1.2deg]">
              <h3 className="font-display font-bold text-lg mb-2">
                {'"This feels like hanging out again, not posting into a void."'}
              </h3>
              <p className="text-white/70 text-sm mt-4">
                — early Gratonite community feedback
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

          <ScrollReveal delay={0.3}>
            <div className="bg-white/5 border-3 border-white/20 rounded-xl p-6 hover:border-gold transition-colors rotate-[-0.8deg]">
              <h3 className="font-display font-bold text-lg mb-4">
                Community Pulse
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white/60">Cosmetics owned</span>
                    <span className="font-bold">41K</span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden border border-white/20">
                    <div className="h-full bg-gold rounded-full w-[78%]" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white/60">Auction house trades</span>
                    <span className="font-bold">9.8K</span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden border border-white/20">
                    <div className="h-full bg-purple rounded-full w-[62%]" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white/60">Live voice hours</span>
                    <span className="font-bold">48K</span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden border border-white/20">
                    <div className="h-full bg-blue-light rounded-full w-[45%]" />
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
