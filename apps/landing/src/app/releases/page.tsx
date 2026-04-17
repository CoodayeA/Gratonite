import { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ScrollReveal } from "@/components/effects/ScrollReveal";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Release Notes & Roadmap | Gratonite",
  description:
    "See what is new in Gratonite Chat: release notes, changelogs, and what we are building next.",
  path: "/releases/",
  keywords: [
    "Gratonite release notes",
    "Gratonite changelog",
    "Gratonite roadmap",
    "Gratonite updates",
    "open source community software updates",
  ],
});

const releases = [
  {
    version: "1.0.7",
    date: "April 17, 2026",
    summary: "Sharper Gratonite identity across landing, in-app help, and self-host docs.",
    accent: "purple" as const,
    changes: [
      "Landing and deploy pages now describe Gratonite as community software with clearer guild and channel language",
      "Download and discover surfaces now introduce guilds, channels, forums, and documents more consistently",
      "In-app help and navigation now favor guild and community wording over older portal phrasing on core surfaces",
      "README, roadmap, and self-host guides now explain Gratonite's core terms in plain language",
    ],
  },
  {
    version: "1.0.6",
    date: "April 17, 2026",
    summary: "Reliability foundations for forum safety, production smoke, mobile forum alignment, and deploy artifact hygiene.",
    accent: "gold" as const,
    changes: [
      "Encrypted forum channels now block forum attachments with clear guidance until the encrypted upload path is supported there",
      "Mobile forum list, create, detail, and replies now use canonical threads and thread message APIs instead of legacy forum-post endpoints",
      "Mobile forum posts can be created with a title and optional body, matching the web forum model more closely",
      "A separate production-smoke GitHub workflow now verifies public health, app HTML, release notes, and optional authenticated chat/forum flows",
      "Generated deploy package directories are ignored and documented as local build output rather than source of truth",
    ],
  },
  {
    version: "1.0.5",
    date: "April 17, 2026",
    summary: "Forum image uploads, attachment replies, richer forum cards, and deploy reliability fixes.",
    accent: "blue" as const,
    changes: [
      "Forum channels now create posts and replies through the forum-native flow",
      "New forum posts support image/file selection, paste, previews, upload progress, remove, retry, and attachment-only bodies with a required title",
      "Forum replies support text, attachments, or both, and send to the parent channel with the correct thread id",
      "Forum post detail renders inline images, native video/audio controls, and downloadable file links",
      "Forum cards keep selected tags, show reliable activity and message counts, and use the original post image as a thumbnail",
      "Production deploy now installs landing dependencies and protects server-owned API dependency folders during rsync",
    ],
  },
  {
    version: "1.0.4",
    date: "March 8, 2026",
    summary: "FAME dashboard, threads fix, community ratings, and enterprise polish.",
    accent: "purple" as const,
    changes: [
      "FAME dashboard with leaderboard, real stats, and give-fame flow",
      "Community ratings: members can rate and review guilds",
      "Threads fix: auto-archive now uses correct duration units",
      "Profile popover shows FAME received count",
      "Batch 2 enterprise features: OAuth2, global search, word filters, raid protection",
      "Scheduled messages, message bookmarks, and draft auto-save",
      "GDPR data export support",
      "User mutes and per-channel notification preferences",
    ],
  },
  {
    version: "1.0.3",
    date: "March 7, 2026",
    summary: "Enterprise wave. New backend systems for moderation and privacy.",
    accent: "gold" as const,
    changes: [
      "OAuth2 authorization flow for third-party apps",
      "Webhook delivery audit logs",
      "Word filter system with block/delete/warn actions",
      "Raid protection toggle for guilds",
      "Per-channel notification preferences",
      "Message drafts, scheduled messages, and bookmarks",
      "GDPR data export requests",
      "User mute system",
      "Session management in settings",
    ],
  },
  {
    version: "1.0.2",
    date: "March 6, 2026",
    summary: "Wave 2 feature expansion. Stickers, push notifications, slow mode, and more.",
    accent: "blue" as const,
    changes: [
      "Sticker system with upload and management",
      "Web push notifications via service worker",
      "Inline video and audio player",
      "Slow mode enforcement per channel",
      "Tab title shows unread message count",
      "Ban appeals flow for moderation",
      "Member screening and guild rules gate",
      "Community discovery tags and insights dashboard",
      "Referral system",
      "20 new database migrations for Wave 2 features",
      "Channel read states, message embeds, and webhooks",
      "Forum channels, announcement channels, and guild folders",
      "Rich presence, status emoji, and automod system",
      "Slash commands and guild boosts",
    ],
  },
  {
    version: "1.0.1",
    date: "March 5, 2026",
    summary: "Bug fixes, stability improvements, and UI polish.",
    accent: "purple" as const,
    changes: [
      "Fixed GIF URL rendering in chat",
      "Typing indicator now shows correct username",
      "Improved typing detection threshold",
      "Fixed ambient sound React state management",
      "Channel background video and image visibility fix (z-index)",
      "General performance and stability improvements",
    ],
  },
  {
    version: "1.0.0",
    date: "March 4, 2026",
    summary: "Initial public release of Gratonite Chat.",
    accent: "gold" as const,
    changes: [
      "Real-time text chat with channels and DMs",
      "Spatial voice chat rooms",
      "Guild creation and management",
      "Role-based permissions system",
      "User profiles with customization",
      "File and image sharing",
      "Desktop apps for macOS, Windows, and Linux",
      "Web app at gratonite.chat/app",
      "Collectibles, cosmetics, and auction house",
      "Neobrutalism UI with dark and light themes",
    ],
  },
];

const roadmap = [
  {
    feature: "iOS & Android apps",
    status: "in-progress" as const,
    description: "Native mobile apps for iPhone, iPad, and Android devices.",
  },
  {
    feature: "End-to-end encryption for DMs",
    status: "done" as const,
    description: "Optional E2EE for DMs and group DMs using ECDH P-256 key agreement and AES-GCM 256-bit encryption.",
  },
  {
    feature: "Plugin / bot SDK",
    status: "planned" as const,
    description: "Public SDK for building bots and integrations on Gratonite.",
  },
  {
    feature: "Screen sharing",
    status: "done" as const,
    description: "Share your screen in voice channels with low-latency streaming.",
  },
  {
    feature: "Custom themes & CSS",
    status: "done" as const,
    description: "User-created themes with full CSS customization per guild.",
  },
  {
    feature: "Federated communities",
    status: "done" as const,
    description: "Self-host your own Gratonite instance and connect to the network.",
  },
];

const statusStyles = {
  done: { label: "Shipped", color: "purple" as const },
  "in-progress": { label: "In progress", color: "gold" as const },
  planned: { label: "Planned", color: "charcoal" as const },
};

export default function ReleasesPage() {
  return (
    <div className="pt-28 pb-16 px-6 relative overflow-hidden">
      <div className="neo-burst neo-burst-purple top-10 right-[-90px]" />
      <div className="neo-burst neo-burst-gold bottom-4 left-[-100px]" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <ScrollReveal>
          <div className="mb-16">
            <Badge color="purple" rotate className="mb-4">
              What&apos;s new
            </Badge>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-4">
              Release
              <br />
              <span className="bg-gold text-black px-3 -mx-1 inline-block tilt-3">
                Notes.
              </span>
            </h1>
            <p className="text-lg text-foreground/60 max-w-lg">
              Every update, every fix, and what&apos;s coming next.
            </p>
          </div>
        </ScrollReveal>

        {/* Release Notes */}
        <section className="mb-20">
          <ScrollReveal>
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-10">
              Releases
            </h2>
          </ScrollReveal>

          <div className="space-y-6">
            {releases.map((release, i) => (
              <ScrollReveal key={release.version} delay={i * 0.08}>
                <Card accent={release.accent} hover={false}>
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <h3 className="font-display text-2xl font-bold">
                      v{release.version}
                    </h3>
                    <Badge color={release.accent}>{release.date}</Badge>
                  </div>
                  <p className="text-foreground/70 font-medium mb-4">
                    {release.summary}
                  </p>
                  <ul className="space-y-2">
                    {release.changes.map((change) => (
                      <li
                        key={change}
                        className="text-sm text-foreground/55 flex gap-2"
                      >
                        <span className="text-foreground/30 select-none">
                          &bull;
                        </span>
                        {change}
                      </li>
                    ))}
                  </ul>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Roadmap */}
        <section className="mb-20">
          <ScrollReveal>
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              Roadmap
            </h2>
            <p className="text-foreground/50 mb-10">
              What we&apos;re working on and what&apos;s coming next.
            </p>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {roadmap.map((item, i) => (
              <ScrollReveal key={item.feature} delay={i * 0.08}>
                <Card className="h-full flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="font-display text-lg font-bold">
                      {item.feature}
                    </h3>
                    <Badge
                      color={statusStyles[item.status].color}
                      className="shrink-0 text-xs"
                    >
                      {statusStyles[item.status].label}
                    </Badge>
                  </div>
                  <p className="text-foreground/55 text-sm flex-1">
                    {item.description}
                  </p>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <ScrollReveal>
          <div className="bg-charcoal text-white neo-border rounded-2xl p-12 md:p-16 text-center">
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              Want to shape what&apos;s next?
            </h2>
            <p className="text-white/50 max-w-xl mx-auto">
              Join the community and help us decide what to build. Every feature
              above started as a conversation.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
