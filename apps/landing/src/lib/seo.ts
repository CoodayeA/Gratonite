import type { Metadata } from "next";

export const SITE_URL = "https://gratonite.chat";
export const SITE_NAME = "Gratonite";
export const SITE_BRAND = "Gratonite Chat";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/Gratonite_logo.png`;

export const DEFAULT_DESCRIPTION =
  "Gratonite is a free, open-source community platform for friends, gaming communities, guilds, and study groups. Real-time chat, spatial voice, collectibles, cosmetics, and an auction house with no ads or tracking.";

type PageMetadataOptions = {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  noIndex?: boolean;
  type?: "website" | "article";
};

export function absoluteUrl(path = "/") {
  return new URL(path, SITE_URL).toString();
}

export function createPageMetadata({
  title,
  description,
  path = "/",
  keywords = [],
  noIndex = false,
  type = "website",
}: PageMetadataOptions): Metadata {
  const url = absoluteUrl(path);
  const robots = noIndex
    ? { index: false, follow: true }
    : {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large" as const,
          "max-snippet": -1,
          "max-video-preview": -1,
        },
      };

  return {
    title: {
      absolute: title,
    },
    description,
    keywords,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      type,
      url,
      siteName: SITE_NAME,
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: 512,
          height: 512,
          alt: "Gratonite logo",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
    robots,
  };
}

export function articleKeywords(postTitle: string, slug: string) {
  return [
    "Gratonite",
    "Gratonite Chat",
    "open source community platform",
    "open source chat app",
    "privacy-first chat app",
    "spatial voice chat",
    postTitle,
    slug.replace(/-/g, " "),
  ];
}
