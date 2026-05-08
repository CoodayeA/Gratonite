export const BASE_URL = "https://gratonite.chat/downloads";
const FEED_WINDOWS = `${BASE_URL}/latest.yml`;
const FEED_MAC = `${BASE_URL}/latest-mac.yml`;
const FEED_LINUX = `${BASE_URL}/latest-linux.yml`;
const FEED_LINUX_ARM64 = `${BASE_URL}/latest-linux-arm64.yml`;

export type Platform = "macos" | "windows" | "linux";

export interface DesktopReleaseLinks {
  version: string;
  macDmg: string;
  windowsExe: string;
  linuxAppImage: string;
  linuxDeb: string;
  linuxArm64AppImage: string;
  linuxArm64Deb: string;
}

export const FALLBACK_DESKTOP_RELEASE: DesktopReleaseLinks = {
  version: "1.0.12",
  macDmg: `${BASE_URL}/Gratonite-1.0.12-universal.dmg`,
  windowsExe: `${BASE_URL}/Gratonite%20Setup%201.0.12.exe`,
  linuxAppImage: `${BASE_URL}/Gratonite-1.0.12.AppImage`,
  linuxDeb: `${BASE_URL}/gratonite-desktop_1.0.12_amd64.deb`,
  linuxArm64AppImage: `${BASE_URL}/Gratonite-1.0.12-arm64.AppImage`,
  linuxArm64Deb: `${BASE_URL}/gratonite-desktop_1.0.12_arm64.deb`,
};

function cleanYamlValue(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function parseVersion(yaml: string): string {
  const match = yaml.match(/^version:\s*(.+)$/m);
  return match ? cleanYamlValue(match[1]) : FALLBACK_DESKTOP_RELEASE.version;
}

function parseFileUrls(yaml: string): string[] {
  return Array.from(yaml.matchAll(/^\s*-\s+url:\s*(.+)$/gm)).map((match) =>
    cleanYamlValue(match[1]),
  );
}

function pickFile(urls: string[], predicate: (url: string) => boolean): string | null {
  const match = urls.find(predicate);
  return match ? `${BASE_URL}/${match}` : null;
}

export async function fetchDesktopReleaseLinks(): Promise<DesktopReleaseLinks> {
  try {
    const [windowsRes, macRes, linuxRes, linuxArmRes] = await Promise.all([
      fetch(FEED_WINDOWS, { cache: "no-store" }),
      fetch(FEED_MAC, { cache: "no-store" }),
      fetch(FEED_LINUX, { cache: "no-store" }),
      fetch(FEED_LINUX_ARM64, { cache: "no-store" }),
    ]);

    if (!windowsRes.ok || !macRes.ok || !linuxRes.ok || !linuxArmRes.ok) {
      return FALLBACK_DESKTOP_RELEASE;
    }

    const [windowsYaml, macYaml, linuxYaml, linuxArmYaml] = await Promise.all([
      windowsRes.text(),
      macRes.text(),
      linuxRes.text(),
      linuxArmRes.text(),
    ]);

    const version = parseVersion(windowsYaml);
    const windowsFiles = parseFileUrls(windowsYaml);
    const macFiles = parseFileUrls(macYaml);
    const linuxFiles = parseFileUrls(linuxYaml);
    const linuxArmFiles = parseFileUrls(linuxArmYaml);

    return {
      version,
      macDmg:
        pickFile(macFiles, (url) => url.endsWith(".dmg")) ??
        FALLBACK_DESKTOP_RELEASE.macDmg,
      windowsExe:
        pickFile(windowsFiles, (url) => url.endsWith(".exe")) ??
        FALLBACK_DESKTOP_RELEASE.windowsExe,
      linuxAppImage:
        pickFile(linuxFiles, (url) => url.endsWith(".AppImage")) ??
        FALLBACK_DESKTOP_RELEASE.linuxAppImage,
      linuxDeb:
        pickFile(linuxFiles, (url) => url.endsWith(".deb")) ??
        FALLBACK_DESKTOP_RELEASE.linuxDeb,
      linuxArm64AppImage:
        pickFile(linuxArmFiles, (url) => url.endsWith(".AppImage")) ??
        FALLBACK_DESKTOP_RELEASE.linuxArm64AppImage,
      linuxArm64Deb:
        pickFile(linuxArmFiles, (url) => url.endsWith(".deb")) ??
        FALLBACK_DESKTOP_RELEASE.linuxArm64Deb,
    };
  } catch {
    return FALLBACK_DESKTOP_RELEASE;
  }
}

export function detectOS(): Platform | null {
  if (typeof navigator === "undefined") return null;
  const uaPlatform = (navigator as any).userAgentData?.platform?.toLowerCase();
  if (uaPlatform) {
    if (uaPlatform.includes("mac")) return "macos";
    if (uaPlatform.includes("win")) return "windows";
    return "linux";
  }
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("macintosh") || ua.includes("mac os")) return "macos";
  if (ua.includes("windows")) return "windows";
  const platform = navigator.platform?.toLowerCase() || "";
  if (platform.includes("mac")) return "macos";
  if (platform.includes("win")) return "windows";
  return "linux";
}
