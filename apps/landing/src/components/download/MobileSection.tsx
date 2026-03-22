import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { AppleIcon, AndroidIcon } from "./icons";

export function MobileSection() {
  return (
    <section id="mobile" className="py-16">
      <ScrollReveal>
        <p className="neo-sticker inline-block mb-4 border-pink-400 text-pink-500 bg-pink-50 dark:bg-pink-500/10">
          Gratonite Mobile
        </p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-2">
          Take it with you
        </h2>
        <p className="text-foreground/60 text-base mb-10 max-w-lg">
          Chat on the go with native mobile apps.
        </p>
      </ScrollReveal>

      <div className="grid sm:grid-cols-2 gap-6 max-w-2xl">
        {/* iOS */}
        <ScrollReveal>
          <Card accent="purple" className="h-full flex flex-col">
            <div className="w-12 h-12 rounded-xl bg-pink-100 dark:bg-pink-500/10 flex items-center justify-center mb-4">
              <AppleIcon size={24} className="text-pink-500" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-display text-xl font-bold">iOS</h3>
              <Badge color="purple" className="text-xs !px-2 !py-0.5">
                BETA
              </Badge>
            </div>
            <p className="text-foreground/50 text-sm mb-5 flex-1">
              For iPhone and iPad. Requires iOS 16 or later.
            </p>
            <Button variant="primary" size="sm" href="https://testflight.apple.com/join/gratonite" className="w-full">
              Join TestFlight Beta
            </Button>
          </Card>
        </ScrollReveal>

        {/* Android */}
        <ScrollReveal delay={0.08}>
          <Card className="h-full flex flex-col opacity-60">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-500/10 flex items-center justify-center mb-4">
              <AndroidIcon size={24} className="text-gray-400" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-display text-xl font-bold">Android</h3>
              <span className="text-xs font-bold text-foreground/40 uppercase tracking-wider">
                Coming Soon
              </span>
            </div>
            <p className="text-foreground/50 text-sm mb-5 flex-1">
              In the meantime, use the web app at{" "}
              <a
                href="https://gratonite.chat/app"
                className="text-purple font-bold hover:underline"
              >
                gratonite.chat/app
              </a>{" "}
              on any browser.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled
              className="w-full"
            >
              Notify Me
            </Button>
            <p className="text-foreground/40 text-xs mt-3 leading-snug">
              Android is in active development. We will announce availability on
              our blog and Discord.
            </p>
          </Card>
        </ScrollReveal>
      </div>
    </section>
  );
}
