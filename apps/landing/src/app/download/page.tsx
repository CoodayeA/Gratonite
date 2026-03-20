import { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Download Gratonite | Free Discord Alternative for Desktop",
  description:
    "Download Gratonite Chat for macOS and Windows. A privacy-first, open-source Discord alternative with real-time chat, voice, and community features.",
  path: "/download/",
  keywords: [
    "download Gratonite",
    "Gratonite app download",
    "Gratonite Chat download",
    "Discord alternative download",
    "open source chat app download",
  ],
});

const platforms = [
  {
    icon: "🍎",
    name: "Apple",
    description: "macOS desktop app for Apple Silicon (M1 and later).",
    format: ".dmg",
    accent: "purple" as const,
    href: "https://gratonite.chat/downloads/Gratonite-1.0.4-arm64.dmg",
  },
  {
    icon: "⊞",
    name: "Windows (x64)",
    description: "Windows installer. NSIS setup, installs like any app.",
    format: ".exe",
    accent: "blue" as const,
    href: "https://gratonite.chat/downloads/Gratonite%20Setup%201.0.4.exe",
  },
  {
    icon: "🐧",
    name: "Linux (x64)",
    description: "AppImage for most Linux distros. Also available as .deb.",
    format: ".AppImage",
    accent: "gold" as const,
    href: "https://gratonite.chat/downloads/Gratonite-1.0.4.AppImage",
  },
  {
    icon: "🐧",
    name: "Linux (ARM64)",
    description: "AppImage for ARM64 Linux. Also available as .deb.",
    format: ".AppImage",
    accent: "gold" as const,
    href: "https://gratonite.chat/downloads/Gratonite-1.0.4-arm64.AppImage",
  },
  {
    icon: "📱",
    name: "iOS",
    description: "Native iPhone and iPad app. In active rollout.",
    format: "soon",
    accent: "blue" as const,
  },
  {
    icon: "🤖",
    name: "Android",
    description: "Native Android build for phones and tablets. In active rollout.",
    format: "soon",
    accent: "gold" as const,
  },
];

export default function DownloadPage() {
  return (
    <div className="pt-28 pb-16 px-6 relative overflow-hidden">
      <div className="neo-burst neo-burst-gold top-10 right-[-90px]" />
      <div className="neo-burst neo-burst-purple bottom-4 left-[-100px]" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <ScrollReveal>
          <div className="mb-16">
            <Badge color="gold" rotate className="mb-4">
              Pick your build
            </Badge>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-4">
              Get
              <br />
              <span className="bg-purple text-white px-3 -mx-1 inline-block tilt-3">
                Gratonite.
              </span>
            </h1>
            <p className="text-lg text-foreground/60 max-w-lg">
              Grab the build for your platform, or jump in from the browser.
              iOS and Android are in active development and coming soon.
            </p>
          </div>
        </ScrollReveal>

        {/* Build channel */}
        <ScrollReveal>
          <div className="flex gap-3 mb-6">
            <span className="px-4 py-2 font-display font-bold text-sm rounded-lg neo-border-2 bg-charcoal text-white neo-shadow-sm">
              Stable
              <span className="ml-2 text-[10px] font-mono font-normal text-white/60">
                v1.0.4
              </span>
            </span>
          </div>
        </ScrollReveal>

        {/* Windows SmartScreen notice */}
        <ScrollReveal>
          <div className="mb-10 neo-border-2 rounded-xl px-5 py-4 bg-surface flex gap-3 items-start max-w-2xl">
            <span className="text-lg mt-0.5">⊞</span>
            <div>
              <p className="text-sm font-bold text-foreground/80 mb-1">Windows users: SmartScreen warning</p>
              <p className="text-sm text-foreground/55">
                Windows may show a &ldquo;Windows protected your PC&rdquo; message when you run the installer. This is normal for new apps without an expensive publisher certificate. Click <strong className="text-foreground/80">More info</strong> then <strong className="text-foreground/80">Run anyway</strong> to continue.
              </p>
            </div>
          </div>
        </ScrollReveal>

        {/* Platform grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {platforms.map((platform, i) => (
            <ScrollReveal key={platform.name} delay={i * 0.08}>
              <Card accent={platform.accent} className="h-full flex flex-col">
                <div className="text-4xl mb-4">{platform.icon}</div>
                <h3 className="font-display text-xl font-bold mb-2">
                  {platform.name}
                </h3>
                <p className="text-foreground/60 text-sm mb-6 flex-1">
                  {platform.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground/40 uppercase tracking-wider">
                    {platform.format}
                  </span>
                  {platform.href ? (
                    <a
                      href={platform.href}
                      download
                      className="neo-sticker neo-sticker-yellow text-[10px] no-underline"
                    >
                      Download
                    </a>
                  ) : (
                    <span className="neo-sticker neo-sticker-yellow text-[10px]">
                      Soon
                    </span>
                  )}
                </div>
              </Card>
            </ScrollReveal>
          ))}
        </div>

        {/* Release notes link */}
        <ScrollReveal>
          <div className="mt-12 text-center">
            <p className="text-foreground/55 text-base font-medium mb-2">
              Want to try it in 10 seconds? Use it in your browser.
            </p>
            <p className="text-foreground/40 text-sm">
              Want to see what changed?{" "}
              <a href="/releases" className="text-purple font-bold hover:underline">
                Read the release notes
              </a>
            </p>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
