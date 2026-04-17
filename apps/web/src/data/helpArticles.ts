export type Category =
  | 'All'
  | 'Getting Started'
  | 'Account & Security'
  | 'Guilds & Channels'
  | 'Messaging & Chat'
  | 'Bots & Integrations'
  | 'Self-Hosting & Federation'
  | 'Privacy & Safety';

export interface Article {
  id: string;
  title: string;
  description: string;
  category: Exclude<Category, 'All'>;
  body: string[];
}

export const ARTICLES: Article[] = [
  {
    id: 'getting-started-overview',
    title: 'Getting Started with Gratonite',
    description: 'Use the web app or downloads, create an account, and get oriented fast.',
    category: 'Getting Started',
    body: [
      'Open Gratonite in the browser at https://gratonite.chat/app, or grab desktop and mobile builds from https://gratonite.chat/download.',
      'Create an account with a username, email, and password. Gratonite does not require a phone number to get started.',
      'Once you are in, the left side of the app is where you move between guilds, DMs, inbox, discovery, and settings.',
      'If someone invited you into a community, open their invite link. If not, you can create your own guild and shape it from scratch.',
      'The fastest way to get comfortable is to join one guild, open one DM, and visit Settings so you know where notifications, privacy, and appearance live.',
    ],
  },
  {
    id: 'join-or-create-guild',
    title: 'Join or Create Your First Guild',
    description: 'Start from an invite or launch a new community of your own.',
    category: 'Getting Started',
    body: [
      'Use an invite link when you are joining an existing community. Gratonite will drop you straight into the right guild if the invite is still valid.',
      'To create a new guild, use the add control in the guild sidebar and choose a name, icon, and starting setup.',
      'Most new guilds begin with a small set of channels: one general chat, one announcement space, one voice room, and either a forum or documents channel for longer-lived posts.',
      'Invite links are best for the first wave of members. Once the community has shape, you can keep refining channels, roles, onboarding, and moderation settings.',
    ],
  },
  {
    id: 'account-recovery',
    title: 'Login, Verification, and Password Recovery',
    description: 'Keep your account reachable without digging through menus.',
    category: 'Account & Security',
    body: [
      'Use the login screen to sign in with your Gratonite account credentials.',
      'If you are setting up a new account, finish email verification when prompted so account recovery and account-sensitive actions stay available.',
      'If you forget your password, use the reset password flow from the sign-in screen instead of creating a duplicate account.',
      'Keep your recovery email current. It is the cleanest path back in if you lose access to the device you normally use.',
    ],
  },
  {
    id: 'channel-types',
    title: 'Understanding Guilds and Channel Types',
    description: 'Know when to use chat, voice, forum, and documents channels.',
    category: 'Guilds & Channels',
    body: [
      'A community space in Gratonite is called a guild.',
      'Chat channels are for day-to-day conversation, quick replies, reactions, and threads that grow out of live discussion.',
      'Voice channels are for live hangouts, calls, and screen sharing.',
      'Forum channels are for topic-based posts. Each post becomes its own thread so a conversation can stay focused instead of getting buried in a fast-moving timeline.',
      'Documents channels are for longer-lived reference material, guides, notes, and wiki-style pages that the community needs to revisit later.',
    ],
  },
  {
    id: 'roles-and-permissions',
    title: 'Roles, Permissions, and Channel Access',
    description: 'Control who can see, post, moderate, or manage each part of a guild.',
    category: 'Guilds & Channels',
    body: [
      'Open Guild Settings to create roles and decide what each role can do across the guild.',
      'Use role order to control who can manage whom. Higher roles can act on lower roles, but not the other way around.',
      'Adjust channel-specific permissions when a room should stay private, read-only, staff-only, or limited to a specific team.',
      'It is better to start simple than to over-design. A few clear roles usually work better than a giant permission maze.',
    ],
  },
  {
    id: 'forum-channels',
    title: 'Forum Channels and Posts',
    description: 'Use forums for structured conversations that should stay readable over time.',
    category: 'Guilds & Channels',
    body: [
      'Open a forum channel when a topic deserves its own post instead of another message in the main chat feed.',
      'New posts require a title, and they can include text, attachments, or both depending on the channel rules.',
      'Replies stay inside the post thread, which makes forums better for support questions, showcases, async discussions, and announcements with follow-up.',
      'If your community uses tags, apply them when they help people scan the forum quickly instead of turning every post into metadata soup.',
    ],
  },
  {
    id: 'documents-and-wikis',
    title: 'Documents and Wiki-Style Pages',
    description: 'Keep guides, shared notes, and living references inside the guild.',
    category: 'Guilds & Channels',
    body: [
      'Documents channels are built for information that should keep improving over time instead of disappearing into chat history.',
      'Use them for FAQs, onboarding guides, event plans, community rules, reference docs, or handoff notes.',
      'When a page changes often, lean on revision history so people can compare updates and recover context when needed.',
      'Treat documents as the long-memory of a guild: chat is for momentum, documents are for the version you want people to find later.',
    ],
  },
  {
    id: 'global-search',
    title: 'Global Search and Finding Context Again',
    description: 'Search beyond messages when you need to recover where something lives.',
    category: 'Messaging & Chat',
    body: [
      'Use global search when you remember the topic but not the exact room or post.',
      'Search results can surface messages, people, channels, documents, forum threads, and files depending on what is available in the current scope.',
      'When you open a result, Gratonite jumps you back to the relevant context instead of dumping you into a disconnected result list.',
      'The most useful search habits are short queries, guild scoping when possible, and treating search like a doorway back to context rather than a dead-end archive.',
    ],
  },
  {
    id: 'notifications-and-inbox',
    title: 'Notifications, Inbox, and What Deserves Your Attention',
    description: 'Tune noise down without losing the things that actually matter.',
    category: 'Messaging & Chat',
    body: [
      'Use the inbox to review recent alerts, mentions, replies, and other activity that needs a second look.',
      'Notification preferences let you decide what should break through and what should stay quiet at the guild, channel, and personal level.',
      'When a channel is high-volume, move it toward mentions-only or a quieter profile instead of muting everything blindly.',
      'The goal is not to see every ping. The goal is to trust the alerts you keep.',
    ],
  },
  {
    id: 'direct-messages-and-groups',
    title: 'Direct Messages, Group DMs, and Private Conversation',
    description: 'Understand what stays private and how DMs differ from guild chat.',
    category: 'Messaging & Chat',
    body: [
      'Direct Messages and Group DMs are where Gratonite handles private conversation between people instead of the wider guild.',
      'DMs and Group DMs are end-to-end encrypted by default. That is a different privacy model from guild channels, which remain server-visible so moderation, search, and community tooling can work.',
      'Use Group DMs for smaller, private threads when a full guild would be too much overhead.',
      'If you need a community decision, move it into a guild. If you need a private conversation, keep it in DMs.',
    ],
  },
  {
    id: 'bot-store-and-integrations',
    title: 'Bot Store and Integrations',
    description: 'Install bots carefully and keep permissions honest.',
    category: 'Bots & Integrations',
    body: [
      'Browse the Bot Store when you want moderation helpers, utilities, or community automation inside a guild.',
      'Only install a bot into a guild you manage, and review what permissions it actually needs before you add it.',
      'A useful bot should make the guild easier to run, not more confusing to audit later.',
      'If an integration can post, moderate, or read broadly, treat it like staff access and review it that way.',
    ],
  },
  {
    id: 'self-hosting-basics',
    title: 'Self-Hosting Basics',
    description: 'Run your own Gratonite instance without losing the product story.',
    category: 'Self-Hosting & Federation',
    body: [
      'If you want full operational control, start at https://gratonite.chat/deploy or the self-host docs in this repository.',
      'The one-command installer is the fastest way to get a working instance online, while Gratonite Server gives operators a desktop app path.',
      'Self-hosting covers the same product surfaces people expect from Gratonite: communities, channels, DMs, voice, moderation, and federation-aware networking.',
      'Treat deploy docs, upgrade notes, and rollback guidance as part of the product, not an afterthought. Operator trust matters as much as user trust.',
    ],
  },
  {
    id: 'federation-basics',
    title: 'How Federation Works',
    description: 'Independent Gratonite instances can still communicate and host communities together.',
    category: 'Self-Hosting & Federation',
    body: [
      'Federation lets separate Gratonite instances discover each other, exchange activity, and stay connected without collapsing into one central host.',
      'That means a self-hosted community does not have to become an island just because it runs on its own infrastructure.',
      'When you see federation docs talk about relays, addresses, or remote instances, the goal is simple: let independently run communities still feel connected.',
      'Use the federation docs when you are operating an instance or need to understand how remote communities and remote users show up inside your own space.',
    ],
  },
  {
    id: 'privacy-and-reporting',
    title: 'Privacy, Reports, and Safety Basics',
    description: 'Know what is private, what is reviewable, and how to flag problems.',
    category: 'Privacy & Safety',
    body: [
      'Private messages and community channels do not share the same visibility model. DMs are end-to-end encrypted by default; guild channels are not.',
      'Guild channels stay server-visible so moderation, search, discovery, community records, and policy enforcement can function.',
      'If you run into harassment, spam, or abusive content, use the report flow instead of trying to solve everything in-channel.',
      'Good safety tooling is meant to make communities more trustworthy, not more performative. Report what matters and leave the moderation trail clear enough for follow-up.',
    ],
  },
];
