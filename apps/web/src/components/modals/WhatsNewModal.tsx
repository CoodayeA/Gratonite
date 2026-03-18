import { useEffect } from 'react';
import { X, Sparkles, Zap, Shield, Bug } from 'lucide-react';


interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  entries: Array<{
    type: 'feature' | 'improvement' | 'fix' | 'security';
    text: string;
  }>;
}

const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-03-18e',
    date: 'March 18, 2026',
    title: 'Auth Redesign & Desktop Polish B',
    entries: [
      { type: 'feature', text: 'Auth screen redesign — beautiful new login and register pages with pattern backgrounds, floating stars, mascot logo, pill badges, rainbow strip, and stagger animations' },
      { type: 'improvement', text: 'Desktop splash screen — branded loading screen replaces blank window on startup' },
      { type: 'improvement', text: 'Desktop error recovery — friendly retry page shown when the app fails to load instead of a white screen' },
      { type: 'feature', text: 'OS accent color sync — desktop app picks up your system accent color automatically' },
      { type: 'feature', text: 'Taskbar upload progress — file uploads show progress on the Windows taskbar icon' },
    ],
  },
  {
    id: '2026-03-18d',
    date: 'March 18, 2026',
    title: 'Desktop App Polish',
    entries: [
      { type: 'fix', text: 'Windows: window is now draggable — guild rail top area acts as drag handle' },
      { type: 'fix', text: 'Eliminated theme/color flash on desktop startup — background matches instantly' },
      { type: 'improvement', text: 'Windows title bar overlay color now syncs when you change themes' },
      { type: 'improvement', text: 'Loading state shows subtle "G" watermark while app initializes' },
      { type: 'fix', text: 'Ctrl+R no longer accidentally reloads the desktop app in production' },
    ],
  },
  {
    id: '2026-03-18c',
    date: 'March 2026',
    title: 'Wave 5: Deep Polish',
    entries: [
      { type: 'feature', text: '@Mentions now display usernames — typing @ and selecting a user shows @username in the input instead of raw IDs' },
      { type: 'fix', text: 'Sidebar customization actually works — reordering sidebar sections (Navigation, DMs, Voice) now visually takes effect' },
      { type: 'improvement', text: '40+ UI/UX improvements — better button states, loading indicators, error feedback, hover effects, and mobile padding' },
      { type: 'improvement', text: 'Better error feedback — silent failures now show user-friendly error toasts across the app' },
      { type: 'fix', text: 'Fixed stale state in Gacha, calendar color caching, and improved error handling throughout' },
    ],
  },
  {
    id: '2026-03-18b',
    date: 'March 18, 2026',
    title: 'Wave 4: Hardening & Accessibility',
    entries: [
      { type: 'improvement', text: 'Confirmation dialogs on destructive actions — prevent accidental deletes and kicks' },
      { type: 'security', text: 'Security hardening across API calls — removed raw fetch usage and private token access' },
      { type: 'improvement', text: 'Improved error feedback — actions that previously failed silently now show clear error toasts' },
      { type: 'improvement', text: 'Accessibility labels added to settings buttons and interactive controls' },
    ],
  },
  {
    id: '2026-03-18',
    date: 'March 18, 2026',
    title: 'Deep Polish Wave 2',
    entries: [
      { type: 'security', text: 'Stage sessions now verify channel access — no more unauthorized stage creation' },
      { type: 'security', text: 'WebRTC signaling rate-limited to prevent flood attacks (60/10s per connection)' },
      { type: 'fix', text: 'Theme reports and ratings now prevent duplicate submissions per user' },
      { type: 'improvement', text: 'User profile "More" menu now works — Block, Report, and Copy User ID actions' },
      { type: 'improvement', text: 'Mute/unmute actions show success and error feedback toasts' },
      { type: 'fix', text: '"View Full Profile" on friends page now opens the actual profile modal' },
      { type: 'fix', text: 'Shop nameplate preview shows your real username instead of placeholder' },
      { type: 'improvement', text: 'Replaced 266 inline hover style mutations with CSS classes across 24 components for smoother transitions' },
      { type: 'fix', text: 'Error toasts added for note saving, nameplate applying, and other user actions that previously failed silently' },
    ],
  },
  {
    id: '2026-03-15b',
    date: 'March 15, 2026',
    title: 'Batch 3: 25 New Features',
    entries: [
      { type: 'feature', text: 'LaTeX/KaTeX math rendering — inline $e=mc^2$ and block $$\\int$$ formulas in messages' },
      { type: 'feature', text: 'Markdown tables — pipe-delimited tables render as formatted HTML tables' },
      { type: 'feature', text: 'Mermaid diagram rendering — flowcharts, sequence diagrams, and Gantt charts in ```mermaid code blocks' },
      { type: 'feature', text: 'Image editor — crop, rotate, draw arrows/shapes, add text, and blur regions before sending images' },
      { type: 'feature', text: 'Video trimmer — select start/end points to trim videos before uploading' },
      { type: 'feature', text: 'Advanced server analytics — member growth charts, activity heatmaps, channel comparisons, CSV export' },
      { type: 'feature', text: 'Moderation analytics — mod action trends, top reported users, moderator workload distribution' },
      { type: 'feature', text: 'GitHub link unfurling — auto-expand GitHub PRs, issues, commits into rich embeds' },
      { type: 'feature', text: 'RSS feed channels — auto-post new items from RSS/Atom feeds as rich embeds' },
      { type: 'feature', text: 'Google Calendar sync — two-way sync between server events and Google Calendar' },
      { type: 'feature', text: 'Real-time collaborative documents — Yjs-powered multi-user editing with live cursors' },
      { type: 'feature', text: 'Full i18n — 200+ translated strings across 9 locales (EN, ES, FR, DE, PT, JA, ZH, KO, AR)' },
      { type: 'feature', text: 'RTL layout support — proper right-to-left rendering for Arabic, Hebrew, and Persian' },
      { type: 'feature', text: 'Per-server profiles — different display name, avatar, and bio per server' },
      { type: 'feature', text: 'Disappearing messages cleanup — automated deletion of expired messages with WebSocket sync' },
      { type: 'feature', text: 'DND schedule — automatic Do Not Disturb by time and day with timezone support' },
      { type: 'feature', text: 'Threaded conversations in DMs — branch DM conversations into sub-topics' },
      { type: 'feature', text: 'Cross-server unified inbox — single view of all unreads, mentions, and replies across servers' },
      { type: 'feature', text: 'Message snippets — save and reuse text snippets with /snippet command' },
      { type: 'feature', text: 'Inline message translation — one-click translate via LibreTranslate' },
      { type: 'feature', text: 'Desktop global hotkeys — configurable shortcuts for mute, deafen, DND, and more' },
      { type: 'feature', text: 'Desktop system tray — unread badge, quick actions, minimize-to-tray' },
      { type: 'feature', text: 'Client-side plugin SDK — sandboxed JavaScript plugins with custom renderers and sidebar panels' },
      { type: 'improvement', text: 'WCAG 2.1 AA compliance — skip navigation, focus indicators, ARIA labels, color contrast' },
      { type: 'improvement', text: 'Full keyboard navigation — arrow keys for lists, roving tabindex, visible focus system' },
    ],
  },
  {
    id: '2026-03-15',
    date: 'March 15, 2026',
    title: '20 New Features Drop',
    entries: [
      { type: 'feature', text: 'Proximity Voice Rooms — walk around a 2D space, voice adjusts by distance like Gather.town' },
      { type: 'feature', text: 'Live Co-Presence — see who else is viewing the same channel with live avatar indicators' },
      { type: 'feature', text: 'Voice Clips — record and share 5-60s clips from voice channels, or clip the last 30s retroactively' },
      { type: 'feature', text: 'Ephemeral Voice Pods — instant temporary voice rooms, auto-delete when everyone leaves' },
      { type: 'feature', text: 'Voice Reactions — tap audio emoji (applause, airhorn, drum roll) during voice calls without unmuting' },
      { type: 'feature', text: 'Shared Focus Timers — collaborative Pomodoro sessions with synced work/break phases' },
      { type: 'feature', text: 'Channel Bookmarks Bar — pin links, files, and messages at the top of any channel' },
      { type: 'feature', text: 'Interactive Messages — buttons, dropdowns, carousels, accordions, and progress bars in messages' },
      { type: 'feature', text: 'Multi-Account Switching — add multiple accounts and switch instantly without logging out' },
      { type: 'feature', text: 'Server Digest — auto-generated weekly newsletter with top messages, stats, and highlights' },
      { type: 'feature', text: 'Screen Recording to Chat — record your screen and post directly as a video message' },
      { type: 'feature', text: 'Thread Dashboard — birds-eye view of all active threads across a server' },
      { type: 'feature', text: 'Custom Notification Sounds — upload your own sounds or pick from 10 built-in options per event type' },
      { type: 'feature', text: 'Ambient Co-Working Spaces — themed rooms (coffee shop, rain, forest) for silent co-working' },
      { type: 'feature', text: 'P2P File Sharing — send files directly via WebRTC, never touches the server, up to 2GB' },
      { type: 'feature', text: 'Server Status Page — monitor bot and webhook health with uptime history' },
      { type: 'feature', text: 'Schedule Calendar — visual calendar of all your scheduled messages across servers' },
      { type: 'feature', text: 'Shared Reading Lists — curated link collections per channel with upvotes and read tracking' },
      { type: 'feature', text: 'Reaction Roles Builder — visual drag-and-drop builder, no bot commands needed' },
      { type: 'feature', text: 'Cross-Server Channel Following — follow announcement channels from other servers' },
      { type: 'security', text: 'Guild membership verification on all new endpoints' },
      { type: 'security', text: 'P2P signaling restricted to users who share a guild or DM' },
    ],
  },
  {
    id: '2026-03-10',
    date: 'March 10, 2026',
    title: 'Theme System Overhaul',
    entries: [
      { type: 'feature', text: 'Complete theme system rebuild with live preview, preset themes, and custom theme builder' },
      { type: 'feature', text: 'Per-server theme overrides — set a unique look for each guild' },
      { type: 'feature', text: 'Theme marketplace — publish, browse, and install community themes' },
      { type: 'improvement', text: 'CSS variable-driven theming — all UI elements now respect your theme' },
      { type: 'improvement', text: 'Smooth theme transitions with View Transitions API support' },
      { type: 'improvement', text: 'Theme-aware embeds, toasts, and notification styling' },
      { type: 'improvement', text: 'Keyboard shortcut Ctrl+Shift+T to quickly open the theme picker' },
      { type: 'fix', text: 'Fixed theme persistence across sessions and page refreshes' },
    ],
  },
  {
    id: '2026-03-04',
    date: 'March 4, 2026',
    title: 'Productivity & Quality of Life',
    entries: [
      { type: 'feature', text: 'Real-time guild/channel updates without page refresh' },
      { type: 'feature', text: 'Task boards (Kanban) in channels' },
      { type: 'feature', text: 'Server wiki for persistent knowledge bases' },
      { type: 'feature', text: 'Community wall for shared expression' },
      { type: 'feature', text: 'File cabinet — browse all server files' },
      { type: 'feature', text: 'Message scheduling UI' },
      { type: 'feature', text: 'Advanced search filters (date, author, type)' },
      { type: 'feature', text: 'Server achievements and badges' },
      { type: 'feature', text: 'Form builder for applications and surveys' },
      { type: 'improvement', text: 'Full mobile web support with bottom nav' },
      { type: 'improvement', text: 'Code-split bundle for faster loading' },
      { type: 'improvement', text: 'Collapsible sidebar categories' },
      { type: 'improvement', text: 'Double-click to quick-react with heart' },
      { type: 'improvement', text: 'Smooth scroll-to-bottom in chat' },
      { type: 'improvement', text: 'High contrast and color-blind themes' },
      { type: 'improvement', text: 'Streamer mode for privacy' },
      { type: 'improvement', text: 'Bookmark folders and tags' },
      { type: 'security', text: 'SQL injection fix in analytics' },
      { type: 'security', text: 'File upload whitelist (default-deny)' },
      { type: 'security', text: 'Rate limits on search and auth endpoints' },
      { type: 'security', text: 'MFA backup code salting' },
      { type: 'fix', text: 'Database indexes for faster queries' },
      { type: 'fix', text: 'Leaderboard caching and pagination' },
      { type: 'fix', text: 'Accessibility: focus indicators, skip links, ARIA labels' },
    ],
  },
];

const TYPE_ICONS = {
  feature: Sparkles,
  improvement: Zap,
  fix: Bug,
  security: Shield,
};

const TYPE_COLORS = {
  feature: '#6366f1',
  improvement: '#22c55e',
  fix: '#f59e0b',
  security: '#ef4444',
};

export default function WhatsNewModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    localStorage.setItem('gratonite:last-seen-changelog', CHANGELOG[0]?.id ?? '');
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" style={{ width: 500, maxWidth: '95vw', maxHeight: '80vh', overflow: 'auto', padding: 24, background: 'var(--bg-elevated)', borderRadius: 16, border: '1px solid var(--stroke)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={22} style={{ color: '#6366f1' }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>What's New</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}><X size={20} /></button>
        </div>
        {CHANGELOG.map(release => (
          <div key={release.id} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{release.title}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{release.date}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {release.entries.map((entry, i) => {
                const Icon = TYPE_ICONS[entry.type];
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'start', gap: 8, padding: '6px 0' }}>
                    <Icon size={14} style={{ color: TYPE_COLORS[entry.type], marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{entry.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
