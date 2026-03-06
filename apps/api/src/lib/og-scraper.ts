import ogs from 'open-graph-scraper';
import { Resolver } from 'dns/promises';

export interface OgEmbed {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

// Block private/loopback/link-local IPs to prevent SSRF
async function isPrivateUrl(url: string): Promise<boolean> {
  try {
    const hostname = new URL(url).hostname;
    // Already an IP address
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^\[?[0-9a-fA-F:]+\]?$/;
    let ip = hostname;
    if (!ipv4Regex.test(hostname) && !ipv6Regex.test(hostname.replace(/^\[|\]$/g, ''))) {
      // Resolve DNS
      const resolver = new Resolver();
      const addresses = await resolver.resolve4(hostname).catch(() => []);
      if (addresses.length === 0) return true; // can't resolve = block
      ip = addresses[0];
    }
    // Check private ranges
    const privateRanges = [
      /^127\./,           // loopback
      /^10\./,            // RFC1918
      /^172\.(1[6-9]|2\d|3[01])\./,  // RFC1918
      /^192\.168\./,      // RFC1918
      /^169\.254\./,      // link-local
      /^::1$/,            // IPv6 loopback
      /^fc00:/i,          // IPv6 private
      /^fe80:/i,          // IPv6 link-local
      /^0\./,             // This network
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,  // CGNAT
    ];
    return privateRanges.some(r => r.test(ip));
  } catch {
    return true; // any error = block
  }
}

export async function scrapeUrl(url: string): Promise<OgEmbed | null> {
  if (await isPrivateUrl(url)) return null;
  try {
    const { result } = await ogs({
      url,
      timeout: 3000,
      fetchOptions: {
        headers: {
          'user-agent': 'Gratonite/1.0 (link preview bot)',
          'accept': 'text/html,application/xhtml+xml',
        },
      },
    });
    if (!result.ogTitle && !result.ogDescription) return null;
    return {
      url,
      title: result.ogTitle,
      description: result.ogDescription ? result.ogDescription.slice(0, 300) : undefined,
      image: Array.isArray(result.ogImage) && result.ogImage.length > 0 ? result.ogImage[0].url : undefined,
      siteName: result.ogSiteName,
    };
  } catch {
    return null;
  }
}

export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"']+/g;
  const matches = text.match(urlRegex) || [];
  // Strip trailing punctuation (periods, commas, etc.)
  return [...new Set(matches.map(u => u.replace(/[.,;:!?)]+$/, '')))].slice(0, 3);
}
