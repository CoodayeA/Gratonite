import ogs from 'open-graph-scraper';

export interface OgEmbed {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

export async function scrapeUrl(url: string): Promise<OgEmbed | null> {
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
  return [...new Set(matches)].slice(0, 3);
}
