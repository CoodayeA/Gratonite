import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGuildsStore } from '@/stores/guilds.store';
import { Button } from '@/components/ui/Button';
import { shouldEnableUiV2Tokens } from '@/theme/initTheme';
import { ServerGallery } from '@/components/home/ServerGallery';
import { useUiStore } from '@/stores/ui.store';

export function HomePage() {
  const uiV2TokensEnabled = shouldEnableUiV2Tokens();
  const guildCount = useGuildsStore((s) => s.guildOrder.length);
  const navigate = useNavigate();
  const location = useLocation();
  const openModal = useUiStore((s) => s.openModal);
  const portalsAnchorRef = useRef<HTMLDivElement | null>(null);
  function handleOpenDirectMessagesHub() {
    navigate('/notifications');
  }

  useEffect(() => {
    if (!location.hash) return;
    const target = location.hash === '#portals' ? portalsAnchorRef.current : null;
    if (!target) return;
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  }, [location.hash]);

  return (
    <div className="home-page">
      <div className={`home-content ${uiV2TokensEnabled ? 'home-content-v2' : ''}`}>
        <div id="portals" ref={portalsAnchorRef} className="home-anchor-target" />
        {uiV2TokensEnabled && <ServerGallery onOpenDirectMessages={handleOpenDirectMessagesHub} />}

        <div className="home-hero">
          <div>
            <h1 className="home-title">Home</h1>
            <p className="home-subtitle">
              {guildCount > 0
                ? 'Jump back into your portals, settings, and notifications.'
                : 'Join or create a portal to start building your space.'}
            </p>
          </div>
        </div>

        <section className="home-dashboard-tiles" aria-label="Quick actions">
          <button type="button" className="home-dashboard-tile" onClick={() => openModal('create-guild')}>
            <span className="home-dashboard-tile-eyebrow">Create</span>
            <span className="home-dashboard-tile-meta">{guildCount} portals active</span>
            <span className="home-dashboard-tile-title">Create a Portal</span>
            <span className="home-dashboard-tile-desc">Start a new community with starter channels and an invite link.</span>
          </button>
          <button type="button" className="home-dashboard-tile" onClick={() => navigate('/discover')}>
            <span className="home-dashboard-tile-eyebrow">Discover</span>
            <span className="home-dashboard-tile-meta">Portals • Bots • Themes</span>
            <span className="home-dashboard-tile-title">Find Portals</span>
            <span className="home-dashboard-tile-desc">Browse communities, bots, and themes in a streaming-style grid.</span>
          </button>
          <button type="button" className="home-dashboard-tile" onClick={() => navigate('/blog')}>
            <span className="home-dashboard-tile-eyebrow">Guide</span>
            <span className="home-dashboard-tile-meta">Navigation + feature guides</span>
            <span className="home-dashboard-tile-title">Gratonite Lounge</span>
            <span className="home-dashboard-tile-desc">Use the blog/guides hub for onboarding and product help while the official lounge is prepared.</span>
          </button>
          <button type="button" className="home-dashboard-tile" onClick={() => openModal('bug-report', { route: '/', channelLabel: 'Home' })}>
            <span className="home-dashboard-tile-eyebrow">Feedback</span>
            <span className="home-dashboard-tile-meta">Internal bug inbox connected</span>
            <span className="home-dashboard-tile-title">Give Feedback</span>
            <span className="home-dashboard-tile-desc">Send a bug report or product note directly to the internal bug inbox.</span>
          </button>
          <a className="home-dashboard-tile" href="https://gratonite.chat/blog" target="_blank" rel="noreferrer">
            <span className="home-dashboard-tile-eyebrow">Support</span>
            <span className="home-dashboard-tile-meta">Payments not live yet</span>
            <span className="home-dashboard-tile-title">Donate</span>
            <span className="home-dashboard-tile-desc">Donation flow placeholder. Link currently routes to project info until payment setup is added.</span>
          </a>
          <button type="button" className="home-dashboard-tile" onClick={() => navigate('/settings')}>
            <span className="home-dashboard-tile-eyebrow">Settings</span>
            <span className="home-dashboard-tile-meta">Appearance • Security • Notifications</span>
            <span className="home-dashboard-tile-title">Open Settings</span>
            <span className="home-dashboard-tile-desc">Manage profile, notifications, appearance, status, and accessibility controls.</span>
          </button>
        </section>

      </div>
    </div>
  );
}
