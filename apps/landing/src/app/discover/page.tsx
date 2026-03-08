import { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Discover Communities on Gratonite",
  description:
    "Community discovery on Gratonite is still in development. Jump into Gratonite Chat and start your own friend-first community today.",
  path: "/discover/",
  noIndex: true,
});

export default function DiscoverPage() {
  return (
    <div className="pt-28 pb-16 px-6 relative min-h-[70vh] flex items-center">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="neo-burst neo-burst-blue top-28 left-[-80px]" />
        <div className="neo-burst neo-burst-gold bottom-8 right-[-70px]" />
      </div>

      <div className="max-w-2xl mx-auto relative z-10 text-center">
        <Badge color="blue" rotate className="mb-4">
          Coming soon
        </Badge>
        <h1 className="font-display text-5xl sm:text-6xl font-bold tracking-tight mb-4">
          Discover is
          <br />
          <span className="bg-gold text-black px-3 -mx-1 inline-block tilt-2">
            on the way.
          </span>
        </h1>
        <p className="text-lg text-foreground/60 max-w-lg mx-auto mb-8">
          {"We're building community discovery the right way. In the meantime, jump into the app and start your own community."}
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button variant="primary" size="lg" href="/download">
            Get Gratonite
          </Button>
          <Button variant="outline" size="lg" href="/app">
            Open in Browser
          </Button>
        </div>
      </div>
    </div>
  );
}
