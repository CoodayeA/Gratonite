import { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ScrollReveal } from "@/components/effects/ScrollReveal";

export const metadata: Metadata = {
  title: "Download — Gratonite",
  description:
    "Download Gratonite for desktop or jump in on web. Native iOS and Android builds are on the way.",
};

const platforms = [
  {
    icon: "🍎",
    name: "Apple",
    description: "macOS desktop app for Apple Silicon (M1 and later).",
    format: ".dmg",
    accent: "purple" as const,
    href: "https://gratonite.chat/downloads/Gratonite-1.0.1-arm64.dmg",
  },
  {
    icon: "⊞",
    name: "Windows (x64)",
    description: "Windows installer — NSIS setup, installs like any app.",
    format: ".exe",
    accent: "blue" as const,
    href: "https://gratonite.chat/downloads/Gratonite%20Setup%201.0.1.exe",
  },
  {
    icon: "🐧",
    name: "Linux",
    description: "Pick your Linux build: AppImage, DEB, or RPM.",
    format: "soon",
    accent: "gold" as const,
    variants: ["AppImage", "DEB", "RPM"],
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

        {/* Build channels */}
        <ScrollReveal>
          <div className="flex gap-3 mb-10">
            {["Stable", "Canary", "Legacy"].map((channel, i) => (
              <button
                key={channel}
                className={`px-4 py-2 font-display font-bold text-sm rounded-lg neo-border-2 transition-all ${
                  i === 0
                    ? "bg-charcoal text-white neo-shadow-sm"
                    : "bg-surface text-foreground hover:bg-gray-warm/30"
                }`}
              >
                {channel}
              </button>
            ))}
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
                {platform.variants && (
                  <label className="mb-4 block">
                    <span className="text-xs font-bold text-foreground/45 uppercase tracking-wider">
                      Build Type
                    </span>
                    <select
                      className="mt-2 w-full neo-border-2 rounded-lg bg-surface px-3 py-2 text-sm font-medium"
                      defaultValue={platform.variants[0]}
                    >
                      {platform.variants.map((variant) => (
                        <option key={variant} value={variant}>
                          {variant}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
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
              <a href="#" className="text-purple font-bold hover:underline">
                Read the release notes
              </a>
            </p>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
