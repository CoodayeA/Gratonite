import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

const STATIC_ROUTES = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const },
  { path: "/about/", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/blog/", priority: 0.85, changeFrequency: "weekly" as const },
  { path: "/download/", priority: 0.95, changeFrequency: "weekly" as const },
  { path: "/pricing/", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/safety/", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/support/", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/why-gratonite/", priority: 0.9, changeFrequency: "weekly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const postEntries: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}/`),
    lastModified: post.date ? new Date(post.date) : new Date(),
    changeFrequency: "monthly",
    priority: 0.75,
  }));

  return [...staticEntries, ...postEntries];
}
