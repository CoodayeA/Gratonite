import { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { PlatformHero } from "@/components/download/PlatformHero";
import { DesktopSection } from "@/components/download/DesktopSection";
import { MobileSection } from "@/components/download/MobileSection";
import { ServerSection } from "@/components/download/ServerSection";

export const metadata: Metadata = createPageMetadata({
  title: "Download Gratonite | Desktop, Mobile, and Server",
  description:
    "Download Gratonite for macOS, Windows, Linux, iOS, or Android. Or host your own instance with one click. Free, open source, no ads.",
  path: "/download/",
  keywords: [
    "Gratonite download",
    "chat app download",
    "open source community platform download",
    "self-host chat",
    "open source chat app",
    "macOS chat app",
    "Windows chat app",
    "Linux chat app",
    "iOS chat app",
  ],
});

export default function DownloadPage() {
  return (
    <div className="pt-28 pb-16 px-6 relative overflow-hidden">
      <div className="neo-burst neo-burst-gold top-10 right-[-90px]" />
      <div className="neo-burst neo-burst-purple bottom-4 left-[-100px]" />

      <div className="max-w-7xl mx-auto relative z-10">
        <PlatformHero />
        <DesktopSection />
        <MobileSection />
        <ServerSection />

        <ScrollReveal>
          <div className="text-center mt-12 pt-8 border-t border-foreground/10">
            <p className="text-foreground/40 text-sm">
              See what is new in each version on the{" "}
              <a
                href="/releases/"
                className="text-purple font-semibold hover:underline"
              >
                release notes
              </a>{" "}
              page.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
