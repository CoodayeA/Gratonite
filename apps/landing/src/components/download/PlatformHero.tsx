"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppleIcon, WindowsIcon, TuxIcon } from "./icons";
import {
  FALLBACK_DESKTOP_RELEASE,
  detectOS,
  fetchDesktopReleaseLinks,
  type DesktopReleaseLinks,
  type Platform,
} from "./constants";

const otherPlatforms: Record<Platform, Platform[]> = {
  macos: ["windows", "linux"],
  windows: ["macos", "linux"],
  linux: ["macos", "windows"],
};

export function PlatformHero() {
  const [os] = useState<Platform | null>(() => {
    if (typeof navigator === "undefined") return null;
    return detectOS();
  });
  const [release, setRelease] = useState<DesktopReleaseLinks>(FALLBACK_DESKTOP_RELEASE);

  useEffect(() => {
    let cancelled = false;
    fetchDesktopReleaseLinks().then((data) => {
      if (!cancelled) setRelease(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const platformConfig: Record<
    Platform,
    {
      name: string;
      detail: string;
      downloadUrl: string;
      Icon: typeof AppleIcon;
    }
  > = {
    macos: {
      name: "Mac",
      detail: `v${release.version} · macOS 12+ · Universal`,
      downloadUrl: release.macDmg,
      Icon: AppleIcon,
    },
    windows: {
      name: "Windows",
      detail: `v${release.version} · Windows 10+ · 64-bit`,
      downloadUrl: release.windowsExe,
      Icon: WindowsIcon,
    },
    linux: {
      name: "Linux",
      detail: `v${release.version} · x64 · AppImage`,
      downloadUrl: release.linuxAppImage,
      Icon: TuxIcon,
    },
  };

  // SSR / undetected fallback
  if (os === null) {
    return (
      <section className="text-center py-16">
        <Badge color="gold" rotate className="mb-6">
          Free &amp; Open Source
        </Badge>
        <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-4">
          Download{" "}
          <span className="bg-purple text-white px-3 -mx-1 inline-block tilt-3">
            Gratonite.
          </span>
        </h1>
        <p className="text-lg text-foreground/60 max-w-lg mx-auto mb-8">
          Grab the build for your platform, or jump in from the browser.
        </p>
        <a
          href="#desktop"
          className="text-purple font-bold hover:underline text-base"
        >
          Choose your platform below &darr;
        </a>
      </section>
    );
  }

  const { name, detail, downloadUrl, Icon } = platformConfig[os];
  const others = otherPlatforms[os];

  return (
    <section className="text-center py-16">
      <Badge color="gold" rotate className="mb-6">
        Free &amp; Open Source
      </Badge>
      <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-4">
        Gratonite for{" "}
        <span className="bg-purple text-white px-3 -mx-1 inline-block tilt-3">
          {name}.
        </span>
      </h1>
      <p className="text-foreground/50 text-sm mb-8">{detail}</p>
      <Button variant="primary" size="lg" href={downloadUrl} className="mb-6">
        <Icon size={20} />
        Download for {name}
      </Button>
      <p className="text-foreground/50 text-sm">
        Not on {name}?{" "}
        {others.map((p, i) => (
          <span key={p}>
            <a href="#desktop" className="text-purple font-bold hover:underline">
              {platformConfig[p].name}
            </a>
            {i < others.length - 1 ? " or " : ""}
          </span>
        ))}
      </p>
    </section>
  );
}
