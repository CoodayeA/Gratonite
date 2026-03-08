export type Category =
  | 'All'
  | 'Getting Started'
  | 'Account & Security'
  | 'Servers & Channels'
  | 'Bots & Integrations'
  | 'Billing & Premium'
  | 'Cosmetics & Shop'
  | 'Creator Tools'
  | 'Marketplace & Auctions'
  | 'Messaging & Chat'
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
    id: 'getting-started',
    title: 'Getting Started with Gratonite',
    description: 'Learn the basics of navigating and using Gratonite.',
    category: 'Getting Started',
    body: [
      'Download and install Gratonite from the official website or use the web app at app.gratonite.com.',
      'Create your account by providing a username, email, and password. Verify your email to unlock all features.',
      'Explore the sidebar to find your servers, direct messages, and notifications panel.',
      'Join an existing server using an invite link, or create your own server to get started with your community.',
      'Customize your experience by visiting Settings to adjust themes, notifications, and privacy preferences.',
    ],
  },
  {
    id: 'creating-server',
    title: 'Creating Your First Server',
    description: 'Step-by-step guide to setting up a new server.',
    category: 'Getting Started',
    body: [
      'Click the "+" button at the bottom of the server sidebar to begin creating a new server.',
      'Choose a server template (Community, Gaming, Study Group, or Blank) to pre-populate channels and roles.',
      'Set your server name, upload a server icon, and optionally write a short description.',
      'Configure default channels — most servers start with #general, #announcements, and a voice lounge.',
      'Share your server invite link with friends or post it publicly to start building your community.',
    ],
  },
  {
    id: 'customizing-profile',
    title: 'Customizing Your Profile',
    description: 'Personalize your avatar, banner, bio, and nameplate.',
    category: 'Getting Started',
    body: [
      'Navigate to Settings > My Profile to access all profile customization options.',
      'Upload a profile avatar (PNG, JPG, or GIF) — animated avatars are available for all users.',
      'Set a profile banner image that displays when others view your profile card.',
      'Write a short bio (up to 190 characters) to tell others about yourself.',
      'Choose a nameplate style from the Nameplate Shop to make your username stand out in chat.',
    ],
  },
  {
    id: 'two-factor-auth',
    title: 'Enabling Two-Factor Authentication',
    description: 'Secure your account with MFA for extra protection.',
    category: 'Account & Security',
    body: [
      'Go to Settings > Account & Security > Two-Factor Authentication and click "Enable 2FA".',
      'Download an authenticator app like Google Authenticator, Authy, or 1Password on your phone.',
      'Scan the QR code displayed on screen with your authenticator app to link your account.',
      'Enter the 6-digit verification code from your authenticator app to confirm setup.',
      'Save your backup codes in a secure location — these allow account recovery if you lose your device.',
    ],
  },
  {
    id: 'server-roles',
    title: 'Managing Server Roles & Permissions',
    description: 'Understand role hierarchy and permission management.',
    category: 'Servers & Channels',
    body: [
      'Open Server Settings > Roles to view, create, and manage roles for your server.',
      'Roles are ordered by hierarchy — higher roles can manage members with lower roles but not those above them.',
      'Create custom roles with specific permissions like Manage Channels, Kick Members, or Manage Messages.',
      'Assign roles to members by right-clicking their name and selecting "Manage Roles".',
      'Use channel-specific permission overrides to grant or deny access to individual channels per role.',
    ],
  },
  {
    id: 'voice-channels',
    title: 'Setting Up Voice Channels',
    description: 'Configure voice channels with quality and limit settings.',
    category: 'Servers & Channels',
    body: [
      'Create a voice channel by clicking the "+" next to a channel category and selecting "Voice Channel".',
      'Set a user limit (2–99) to control how many people can join simultaneously, or leave unlimited.',
      'Adjust the bitrate (8kbps–384kbps) to balance audio quality with bandwidth usage.',
      'Enable "Stage Mode" to create a speaker/audience format for presentations or events.',
      'Configure permissions to control who can speak, mute others, or move members between channels.',
    ],
  },
  {
    id: 'bot-store',
    title: 'Using the Bot Store',
    description: 'Browse, install, and configure bots for your server.',
    category: 'Bots & Integrations',
    body: [
      'Open the Bot Store from the server settings or the main navigation to browse available bots.',
      'Use categories and search to find bots for moderation, music, leveling, utilities, and more.',
      'Click "Add to Server" and select which server to install the bot on — you need Manage Server permission.',
      'Configure the bot using its dashboard or slash commands (e.g., /settings, /help) in any text channel.',
      'Review and adjust bot permissions regularly to ensure it only has access to what it needs.',
    ],
  },
  {
    id: 'webhooks',
    title: 'Creating Webhooks',
    description: 'Set up webhooks to send automated messages to channels.',
    category: 'Bots & Integrations',
    body: [
      'Navigate to Server Settings > Integrations > Webhooks and click "New Webhook".',
      'Name your webhook and select the target channel where messages will be posted.',
      'Optionally upload a custom avatar for the webhook to give it a unique identity in chat.',
      'Copy the webhook URL and use it in external services (GitHub, CI/CD, monitoring tools) to post messages.',
      'Test your webhook by sending a POST request with a JSON body containing a "content" field.',
    ],
  },
  {
    id: 'economy',
    title: 'Understanding Gratonite Economy',
    description: 'Learn how the in-app economy works — earn, never buy.',
    category: 'Billing & Premium',
    body: [
      'Gratonite uses an earn-based economy — currency is gained through activity, not real-money purchases.',
      'Earn coins by participating in servers: chatting, reacting, attending events, and helping others.',
      'Daily check-ins and weekly challenges provide bonus coins and exclusive cosmetic rewards.',
      'Spend coins in the Cosmetic Shop on nameplates, profile effects, chat themes, and emote packs.',
      'The economy is designed to reward engagement and contribution, not spending power.',
    ],
  },
  {
    id: 'fame-system',
    title: 'The FAME System Explained',
    description: 'How the thumbs-up reputation system works.',
    category: 'Getting Started',
    body: [
      'FAME (Feedback And Merit Exchange) is Gratonite\'s reputation system based on positive community interactions.',
      'Give a thumbs-up to helpful messages, great content, or kind community members to increase their FAME score.',
      'Your FAME score is visible on your profile and reflects how positively the community views your contributions.',
      'Higher FAME unlocks cosmetic badges, special profile borders, and priority access to beta features.',
      'FAME cannot be purchased — it can only be earned through genuine, positive community participation.',
    ],
  },
  {
    id: 'voice-troubleshooting',
    title: 'Troubleshooting Voice Issues',
    description: 'Fix echo, lag, and connection problems in voice channels.',
    category: 'Account & Security',
    body: [
      'Check your input/output device settings in Settings > Voice & Audio and ensure the correct mic and speakers are selected.',
      'If you hear echo, enable "Echo Cancellation" and ask others in the channel to use headphones.',
      'For connection issues, try switching the voice region in channel settings or restarting the app.',
      'Run the built-in Audio Diagnostic tool (Settings > Voice & Audio > Diagnostics) to identify hardware problems.',
      'If issues persist, check your firewall settings to ensure Gratonite has permission for UDP traffic on ports 50000–65535.',
    ],
  },
  {
    id: 'automod',
    title: 'AutoMod Configuration',
    description: 'Set up automatic moderation rules for your server.',
    category: 'Servers & Channels',
    body: [
      'Enable AutoMod from Server Settings > Moderation > AutoMod to activate automated content filtering.',
      'Configure keyword filters to automatically block or flag messages containing specific words or phrases.',
      'Set up spam detection rules to catch rapid message sending, excessive mentions, or repeated content.',
      'Choose actions for violations: warn the user, delete the message, timeout the member, or log to a mod channel.',
      'Create exemptions for specific roles or channels where AutoMod rules should not apply.',
    ],
  },

  // ── Cosmetics & Shop ──────────────────────────────────────────────────────

  {
    id: 'the-shop',
    title: 'The Cosmetics Shop',
    description: 'Browse and buy official cosmetics using Gratonite currency.',
    category: 'Cosmetics & Shop',
    body: [
      'Navigate to /shop from the main sidebar to open the official Cosmetics Shop, where you can browse all items sold directly by Gratonite.',
      'The Shop is organized into five tabs: Avatar Frames, Decorations, Profile Effects, Nameplates, and Soundboard — click any tab to filter items by type.',
      'Hover over any item card to see a live preview; for animated items, the animation will play automatically inside the preview panel on the right side of the screen.',
      'Your current Gratonite currency balance is displayed in the top-right corner of the Shop. Only items you can afford are fully interactive — items that exceed your balance are shown with a lock indicator.',
      'To purchase an item, click its card and then click the "Buy" button. A confirmation dialog will show the item name, price, and your balance after purchase — click "Confirm" to complete the transaction.',
      'After a successful purchase, the item is immediately added to your Inventory and a confirmation toast appears. You do not need to restart the app or refresh the page.',
      'All purchased items are accessible from your Inventory at /inventory, organized by type, ready to equip at any time.',
    ],
  },
  {
    id: 'your-inventory',
    title: 'Your Inventory',
    description: 'View, equip, and manage all your cosmetic items in one place.',
    category: 'Cosmetics & Shop',
    body: [
      'Open your Inventory by navigating to /inventory or clicking the Inventory icon in the main sidebar. Everything you have ever acquired — purchased or earned — lives here.',
      'The Inventory is divided into seven tabs: All, Frames, Effects, Themes, Decorations, Nameplates, and Soundboard. The All tab shows every item regardless of type.',
      'To equip an item, click its card to select it, then click the "Equip" button that appears at the bottom of the detail panel. Only one item per slot can be equipped at a time.',
      'To unequip an item without replacing it, select the currently equipped item (indicated by a green checkmark) and click "Unequip". This removes the cosmetic from your profile immediately.',
      'Equipped items are reflected on your profile card and everywhere your avatar appears across Gratonite — including server member lists, chat messages, and DMs.',
      'Items in your Inventory are labeled with either a "Shop" badge (purchased from the official Gratonite shop) or a "Creator" badge (purchased from a user on the Marketplace). This label is for reference only and does not affect how items function.',
      'Inventory items are permanently yours — they are never revoked, expire, or require renewal unless the item was part of a time-limited event with explicitly stated terms.',
    ],
  },
  {
    id: 'avatar-frames',
    title: 'Avatar Frames',
    description: 'Decorative borders that surround your profile picture everywhere it appears.',
    category: 'Cosmetics & Shop',
    body: [
      'Avatar Frames are decorative borders rendered around the edge of your profile picture. They appear at every size your avatar is displayed, automatically scaling to fit.',
      'Frames are visible in the server member list, next to your messages in any text channel, on your profile card when someone clicks your name, and in direct message conversations.',
      'To equip a frame, open your Inventory, navigate to the Frames tab, select the frame you want, and click "Equip". The change takes effect immediately and other users will see it on their next refresh.',
      'Gratonite offers both static frames (fixed border designs in various shapes and colors) and animated frames (frames with looping motion, glow pulses, or particle trails). Animated frames are identified with a small "Animated" badge on the item card.',
      'Before purchasing a frame from the Shop, click its card to open the detail view and see a full-size animated preview alongside your actual avatar. This lets you judge how the frame will look before committing your Gratonite currency.',
    ],
  },
  {
    id: 'profile-effects',
    title: 'Profile Effects',
    description: 'Animated visual effects that play when someone views your full profile card.',
    category: 'Cosmetics & Shop',
    body: [
      'Profile Effects are animated overlays that play on your full profile card — the popup that appears when someone clicks on your name or avatar. They do not appear in chat or the member list.',
      'Effect styles available in the Shop include particles (floating confetti or embers), shimmer (a light sheen that sweeps across your banner), aurora (flowing color waves), and pulse (rhythmic glow rings that radiate outward from your avatar).',
      'To equip a Profile Effect, go to your Inventory, open the Effects tab, select the effect, and click "Equip". Open your own profile card to see a preview of how it looks to others.',
      'Profile Effects are rendered using GPU-accelerated CSS animations and are designed to stay performant even on lower-end hardware. They run at a capped frame rate to minimize battery and CPU impact.',
      'If you prefer a cleaner profile or experience any performance issues, you can disable all effects globally in Settings > Accessibility > "Reduce Motion", which turns off Profile Effects for everyone you view and removes your own effect from other users\' views.',
    ],
  },
  {
    id: 'nameplates',
    title: 'Nameplates',
    description: 'Custom styles for your display name — gradients, fonts, and special effects.',
    category: 'Cosmetics & Shop',
    body: [
      'Nameplates change the visual style of your display name wherever it appears across Gratonite, making your username stand out with custom colors, fonts, and effects.',
      'The Shop offers three families of nameplates: Gradient (smooth color transitions across your name), Holographic (iridescent, angle-shifting color effects), and Animated (names with looping motion such as shimmer sweeps, color cycling, or glow pulses).',
      'Nameplates are displayed in all text channels next to your messages, in the server member list, and on your profile card. They apply to your display name as set in your profile — they do not affect your username handle.',
      'To equip a nameplate, open Inventory, go to the Nameplates tab, choose the nameplate you want, and click "Equip". Your name will update immediately across all servers and channels without requiring any action from other users.',
      'Before purchasing a nameplate, use the Shop preview panel to type in your own display name and see exactly how it will look with your specific characters and name length, so there are no surprises after buying.',
    ],
  },
  {
    id: 'decorations',
    title: 'Avatar Decorations',
    description: 'Decorative overlays that attach to your avatar — crowns, wings, and more.',
    category: 'Cosmetics & Shop',
    body: [
      'Avatar Decorations are cosmetic overlays that are composited directly on top of or around your profile picture, adding a three-dimensional or accessory-style element to your avatar.',
      'Decorations appear wherever your avatar is shown — including chat messages, the member list, your profile card, and direct messages — at every display size, scaled proportionally.',
      'The Shop currently offers five decoration families: Crown (positioned above the avatar), Wings (extending from the sides), Halo (a floating ring above the head), Horns (rising from the top), and Petals (flower or leaf elements arranged around the avatar).',
      'To equip a decoration, navigate to your Inventory, open the Decorations tab, select the item, and click "Equip". A before-and-after preview of your avatar is shown in the detail panel before you confirm.',
      'Only one decoration can be equipped at a time. Equipping a new decoration automatically unequips the previous one — your old decoration is not lost and remains in your Inventory ready to re-equip whenever you like.',
    ],
  },
  {
    id: 'soundboard-sounds',
    title: 'Soundboard Sounds',
    description: 'Play short audio clips in voice channels for everyone to hear.',
    category: 'Cosmetics & Shop',
    body: [
      'Soundboard Sounds are short audio clips between 1 and 10 seconds long that you can play inside any voice channel you are connected to. They are personal to your account and form your own sound library.',
      'While you are connected to a voice channel, click the Soundboard button (the speaker-grid icon) in the voice channel control bar at the bottom of the screen to open your sound panel. Click any sound to play it immediately.',
      'When you trigger a sound, it is broadcast as an audio stream to all participants currently in the same voice channel — it is heard by everyone, not just you. A small on-screen indicator shows which user played the sound.',
      'Your complete sound library is managed from your Inventory under the Soundboard tab. Here you can see all sounds you own, preview them with the play button, and organize your favorites by starring them.',
      'Sounds from the Shop are described as "downloaded" to your library rather than equipped — this is because you can own and use multiple sounds simultaneously, unlike slotted cosmetics such as frames or effects.',
      'Only one sound can play at a time per user. If you trigger a second sound while one is still playing, the first is cut off and the new sound plays from the beginning. There is a 2-second cooldown between plays to prevent rapid spamming.',
    ],
  },

  // ── Creator Tools ─────────────────────────────────────────────────────────

  {
    id: 'creator-dashboard',
    title: 'Creator Dashboard',
    description: 'Create, upload, and publish cosmetics for others to purchase on the Marketplace.',
    category: 'Creator Tools',
    body: [
      'The Creator Dashboard at /creator-dashboard is your hub for designing, uploading, and managing cosmetics that other Gratonite users can purchase on the Marketplace.',
      'There are two ways to create an asset: upload an existing file from your computer, or use the in-app Cosmetics Editor to build an asset visually without any design software.',
      'Supported file formats for uploads are PNG, GIF, and WEBP for visual cosmetics (frames, decorations, effects, nameplates) and MP3, OGG, and WAV for soundboard sounds.',
      'File size limits are enforced at upload: image and animation files must be under 2 MB, and audio files must be under 1 MB. Files exceeding these limits will be rejected with a descriptive error.',
      'After finishing your asset, click "Submit for Review". Your submission enters a Pending state while the Gratonite moderation team reviews it for quality, originality, and content policy compliance. You will be notified by in-app notification and email when the review is complete.',
      'Approved items are automatically published to the Marketplace where other users can discover and purchase them. Rejected items are returned with a reason explaining what needs to change before resubmission.',
      'You earn Gratonite currency each time another user purchases one of your approved items. Your earnings and sales history are visible on the Creator Dashboard under the Earnings tab.',
    ],
  },
  {
    id: 'cosmetics-editor',
    title: 'The Cosmetics Editor',
    description: 'Design cosmetics directly in-app without uploading any files.',
    category: 'Creator Tools',
    body: [
      'The Cosmetics Editor lets you build cosmetics entirely inside Gratonite using visual controls — no external design tools or file uploads required. It is accessible from the Creator Dashboard by clicking "Create with Editor" and choosing a cosmetic type.',
      'The Frame Editor lets you design avatar frames. Controls include border style (solid, dashed, double, or dotted), border width in pixels, primary and secondary fill colors, corner radius, and an optional outer glow with adjustable color and blur radius. A live preview panel renders your frame around a sample avatar in real time.',
      'The Nameplate Editor gives you control over font family (from a curated set of six fonts), font size, text color or gradient (up to three color stops), background shape (none, pill, rectangle, or underline), background fill color and opacity, and an optional animated shimmer layer. Text you type into the preview field renders with your exact settings.',
      'The Profile Effect Editor offers four base animation types (particles, shimmer, aurora, pulse) with controls for primary and accent colors, animation speed (slow/medium/fast), and intensity (subtle/normal/strong). Changing any setting immediately updates the animated preview.',
      'The Decoration Editor allows you to choose a base shape (crown, wings, halo, horns, or petals), fill color and pattern, border color and thickness, anchor position relative to the avatar, scale percentage, and whether the decoration animates (bounce, sway, or spin) or remains static.',
      'When you are satisfied with your design, click "Save Draft" to preserve your work without submitting, or click "Submit for Review" to send it directly to the moderation queue. Drafts can be edited and resubmitted at any time from the Creator Dashboard.',
      'Config-based cosmetics created in the Editor are stored as structured JSON definitions rather than image files. This means they render crisply at any resolution and have a smaller file footprint than equivalent uploaded images.',
    ],
  },

  // ── Marketplace & Auctions ────────────────────────────────────────────────

  {
    id: 'marketplace',
    title: 'The Marketplace',
    description: 'Browse and buy cosmetics created by other Gratonite users.',
    category: 'Marketplace & Auctions',
    body: [
      'The Marketplace is where user-created cosmetics are sold. Unlike the official Shop — which sells items made by the Gratonite team — everything in the Marketplace was designed and published by members of the community.',
      'Navigate to /marketplace from the sidebar to start browsing. You can filter by cosmetic type (Frames, Decorations, Effects, Nameplates, Sounds), sort by Newest, Most Popular, or Price, and search by keyword.',
      'Each listing shows a live preview, the creator\'s username and FAME score, the item price in Gratonite currency, and the number of times the item has been purchased. Click a listing to open the full detail page.',
      'On the detail page you can click the creator\'s name to visit their Creator Profile, which shows all of their published cosmetics in one place — useful for discovering more work from creators whose style you enjoy.',
      'To purchase an item, click "Buy Now" on the detail page. The purchase confirmation dialog shows the item, the price, and your balance after the transaction. Confirm to complete the purchase instantly.',
      'Purchased Marketplace items appear in your Inventory immediately, tagged with a "Creator" badge. They function identically to official Shop items and can be equipped, unequipped, and re-equipped at any time.',
      'The Marketplace also contains an Auctions section for time-limited listings. Click the "Auctions" tab at the top of the Marketplace page to browse items currently up for bid before their timers expire.',
    ],
  },
  {
    id: 'auction-house',
    title: 'Auction House',
    description: 'Bid on rare user-created cosmetics in time-limited auctions.',
    category: 'Marketplace & Auctions',
    body: [
      'The Auction House is a section of the Marketplace where creators can list cosmetics for time-limited competitive bidding. Auctions are a way to offer rare or exclusive items at a price determined by community demand.',
      'To place a bid, open an active auction listing and enter your bid amount — it must be higher than the current highest bid (or the starting price if no bids have been placed yet). Your bid amount is immediately placed in escrow and deducted from your available balance.',
      'If another user outbids you, your escrowed currency is returned to your balance instantly and you receive an in-app notification. You can then choose to place a higher bid or let the auction go.',
      'When an auction ends, the highest bidder wins the cosmetic. The item transfers to the winner\'s Inventory and the seller receives the winning bid amount in Gratonite currency, minus the platform fee displayed on the listing page.',
      'To list your own cosmetic in an auction, the item must already be published on the Marketplace. From the Creator Dashboard or your Marketplace listing, click "List for Auction", set a starting price, optionally set a reserve price (the minimum you will accept), and choose a duration of 6, 12, 24, or 48 hours.',
      'A reserve price is hidden from bidders — if the auction ends without meeting the reserve, no sale occurs, the item is returned to you, and all bids are refunded. You are not charged a listing fee in this case.',
      'You may cancel an auction only before the first bid has been placed. Once at least one bid exists, the auction must run to completion. Cancellation is done from the Creator Dashboard under Active Auctions.',
    ],
  },

  // ── Bots & Integrations (new articles) ───────────────────────────────────

  {
    id: 'bots-overview',
    title: 'Bots — Overview',
    description: 'What bots are and how they enhance your Gratonite servers.',
    category: 'Bots & Integrations',
    body: [
      'Bots are automated programs that connect to your Gratonite server and add functionality beyond what the platform provides out of the box — things like custom commands, automated moderation, leveling systems, polls, and third-party service notifications.',
      'Gratonite supports two distinct bot types. Native bots are built on Gratonite\'s own managed bot platform and require no hosting on your part. Custom or Webhook bots are self-hosted programs you or a developer runs on external servers; Gratonite communicates with them by sending HTTP POST requests to a URL you register.',
      'Regardless of type, bots can send and edit messages, create and manage threads, assign or remove roles, listen for specific events (a member joining, a reaction being added, a message being posted), and respond to slash commands typed by server members.',
      'To find bots ready to install, visit the Bot Store at /bot-store. Each listing includes a description, a list of permissions the bot requires, and reviews from other server admins who have installed it.',
      'Server members interact with bots primarily through slash commands (typed with a "/" prefix), keyword triggers (the bot watches for specific words in messages), and event listeners (the bot takes action automatically when a server event occurs, such as posting a welcome message when a new member joins).',
    ],
  },
  {
    id: 'adding-bot-to-server',
    title: 'Adding a Bot to Your Server',
    description: 'Step-by-step guide for server admins to install and configure bots.',
    category: 'Bots & Integrations',
    body: [
      'You must have the Manage Server permission on the target server to install bots. If you are not the server owner, ask an admin to grant you this permission or have them perform the installation.',
      'Open the Bot Store at /bot-store and find the bot you want to install. You can browse by category or use the search bar. Click the bot\'s listing card to open its detail page.',
      'On the bot\'s detail page, click "Add to Server". A modal will appear listing every server you have Manage Server permission on. Select the server you want to install the bot into and click "Next".',
      'Review the list of permissions the bot is requesting — for example, Read Messages, Send Messages, Manage Roles, or Kick Members. These permissions define what the bot is allowed to do on your server. Click "Authorize" to confirm and complete the installation.',
      'After installation, the bot appears in your server\'s member list with a "Bot" badge next to its name. It is now connected and listening for events on your server.',
      'To configure the bot\'s access, go to Server Settings > Roles and adjust the bot\'s role permissions. You can also go to individual channel settings and use permission overrides to restrict or expand the bot\'s access per channel.',
      'Test the bot by typing its primary slash command (usually /help or /start) in a text channel where it has permission to read and send messages. If the bot does not respond, double-check its channel permissions.',
      'To remove a bot, go to Server Settings > Integrations, find the bot in the installed list, and click "Remove". All data the bot stored for your server may be deleted — check the bot\'s documentation for details.',
    ],
  },
  {
    id: 'building-webhook-bot',
    title: 'Building a Webhook Bot',
    description: 'Developer guide: register a webhook bot and receive events from Gratonite.',
    category: 'Bots & Integrations',
    body: [
      'A Webhook bot is a self-hosted HTTP server that you build and run. Rather than maintaining a persistent connection to Gratonite, your server receives events as HTTP POST requests that Gratonite sends whenever something happens in a server where your bot is installed.',
      'Register your bot in the Bot Builder at /bot-builder. Go to the Webhook Bot tab, fill in your bot\'s name, description, and the public HTTPS URL where Gratonite should send event payloads (your webhookUrl), then click "Create Bot".',
      'After creation, the Bot Builder displays your webhookSecret and apiToken exactly once. Copy both values and store them securely — for example, in environment variables or a secrets manager. These credentials are not shown again and cannot be recovered; you would need to regenerate them if lost.',
      'Each event payload Gratonite sends to your webhookUrl is a JSON object with the following fields: type (the event name, e.g. "message_create"), guildId, channelId, messageId, content (the message text), author (an object with id and username), and timestamp (ISO 8601).',
      'To verify that an incoming request genuinely came from Gratonite and was not tampered with, compute the HMAC-SHA256 of the raw request body using your webhookSecret as the key. Compare your computed hash to the value in the X-Gratonite-Signature request header — reject any request where they do not match.',
      'To take action in response to an event, your server must reply to the POST request within 3 seconds with a JSON body in the format { "actions": [...] }. Supported action types include send_message (with fields channelId and content) and add_role (with fields userId and roleId). Requests that time out or return an error are not retried.',
      'During development, your webhookUrl must be publicly reachable. Use a local tunnel tool such as ngrok (ngrok http 3000) to expose your local server to the internet and paste the resulting HTTPS URL into the Bot Builder while testing.',
    ],
  },
  {
    id: 'discord-bot-migration',
    title: 'Migrating a Discord Bot to Gratonite',
    description: 'How to adapt your existing Discord.js bot to work on Gratonite using the bridge adapter.',
    category: 'Bots & Integrations',
    body: [
      'Gratonite\'s webhook-based bot system is fundamentally simpler than Discord\'s gateway: instead of opening a persistent WebSocket connection and maintaining a heartbeat, your bot server just receives HTTP POST requests and responds with action JSON. This means less infrastructure to manage and no reconnection logic.',
      'The key architectural difference is that Discord streams all events to your bot continuously over a WebSocket, whereas Gratonite pushes only relevant events to your registered webhookUrl as individual HTTP requests. Your bot does not need to be "always listening" — it just needs to be able to handle incoming POST requests.',
      'Most event and field names map directly with small naming differences. The message_create event corresponds to Discord\'s messageCreate. The author.id field is equivalent to Discord\'s message.author.id. The top-level guildId maps to Discord\'s message.guild.id. Refer to the full mapping table in the Bot Builder documentation.',
      'To accelerate migration, download the official Gratonite Bridge Adapter from Bot Builder > Documentation > Bridge Adapter. This TypeScript package wraps Gratonite\'s webhook event format in Discord.js-compatible structures, so your existing event handler functions require minimal or no changes to run.',
      'Install the adapter with npm install @gratonite/discord-bridge, then replace your Discord client initialization with the GratoniteClient provided by the adapter, passing in your webhookSecret and apiToken. The adapter exposes the same client.on("messageCreate", handler) API you are already using.',
      'The majority of Discord.js features work out of the box after migration: text commands, slash command responses, role assignment and removal, and message sending and editing are all fully supported. Voice and audio playback requires a separate integration with Gratonite\'s LiveKit-based voice infrastructure — consult the LiveKit Integration guide for details.',
      'To test your migrated bot, register a webhook URL pointing to your adapter server in the Bot Builder, install the bot on a private test server, and send a command. Check the Bot Builder > Logs tab to inspect the raw event payloads Gratonite sent and the action responses your server returned, which makes debugging straightforward.',
    ],
  },

  // ── Messaging & Chat ──────────────────────────────────────────────────────

  {
    id: 'threads',
    title: 'Using Threads',
    description: 'Keep conversations organized with threaded replies.',
    category: 'Messaging & Chat',
    body: [
      'Start a thread by hovering over any message and clicking the thread icon, or right-click a message and select "Create Thread".',
      'Threads open in a side panel, keeping the main channel clean while allowing focused discussions on a specific topic.',
      'Reply within a thread to keep related messages grouped together — thread replies do not clutter the main channel view.',
      'Threads auto-archive after a configurable period of inactivity. Server admins can set the auto-archive duration in channel settings.',
      'You can follow or unfollow threads to control which ones send you notifications. Followed threads appear in your thread inbox.',
    ],
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'Navigate faster with keyboard shortcuts.',
    category: 'Getting Started',
    body: [
      'Press Shift+Enter to insert a new line in your message without sending it. Press Enter alone to send.',
      'Press Escape to close any open panel, modal, or popover — including threads, settings, and search results.',
      'Use Ctrl+K (or Cmd+K on Mac) to open the command palette for quick navigation to channels, servers, and DMs.',
      'Press Ctrl+Shift+M to toggle the mute state of your microphone in a voice channel.',
      'Arrow Up on an empty message input edits your most recently sent message in the current channel.',
    ],
  },
  {
    id: 'message-reactions',
    title: 'Message Reactions',
    description: 'React to messages with emoji to express yourself.',
    category: 'Messaging & Chat',
    body: [
      'Hover over a message and click the emoji face icon to open the reaction picker. Select any emoji to add your reaction.',
      'Click an existing reaction beneath a message to add your own — the counter increments and your avatar appears in the reaction tooltip.',
      'Hover over a reaction to see the list of users who reacted with that emoji.',
      'Click your own reaction again to remove it. Server moderators can remove reactions from any message.',
      'Servers can restrict which roles are allowed to add reactions in specific channels via channel permission settings.',
    ],
  },
  {
    id: 'drafts-scheduled',
    title: 'Drafts & Scheduled Messages',
    description: 'Auto-saved drafts and scheduling messages for later.',
    category: 'Messaging & Chat',
    body: [
      'Drafts are saved automatically as you type. If you switch channels or close the app, your in-progress message is preserved and restored when you return.',
      'To schedule a message, click the clock icon next to the send button and choose a date and time for delivery.',
      'Scheduled messages are sent automatically at the specified time, even if you are offline. They appear as regular messages to recipients.',
      'View and manage all your scheduled messages from Settings > Drafts & Scheduled, where you can edit, reschedule, or cancel pending messages.',
      'Drafts are per-channel — each channel stores its own draft independently, so you can have multiple works-in-progress across different conversations.',
    ],
  },
  {
    id: 'bookmarks-saved',
    title: 'Bookmarks & Saved Messages',
    description: 'Save important messages for quick access later.',
    category: 'Messaging & Chat',
    body: [
      'Right-click any message and select "Bookmark" to save it to your personal bookmarks collection.',
      'Access all your saved messages from the Saved Messages page, accessible from the sidebar or by pressing Ctrl+Shift+B.',
      'Bookmarks are private — only you can see your saved messages. They are not visible to other users or server admins.',
      'Organize bookmarks by searching or filtering by server and channel to quickly find the message you need.',
      'Remove a bookmark by right-clicking the message again and selecting "Remove Bookmark", or from the Saved Messages page.',
    ],
  },
  {
    id: 'direct-messages',
    title: 'Direct Messages',
    description: 'Send private messages to individuals or groups.',
    category: 'Messaging & Chat',
    body: [
      'Start a DM by clicking the DM icon in the sidebar, then select a friend or search for any user by username.',
      'Group DMs allow up to 10 participants. Create one by selecting multiple users when starting a new conversation.',
      'DM conversations support all the same features as server channels — file uploads, reactions, embeds, and message editing.',
      'Use the DM search bar to find specific messages, users, or files within your direct message conversations.',
      'You can close a DM conversation to remove it from your sidebar without deleting the message history. Reopen it anytime from the user\'s profile.',
    ],
  },
  {
    id: 'server-discovery',
    title: 'Server Discovery',
    description: 'Find and join new communities on Gratonite.',
    category: 'Servers & Channels',
    body: [
      'Open the Discover page from the sidebar to browse public servers across all categories.',
      'Use search, category filters, and tags to narrow down servers that match your interests.',
      'Featured servers are highlighted at the top of Discover — these are highly rated communities curated by ratings and activity.',
      'Click any server card to see its description, member count, rating, and category before joining.',
      'Join a server directly from Discover with one click. You can leave at any time by right-clicking the server icon.',
    ],
  },
  {
    id: 'server-ratings-reviews',
    title: 'Server Ratings & Reviews',
    description: 'Rate servers and help the community find great portals.',
    category: 'Servers & Channels',
    body: [
      'Rate any server you\'ve joined by right-clicking its icon in the sidebar and selecting "Rate Portal".',
      'Choose a star rating from 1 to 5 and confirm. Your rating is anonymous and contributes to the server\'s average score.',
      'You can also rate servers from the FAME Dashboard\'s Server Ratings tab, which shows all discoverable servers.',
      'Servers with consistently high ratings are prioritized in the Discover Featured section, helping great communities grow.',
      'Update your rating at any time — your latest rating replaces your previous one.',
    ],
  },
  {
    id: 'themes-customization',
    title: 'Themes & Customization',
    description: 'Personalize your Gratonite experience with themes and display settings.',
    category: 'Getting Started',
    body: [
      'Navigate to Settings > Appearance to access all visual customization options.',
      'Choose from multiple built-in themes including dark, light, midnight, and community-created themes.',
      'Enable Glass Mode for a translucent, frosted-glass UI effect that shows your background media through panels.',
      'Toggle Compact Mode to reduce spacing and show more messages on screen — ideal for power users.',
      'Adjust font size, font family, and message display density to match your reading preference.',
    ],
  },
  {
    id: 'word-filters',
    title: 'Word Filters',
    description: 'Configure automated word filtering for your server.',
    category: 'Servers & Channels',
    body: [
      'Open Server Settings > Moderation > Word Filters to set up content filtering rules.',
      'Add words or phrases to the filter list. Each filter can be configured with a specific action: block, delete, or warn.',
      'Block prevents the message from being sent entirely. Delete removes it after sending. Warn sends a private notice to the user.',
      'Use wildcards to catch variations of filtered words — for example, filtering "spam*" catches "spam", "spammer", and "spamming".',
      'Exempt specific roles from word filters to allow moderators and trusted members to bypass filtering rules.',
    ],
  },
  {
    id: 'notification-preferences',
    title: 'Notification Preferences',
    description: 'Control how and when you receive notifications.',
    category: 'Account & Security',
    body: [
      'Set per-channel notification levels by right-clicking a channel and selecting "Notification Settings". Options include all messages, mentions only, or none.',
      'Mute specific users to suppress their messages from triggering notifications — go to Settings > Muted Users to manage your mute list.',
      'Enable web push notifications in Settings > Notifications to receive alerts even when Gratonite is not in the foreground.',
      'Clear all unread notifications for a server by right-clicking its icon and selecting "Mark as Read".',
      'Configure email notification preferences in Settings > Notifications > Email to control which events send emails.',
    ],
  },
  {
    id: 'rich-presence-status',
    title: 'Rich Presence & Status',
    description: 'Set custom status messages and activity displays.',
    category: 'Getting Started',
    body: [
      'Click your avatar in the sidebar to set your status: Online, Idle, Do Not Disturb, or Invisible.',
      'Set a custom status message with optional emoji that appears next to your name in member lists and profile popover.',
      'Rich Presence shows what you\'re currently doing — such as playing a game, listening to music, or coding — if the activity shares data with Gratonite.',
      'Custom statuses can have an expiration time — choose "Don\'t clear", "30 minutes", "1 hour", "4 hours", or "Today" when setting one.',
      'Your status syncs across all devices. Changing it on desktop immediately updates mobile and web sessions.',
    ],
  },
  {
    id: 'server-boosts',
    title: 'Server Boosts',
    description: 'Boost servers to unlock perks and support communities.',
    category: 'Servers & Channels',
    body: [
      'Boost a server by right-clicking its icon and selecting "Boost Portal". Each boost contributes to the server\'s boost level.',
      'Server boost levels unlock perks: higher upload limits, more emoji slots, improved audio quality, and a special boost badge.',
      'Boosters receive a unique badge next to their name in the boosted server and appear in the server\'s Boost tab.',
      'Boosting costs Gratonite currency, not real money — earn it through activity, FAME, and daily rewards.',
      'View a server\'s current boost level, perks, and contributors in Server Settings > Boosts.',
    ],
  },
  {
    id: 'data-export-privacy',
    title: 'Data Export & Privacy',
    description: 'Request your data export or account deletion.',
    category: 'Privacy & Safety',
    body: [
      'Request a full data export from Settings > Privacy & Safety > Request Data Export. Gratonite will compile all your data into a downloadable archive.',
      'Data exports include your messages, profile information, server memberships, uploads, and activity history in a machine-readable format.',
      'Exports are processed within 48 hours. You will receive a notification when your archive is ready to download.',
      'To request account deletion, go to Settings > Account > Delete Account. Your account enters a 30-day grace period before permanent deletion.',
      'During the grace period, you can cancel the deletion request by logging in and clicking "Cancel Deletion" on the warning banner.',
    ],
  },
  {
    id: 'federation',
    title: 'Federation',
    description: 'Connect with servers across federated Gratonite instances.',
    category: 'Servers & Channels',
    body: [
      'Federation allows separate Gratonite instances to share servers, enabling cross-instance communities.',
      'Browse federated servers from Discover > Federated tab to see servers hosted on other Gratonite instances.',
      'Join a federated server just like a local one — click "Join" and your account creates a federated membership automatically.',
      'Messages in federated servers are relayed between instances in real-time, so the experience feels seamless.',
      'Server admins can enable federation in Server Settings > Federation to make their server visible to other instances.',
    ],
  },
];
