import { Link } from 'react-router-dom';
import appIcon from '@/assets/branding/gratonitepics-appicon-256.png';

const previewPortals = [
  { name: 'Night Raid', category: 'Gaming', members: '2.1k', activity: 'Voice live now' },
  { name: 'Study Harbor', category: 'Study', members: '864', activity: 'Focus rooms active' },
  { name: 'Plant Pals', category: 'Chill', members: '1.4k', activity: 'Photo channel trending' },
  { name: 'Creator Lab', category: 'Build', members: '593', activity: 'Markdown docs shared' },
];

const productPillars = [
  {
    title: 'Portal-first navigation',
    body: 'Browse communities from a visual grid instead of a tiny icon rail. Faster scanning, better identity, less friction for new users.',
  },
  {
    title: 'Realtime chat, media, and voice',
    body: 'Messaging, typing, uploads, and voice join flows are built around low-friction realtime behavior with a web-first beta hardening pass.',
  },
  {
    title: 'Deep identity customization',
    body: 'Profiles, display styles, avatar systems, cosmetics, and community-driven items are core product direction, not add-ons.',
  },
];

const rolloutChecklist = [
  'Web beta rollout first',
  'Desktop stabilization next',
  'Mobile polish after web parity',
  'Creator customization marketplace roadmap',
];

const resourceLinks = [
  { label: 'GitHub Repository', href: 'https://github.com/AlexandeCo/gratonite' },
  { label: 'GitHub Org', href: 'https://github.com/orgs/gratonitechat/repositories' },
  { label: 'Report Bug (GitHub)', href: 'https://github.com/AlexandeCo/gratonite/issues/new' },
  { label: 'Architecture', href: 'https://github.com/AlexandeCo/gratonite/blob/main/ARCHITECTURE.md' },
  { label: 'Progress', href: 'https://github.com/AlexandeCo/gratonite/blob/main/PROGRESS.md' },
  { label: 'Main Domain', href: 'https://gratonite.chat' },
  { label: 'API Status', href: 'https://api.gratonite.chat/health' },
];

export function LandingPage() {
  return (
    <main className="landing-page">
      <div className="landing-grid" aria-hidden="true" />
      <div className="landing-glow landing-glow-a" />
      <div className="landing-glow landing-glow-b" />

      <header className="landing-nav">
        <div className="landing-brand">
          <img src={appIcon} alt="" className="landing-brand-logo" />
          <div className="landing-brand-text">
            <span className="landing-brand-name">Gratonite</span>
            <span className="landing-brand-sub">Community platform</span>
          </div>
        </div>
        <div className="landing-nav-actions">
          <Link to="/blog" className="landing-nav-link">
            Blog
          </Link>
          <Link to="/app" className="landing-nav-link">
            Open App
          </Link>
          <Link to="/login" className="landing-nav-link">
            Log In
          </Link>
          <Link to="/register" className="landing-nav-cta">
            Create Account
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-kicker">Web beta • Portal-first community chat</p>
          <h1>Build communities that feel designed, not generic.</h1>
          <p className="landing-subtitle">
            Gratonite is a realtime communication platform focused on visual portal discovery,
            customizable user identity, and low-friction voice rooms. The current beta is web-first,
            with desktop and mobile planned in the same design language.
          </p>
          <div className="landing-cta-row">
            <Link to="/register" className="landing-btn-primary">
              Create Free Account
            </Link>
            <Link to="/login" className="landing-btn-secondary">
              Sign In
            </Link>
          </div>
          <div className="landing-stat-row">
            <div className="landing-stat">
              <span>Focus</span>
              <strong>Web beta readiness</strong>
            </div>
            <div className="landing-stat">
              <span>Core UX</span>
              <strong>Portals + voice + media</strong>
            </div>
            <div className="landing-stat">
              <span>Direction</span>
              <strong>Customization-led platform</strong>
            </div>
          </div>
        </div>

        <div className="landing-preview-shell">
          <div className="landing-preview-topbar">
            <span className="landing-window-dot red" />
            <span className="landing-window-dot gold" />
            <span className="landing-window-dot green" />
            <span className="landing-preview-title">Portal Gallery</span>
          </div>

          <div className="landing-preview-toolbar">
            <div className="landing-filter-pill active">Recommended</div>
            <div className="landing-filter-pill">Recent</div>
            <div className="landing-filter-pill">Favorites</div>
            <div className="landing-preview-search">Search portals</div>
          </div>

          <div className="landing-preview-grid" role="presentation">
            {previewPortals.map((portal) => (
              <article key={portal.name} className="landing-portal-card">
                <div className="landing-portal-banner">
                  <span className="landing-portal-chip">{portal.category}</span>
                  <span className="landing-portal-hover">{portal.activity}</span>
                </div>
                <div className="landing-portal-meta">
                  <h3>{portal.name}</h3>
                  <p>{portal.members} members</p>
                </div>
              </article>
            ))}
          </div>

          <div className="landing-preview-footer">
            <div className="landing-preview-callout">
              Voice channels join silently. Camera and screen share are available inside the room.
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-features">
        <div className="landing-section-header">
          <p className="landing-kicker">Product direction</p>
          <h2>Designed around community identity and realtime flow</h2>
          <p>
            The product vision is not another clone with a different color palette. The goal is to
            make community spaces feel personal, expressive, and easier to navigate.
          </p>
        </div>
        <div className="landing-feature-grid">
          {productPillars.map((pillar) => (
            <article key={pillar.title} className="landing-feature-card">
              <div className="landing-feature-line" />
              <h3>{pillar.title}</h3>
              <p>{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-section-roadmap">
        <div className="landing-roadmap-shell">
          <div className="landing-roadmap-copy">
            <p className="landing-kicker">Current rollout</p>
            <h2>Shipping the web experience first</h2>
            <p>
              We are prioritizing a stable web launch with strong messaging, media, and voice flows,
              then extending the same design system and interaction patterns to desktop and mobile.
            </p>
            <ul className="landing-checklist">
              {rolloutChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="landing-roadmap-panel">
            <div className="landing-roadmap-panel-title">Customization roadmap</div>
            <div className="landing-roadmap-track">
              <div className="landing-roadmap-step done">
                <span className="step-index">01</span>
                <div>
                  <strong>Display styles and profile cosmetics</strong>
                  <p>Fonts, effects, colors, nameplates, profile effects</p>
                </div>
              </div>
              <div className="landing-roadmap-step active">
                <span className="step-index">02</span>
                <div>
                  <strong>Portal customization and sharing</strong>
                  <p>Banner-driven discovery, layout polish, server identity upgrades</p>
                </div>
              </div>
              <div className="landing-roadmap-step">
                <span className="step-index">03</span>
                <div>
                  <strong>Creator marketplace and community items</strong>
                  <p>User-submitted cosmetics and shop moderation pipeline</p>
                </div>
              </div>
              <div className="landing-roadmap-step">
                <span className="step-index">04</span>
                <div>
                  <strong>Advanced avatar systems</strong>
                  <p>Expanded avatar creation and chat presence surfaces</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-cta">
        <div className="landing-final-cta">
          <div>
            <p className="landing-kicker">Join the beta</p>
            <h2>Start with the web app and help shape the platform</h2>
            <p>
              Create an account, build your first portal, and test the current realtime chat, media,
              and voice experience while the desktop and mobile clients follow.
            </p>
          </div>
          <div className="landing-final-actions">
            <Link to="/blog" className="landing-btn-secondary">
              Read Guides
            </Link>
            <Link to="/register" className="landing-btn-primary">
              Create Account
            </Link>
            <Link to="/login" className="landing-btn-secondary">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      <footer className="landing-section landing-section-footer">
        <div className="landing-footer-shell">
          <div className="landing-footer-brand">
            <img src={appIcon} alt="" className="landing-footer-logo" />
            <div>
              <h3>Gratonite</h3>
              <p>
                Portal-first community platform focused on realtime communication, identity
                customization, and a stronger visual experience across web, desktop, and mobile.
              </p>
            </div>
          </div>

          <div className="landing-footer-links">
            <div className="landing-footer-group">
              <div className="landing-footer-title">Product</div>
              <Link to="/app">Open App</Link>
              <Link to="/blog">Blog & Guides</Link>
              <Link to="/register">Create Account</Link>
              <Link to="/login">Log In</Link>
            </div>

            <div className="landing-footer-group">
              <div className="landing-footer-title">Resources</div>
              {resourceLinks.map((link) => (
                <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              ))}
            </div>

            <div className="landing-footer-group">
              <div className="landing-footer-title">Domains</div>
              <a href="https://gratonite.chat" target="_blank" rel="noreferrer">
                gratonite.chat
              </a>
              <a href="https://gratonite.com" target="_blank" rel="noreferrer">
                gratonite.com
              </a>
              <a href="https://gratonitechat.com" target="_blank" rel="noreferrer">
                gratonitechat.com
              </a>
              <a href="https://api.gratonite.chat" target="_blank" rel="noreferrer">
                api.gratonite.chat
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
