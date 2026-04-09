"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { Button } from "@/components/ui/Button";
import { AppleIcon, WindowsIcon, TuxIcon } from "./icons";
import {
  FALLBACK_DESKTOP_RELEASE,
  detectOS,
  fetchDesktopReleaseLinks,
  type DesktopReleaseLinks,
  type Platform,
} from "./constants";

interface DesktopPlatform {
  id: string;
  matchOS: Platform;
  name: string;
  detail: string;
  downloadUrl: string;
  debUrl?: string;
  Icon: typeof AppleIcon;
  accent: "purple" | "gold" | "yellow" | "blue" | "none";
  smartscreen?: boolean;
}

export function DesktopSection() {
  const [detectedOS, setDetectedOS] = useState<Platform | null>(null);
  const [release, setRelease] = useState<DesktopReleaseLinks>(FALLBACK_DESKTOP_RELEASE);

  useEffect(() => {
    setDetectedOS(detectOS());
    let cancelled = false;
    fetchDesktopReleaseLinks().then((data) => {
      if (!cancelled) setRelease(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const platforms: DesktopPlatform[] = [
    {
      id: "macos",
      matchOS: "macos",
      name: "macOS",
      detail: "Universal (Intel + Apple Silicon) · macOS 12+",
      downloadUrl: release.macDmg,
      Icon: AppleIcon,
      accent: "purple",
    },
    {
      id: "windows",
      matchOS: "windows",
      name: "Windows",
      detail: "64-bit · Windows 10+",
      downloadUrl: release.windowsExe,
      Icon: WindowsIcon,
      accent: "blue",
      smartscreen: true,
    },
    {
      id: "linux-x64",
      matchOS: "linux",
      name: "Linux (x64)",
      detail: "x64 · AppImage",
      downloadUrl: release.linuxAppImage,
      debUrl: release.linuxDeb,
      Icon: TuxIcon,
      accent: "gold",
    },
    {
      id: "linux-arm64",
      matchOS: "linux",
      name: "Linux (ARM64)",
      detail: "ARM64 · AppImage",
      downloadUrl: release.linuxArm64AppImage,
      debUrl: release.linuxArm64Deb,
      Icon: TuxIcon,
      accent: "gold",
    },
  ];

  return (
    <section id="desktop" className="py-16">
      <ScrollReveal>
        <p className="neo-sticker neo-sticker-purple inline-block mb-4">
          Gratonite Desktop
        </p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-2">
          Desktop apps · v{release.version}
        </h2>
        <p className="text-foreground/60 text-base mb-10 max-w-lg">
          Native apps for every major platform. Pick yours and start chatting in
          seconds.
        </p>
      </ScrollReveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {platforms.map((p, i) => {
          const isDetected = detectedOS === p.matchOS;
          return (
            <ScrollReveal key={p.id} delay={i * 0.08}>
              <Card
                accent={isDetected ? p.accent : "none"}
                className="h-full flex flex-col"
              >
                <div className="w-12 h-12 rounded-xl neo-border-2 flex items-center justify-center mb-4">
                  <p.Icon size={24} />
                </div>
                <h3 className="font-display text-xl font-bold mb-1">
                  {p.name}
                </h3>
                <p className="text-foreground/50 text-sm mb-5 flex-1">
                  {p.detail}
                </p>
                <Button
                  variant={isDetected ? "primary" : "outline"}
                  size="sm"
                  href={p.downloadUrl}
                  className="w-full"
                >
                  Download
                </Button>
                {p.smartscreen && (
                  <p className="text-foreground/40 text-xs mt-3 leading-snug">
                    Windows may show a SmartScreen warning because we are a new
                    app. Click &ldquo;More info&rdquo; then &ldquo;Run
                    anyway&rdquo; to continue.
                  </p>
                )}
                {p.debUrl && (
                  <a
                    href={p.debUrl}
                    className="text-purple text-xs font-bold hover:underline mt-3 inline-block"
                  >
                    or download .deb
                  </a>
                )}
              </Card>
            </ScrollReveal>
          );
        })}
      </div>
    </section>
  );
}
