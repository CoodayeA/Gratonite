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
          <Card accent="gold" className="h-full flex flex-col">
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-500/10 flex items-center justify-center mb-4">
              <AndroidIcon size={24} className="text-green-500" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-display text-xl font-bold">Android</h3>
              <Badge color="gold" className="text-xs !px-2 !py-0.5">
                BETA
              </Badge>
            </div>
            <p className="text-foreground/50 text-sm mb-4 flex-1">
              Sideload the APK on any Android device running Android 8 or later.
              No Play Store required.
            </p>
            <Button
              variant="primary"
              size="sm"
              href="https://expo.dev/artifacts/eas/p97vU3SSEvGtQQDU5w1wC8.apk"
              className="w-full mb-4"
            >
              Download APK (v1.0.1)
            </Button>
            {/* Sideloading instructions */}
            <div className="border border-foreground/10 rounded-xl p-3 bg-foreground/[0.03]">
              <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-2">
                How to install
              </p>
              <ol className="space-y-1.5">
                <li className="text-xs text-foreground/55 flex gap-2">
                  <span className="text-gold font-bold shrink-0">1.</span>
                  Download the APK above to your Android device.
                </li>
                <li className="text-xs text-foreground/55 flex gap-2">
                  <span className="text-gold font-bold shrink-0">2.</span>
                  Go to <strong>Settings → Security</strong> and enable{" "}
                  <em>Install unknown apps</em> for your browser or file manager.
                </li>
                <li className="text-xs text-foreground/55 flex gap-2">
                  <span className="text-gold font-bold shrink-0">3.</span>
                  Open the downloaded file and tap <strong>Install</strong>.
                </li>
                <li className="text-xs text-foreground/55 flex gap-2">
                  <span className="text-gold font-bold shrink-0">4.</span>
                  Launch Gratonite and sign in. That&apos;s it.
                </li>
              </ol>
            </div>
          </Card>
        </ScrollReveal>
      </div>
    </section>
  );
}
