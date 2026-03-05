import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export function Hero() {
  return (
    <section className="min-h-[86vh] flex items-center pt-24 pb-14 px-6 relative overflow-hidden">
      <div className="neo-burst neo-burst-purple top-24 left-[-90px] neo-float" />
      <div className="neo-burst neo-burst-gold top-12 right-[8%] neo-wobble" />
      <div className="neo-burst neo-burst-blue bottom-10 right-[-85px] neo-float" />

      <div className="max-w-7xl mx-auto w-full relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — Copy */}
          <div>
            <div className="hero-enter" style={{ animationDelay: "0.02s" }}>
              <Badge color="gold" rotate className="mb-6">
                Built by friends, for friends.
              </Badge>
            </div>

            <h1
              className="hero-enter font-display text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold leading-[0.95] tracking-tight mb-6"
              style={{ animationDelay: "0.1s" }}
            >
              BUILT BY FRIENDS.
              <br />
              <span className="text-purple">FOR FRIENDS.</span>
            </h1>

            <div
              className="hero-enter mb-5 flex flex-wrap gap-2"
              style={{ animationDelay: "0.2s" }}
            >
              <span className="neo-sticker neo-sticker-purple tilt-1">Friend-first</span>
              <span className="neo-sticker neo-sticker-gold tilt-2">Player-made style</span>
              <span className="neo-sticker neo-sticker-blue tilt-3">Open source</span>
            </div>

            <p
              className="hero-enter inline-block mb-5 bg-yellow text-black neo-border-2 rounded-lg px-4 py-2 font-display font-bold text-sm tilt-1"
              style={{ animationDelay: "0.24s" }}
            >
              {"No \"show your ID\" side quest just to talk to your friends."}
            </p>

            <p
              className="hero-enter text-lg sm:text-xl text-foreground/60 max-w-lg mb-8 leading-relaxed"
              style={{ animationDelay: "0.28s" }}
            >
              Gratonite was built for a better place to hang out with friends.
              Chat, hop in voice, play games, study together, collect cool
              cosmetics, and just exist online without being farmed for
              engagement.
            </p>

            <div
              className="hero-enter flex flex-wrap gap-4 mb-12"
              style={{ animationDelay: "0.36s" }}
            >
              <Button variant="primary" size="lg" href="/download">
                Get Gratonite
              </Button>
              <Button variant="outline" size="lg" href="/discover">
                Explore Communities
              </Button>
            </div>

            {/* Stats strip */}
            <div
              className="hero-enter flex flex-wrap gap-8 pt-8"
              style={{
                animationDelay: "0.45s",
                borderTop: "3px solid var(--neo-border-color)",
              }}
            >
              {[
                { label: "Price", value: "100% Free" },
                { label: "Code", value: "Open Source" },
                { label: "Promise", value: "No Tracking" },
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
          <div className="hero-enter hero-enter-right relative" style={{ animationDelay: "0.22s" }}>
            {/* Decorative sticker */}
            <div className="absolute -top-4 -right-4 z-10">
              <Badge color="yellow" rotate>
                NEW
              </Badge>
            </div>
            <div className="absolute -bottom-6 -left-2 z-10 neo-sticker neo-sticker-gold tilt-2">
              FREE FOREVER
            </div>

            {/* App window mock */}
            <div className="neo-border rounded-xl overflow-hidden neo-shadow-lg bg-surface tilt-3">
              {/* Title bar */}
              <div className="bg-charcoal px-4 py-3 flex items-center gap-2 border-b-3 border-black">
                <div className="w-3 h-3 rounded-full bg-red-400 border border-black" />
                <div className="w-3 h-3 rounded-full bg-yellow border border-black" />
                <div className="w-3 h-3 rounded-full bg-green-400 border border-black" />
                <span className="ml-3 text-white/60 text-sm font-medium">
                  Gratonite — Arclight Guild
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
                      Voice — 3 connected
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
