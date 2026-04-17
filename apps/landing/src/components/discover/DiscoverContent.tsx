"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ScrollReveal } from "@/components/effects/ScrollReveal";

const communities = [
  {
    name: "Arclight Guild",
    description: "Friends building games and tools together after work.",
    members: "12k",
    online: 142,
    accent: "purple" as const,
    tag: "Design",
  },
  {
    name: "Flux Studio",
    description: "Creative folks sharing renders, edits, and experiments.",
    members: "6k",
    online: 89,
    accent: "gold" as const,
    tag: "Creative",
  },
  {
    name: "Nightshift",
    description: "Late-night hangouts, game nights, and watch parties.",
    members: "9k",
    online: 234,
    accent: "blue" as const,
    tag: "Social",
  },
  {
    name: "Pixel Forge",
    description: "Indie devs shipping small games and helping each other.",
    members: "4.2k",
    online: 67,
    accent: "yellow" as const,
    tag: "Gaming",
  },
  {
    name: "The Greenhouse",
    description: "Builders studying, planning, and launching together.",
    members: "8.1k",
    online: 198,
    accent: "purple" as const,
    tag: "Startups",
  },
  {
    name: "Sound Lab",
    description: "Beat makers, vocalists, and people who just love music.",
    members: "3.5k",
    online: 45,
    accent: "gold" as const,
    tag: "Music",
  },
];

const bots = [
  {
    name: "Relay",
    description: "Cross-community updates so your group never misses a thing.",
    author: "Lysia",
    uses: "3.1k",
  },
  {
    name: "Morningstar",
    description: "Study check-ins, focus timers, and accountability pings.",
    author: "Noor",
    uses: "1.2k",
  },
  {
    name: "Glyph",
    description: "Moderation tools that keep communities safe without being harsh.",
    author: "Riven",
    uses: "9.6k",
  },
];

const themes = [
  {
    name: "Midnight Bloom",
    description: "Community-made skin with soft neon accents.",
    saves: "1.4k",
    colors: ["#1b2740", "#5fd7ff"],
  },
  {
    name: "Solstice",
    description: "Warm sunset palette for long voice nights.",
    saves: "890",
    colors: ["#382015", "#ffcf6a"],
  },
  {
    name: "Glacial",
    description: "Cool clean style for study crews and focused chats.",
    saves: "2.3k",
    colors: ["#0f2f2a", "#9bffdf"],
  },
];

type Tab = "portals" | "bots" | "themes";

const tabs: { key: Tab; label: string }[] = [
  { key: "portals", label: "Communities" },
  { key: "bots", label: "Bots" },
  { key: "themes", label: "Themes Shop" },
];

export function DiscoverContent() {
  const [activeTab, setActiveTab] = useState<Tab>("portals");
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <>
      {/* Category tabs */}
      <ScrollReveal>
        <div className="flex gap-3 mb-10">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 font-display font-bold text-sm rounded-lg neo-border-2 transition-all cursor-pointer ${
                activeTab === tab.key
                  ? "bg-charcoal text-white neo-shadow-sm"
                  : "bg-surface text-foreground hover:bg-gray-warm/30"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </ScrollReveal>

      {/* Communities */}
      {activeTab === "portals" && (
        <section className="mb-20">
          <div className="flex items-end justify-between mb-8 relative z-30">
            <div>
              <h2 className="font-display text-3xl font-bold">Communities</h2>
              <p className="text-foreground/50 mt-1">
                Public communities where people actually talk to each other.
              </p>
            </div>
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilterOpen(!filterOpen)}
              >
                Filter
              </Button>
              {filterOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-surface neo-border rounded-lg p-3 neo-shadow z-50">
                  <p className="text-xs font-bold text-foreground/40 mb-2 uppercase tracking-wider">
                    Category
                  </p>
                  {["All", "Design", "Creative", "Social", "Gaming", "Music", "Startups"].map(
                    (cat) => (
                      <button
                        key={cat}
                        className="block w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-warm/30 transition-colors cursor-pointer"
                        onClick={() => setFilterOpen(false)}
                      >
                        {cat}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-0">
            {communities.map((community, i) => (
              <ScrollReveal key={community.name} delay={i * 0.08}>
                <Card accent={community.accent} className="h-full">
                  <div className="flex items-center justify-between mb-3">
                    <Badge color={community.accent}>{community.tag}</Badge>
                    <Button
                      variant="primary"
                      size="sm"
                      href="/app/login"
                    >
                      Join
                    </Button>
                  </div>
                  <h3 className="font-display text-xl font-bold mb-1">
                    {community.name}
                  </h3>
                  <p className="text-foreground/60 text-sm mb-4">
                    {community.description}
                  </p>
                  <div className="flex items-center gap-3 text-xs font-bold text-foreground/40">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      {community.online} online
                    </span>
                    <span>{community.members} members</span>
                  </div>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </section>
      )}

      {/* Bots */}
      {activeTab === "bots" && (
        <section className="mb-20">
          <ScrollReveal>
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="font-display text-3xl font-bold">Bots</h2>
                <p className="text-foreground/50 mt-1">
                  Community-made tools that make group life smoother.
                </p>
              </div>
            </div>
          </ScrollReveal>

          <div className="space-y-4">
            {bots.map((bot, i) => (
              <ScrollReveal key={bot.name} delay={i * 0.08}>
                <div className="bg-surface neo-border rounded-xl p-5 flex items-center justify-between neo-shadow-sm neo-shadow-hover">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-charcoal neo-border-2 flex items-center justify-center text-white font-display font-bold">
                      {bot.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-display font-bold">{bot.name}</h3>
                      <p className="text-foreground/60 text-sm">
                        {bot.description}
                      </p>
                      <p className="text-foreground/30 text-xs mt-1">
                        By {bot.author} - {bot.uses} uses
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" href="/app/login">
                    Add
                  </Button>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>
      )}

      {/* Themes & collectibles */}
      {activeTab === "themes" && (
        <section>
          <ScrollReveal>
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="font-display text-3xl font-bold">
                  Themes & collectibles
                </h2>
                <p className="text-foreground/50 mt-1">
                  User-created cosmetics, profile styles, and auction-house
                  favorites.
                </p>
              </div>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {themes.map((theme, i) => (
              <ScrollReveal key={theme.name} delay={i * 0.08}>
                <Card className="h-full">
                  <div
                    className="h-24 rounded-lg neo-border-2 mb-4"
                    style={{
                      background: `linear-gradient(135deg, ${theme.colors[0]}, ${theme.colors[1]})`,
                    }}
                  />
                  <h3 className="font-display font-bold text-lg">
                    {theme.name}
                  </h3>
                  <p className="text-foreground/60 text-sm mb-4">
                    {theme.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground/40">
                      {theme.saves} saves
                    </span>
                    <Button variant="outline" size="sm" href="/app/login">
                      Apply
                    </Button>
                  </div>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
