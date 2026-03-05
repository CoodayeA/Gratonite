import { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { DiscoverContent } from "@/components/discover/DiscoverContent";

export const metadata: Metadata = {
  title: "Discover — Gratonite",
  description: "Find new stuff. Meet new people. Make Gratonite yours.",
};

export default function DiscoverPage() {
  return (
    <div className="pt-28 pb-16 px-6 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="neo-burst neo-burst-blue top-28 left-[-80px]" />
        <div className="neo-burst neo-burst-gold bottom-8 right-[-70px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <ScrollReveal>
          <div className="mb-12">
            <Badge color="blue" rotate className="mb-4">
              Find your people
            </Badge>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-4">
              Discover
              <br />
              <span className="bg-gold text-black px-3 -mx-1 inline-block tilt-2">
                {"what's next."}
              </span>
            </h1>
            <p className="text-lg text-foreground/60 max-w-lg">
              Find people you click with, discover new communities, and collect
              styles and items that make your profile feel like you.
            </p>
          </div>
        </ScrollReveal>

        <DiscoverContent />
      </div>
    </div>
  );
}
