import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { Badge } from "@/components/ui/Badge";
import { mdxComponents } from "@/components/blog/MDXComponents";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Not Found" };

  return {
    title: `${post.title} — Gratonite Blog`,
    description: post.description,
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: {
      "@type": "Person",
      name: post.author,
    },
    publisher: {
      "@type": "Organization",
      name: "Gratonite",
      url: "https://gratonite.chat",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <div className="pt-28 pb-16 px-6 relative overflow-hidden">
        <div className="neo-burst neo-burst-purple top-28 right-[-80px]" />
        <article className="max-w-3xl mx-auto relative z-10">
          {/* Back link */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm font-bold text-foreground/40 hover:text-purple transition-colors mb-8"
        >
          {"<-"} Back to Blog
        </Link>

        {/* Post header */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Badge color="purple">{post.tag}</Badge>
            <Badge color="yellow" rotate>
              Built in public
            </Badge>
            <span className="text-sm text-foreground/40">
              {new Date(post.date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
            {post.title}
          </h1>
          <p className="text-xl text-foreground/50">{post.description}</p>
          <div className="mt-6 pt-6" style={{ borderTop: "3px solid var(--neo-border-color)" }}>
            <p className="text-sm font-bold">By {post.author}</p>
          </div>
        </header>

        {/* MDX content */}
        <div className="prose-neo">
          <MDXRemote source={post.content} components={mdxComponents} />
        </div>
      </article>
    </div>
    </>
  );
}
