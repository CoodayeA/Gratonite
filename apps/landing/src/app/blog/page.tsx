import { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ScrollReveal } from "@/components/effects/ScrollReveal";

export const metadata: Metadata = {
  title: "Blog — Gratonite",
  description:
    "Notes from building Gratonite in public: product updates, ideas, and honest progress.",
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="pt-28 pb-16 px-6 relative overflow-hidden">
      <div className="neo-burst neo-burst-gold top-24 right-[-70px]" />
      <div className="neo-burst neo-burst-purple bottom-5 left-[-90px]" />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <ScrollReveal>
          <div className="mb-16">
            <Badge color="gold" rotate className="mb-4">
              Building in public
            </Badge>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-4">
              The
              <br />
              <span className="bg-blue-light text-black px-3 -mx-1 inline-block tilt-2">
                blog.
              </span>
            </h1>
            <p className="text-lg text-foreground/60 max-w-lg">
              {"Real updates from a real build process. Wins, mistakes, experiments, and what we're shipping next."}
            </p>
          </div>
        </ScrollReveal>

        {/* Posts list */}
        <div className="space-y-6">
          {posts.length === 0 && (
            <div className="bg-yellow/20 neo-border rounded-xl p-8 text-center">
              <p className="font-display text-xl font-bold mb-2">
                No posts yet.
              </p>
              <p className="text-foreground/60">
                {"We're writing. Check back soon."}
              </p>
            </div>
          )}
          {posts.map((post, i) => (
            <ScrollReveal key={post.slug} delay={i * 0.1}>
              <Link href={`/blog/${post.slug}`} className="block group">
                <Card hover className="transition-all group-hover:border-purple">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <Badge
                          color={
                            i % 3 === 0
                              ? "purple"
                              : i % 3 === 1
                                ? "gold"
                                : "blue"
                          }
                        >
                          {post.tag}
                        </Badge>
                        <span className="text-xs font-bold text-foreground/40">
                          {new Date(post.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <h2 className="font-display text-2xl font-bold mb-2 group-hover:text-purple transition-colors">
                        {post.title}
                      </h2>
                      <p className="text-foreground/60">{post.description}</p>
                      <p className="text-sm text-foreground/40 mt-3">
                        By {post.author}
                      </p>
                    </div>
                    <span className="font-display text-2xl font-bold text-foreground/20 group-hover:text-purple transition-colors mt-2">
                      {"->"}
                    </span>
                  </div>
                </Card>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </div>
  );
}
