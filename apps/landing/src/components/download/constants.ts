export const VERSION = "1.0.4";
export const BASE_URL = "https://gratonite.chat/downloads";

export type Platform = "macos" | "windows" | "linux";

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
