import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import appIcon from '@/assets/branding/gratonitepics-appicon-256.png';

const guides = [
  {
    id: 'getting-started',
    title: 'Getting Started on Gratonite',
    summary: 'Create an account, log in, join an invite, and find your way into your first portal quickly.',
    steps: [
      'Open the landing page and choose Create Account or Log In.',
      'If someone shared an invite link, open it directly and accept the invite.',
      'After login, start from the portal list/grid and select the portal you want to enter.',
      'Pick a text channel to chat or a voice channel to join instantly.',
    ],
  },
  {
    id: 'portals-and-channels',
    title: 'Portals, Channels, and Navigation',
    summary: 'How to move through portals, text channels, and voice channels without getting lost.',
    steps: [
      'Portals are your communities (similar to servers). Each portal contains channels.',
      'Text channels hold message history, images, and files.',
      'Voice channels are live hangout rooms with silent auto-join.',
      'Use Server Settings to manage portal profile, emojis, channel permissions, and roles/groups.',
    ],
  },
  {
    id: 'direct-messages',
    title: 'Direct Messages and Group Messaging',
    summary: 'Send DMs, upload images, use mentions, and watch typing indicators in realtime.',
    steps: [
      'Open the DMs area and select a conversation from the left panel.',
      'Type a message and use Enter or the Send button to deliver it.',
      'Use the upload button to attach an image before sending.',
      'Type @ to mention a user and select them from the autocomplete list.',
    ],
  },
  {
    id: 'voice-video',
    title: 'Voice, Video, and Screen Share',
    summary: 'Join voice rooms instantly, then turn camera and screen share on only when you choose.',
    steps: [
      'Click a voice channel to join silently (no loud incoming call UI).',
      'Your camera stays off by default until you press Camera.',
      'Use Screen Share to broadcast a screen or application into the call view.',
      'Open the Soundboard panel in supported voice channels for quick audio reactions.',
    ],
  },
  {
    id: 'notifications-and-status',
    title: 'Notifications, Sounds, and Status',
    summary: 'Control sound alerts and set your presence state for better focus and availability.',
    steps: [
      'Go to Settings > Notifications to adjust sound toggles and volumes.',
      'Set your status from the user menu: Online, Away, Do Not Disturb, or Offline.',
      'Mentions trigger notifications in channels, DMs, and group chats.',
      'Unread activity also updates the browser tab title for quick awareness.',
    ],
  },
  {
    id: 'reporting-bugs',
    title: 'How to Report Bugs During Beta',
    summary: 'Use the built-in bug report flow so issues land in the internal bug inbox with context.',
    steps: [
      'Click Report bug in the app top bar.',
      'Describe what happened, expected behavior, and steps to reproduce.',
      'Submit Report to send it to the internal bug inbox.',
      'Use Open GitHub Draft if you also want a public issue draft pre-filled.',
    ],
  },
];

/* ── shared tokens ── */
const borderSubtle = 'rgba(122, 144, 201, 0.14)';
const borderSubtle12 = 'rgba(122, 144, 201, 0.12)';
const borderSubtle10 = 'rgba(122, 144, 201, 0.1)';
const thinGlassBg = 'rgba(255, 255, 255, 0.02)';
const borderBlog = 'rgba(132, 157, 255, 0.14)';
const borderBlog12 = 'rgba(132, 157, 255, 0.12)';

const s = {
  page: {
    minHeight: '100%',
    position: 'relative',
    overflow: 'hidden',
    padding: '20px 20px 72px',
    background: `radial-gradient(1000px 700px at 12% -8%, rgba(91, 123, 255, 0.12), transparent 60%),
      radial-gradient(900px 620px at 88% 0%, rgba(215, 92, 255, 0.1), transparent 58%),
      linear-gradient(180deg, #060917 0%, #090d19 38%, #080c18 100%)`,
  } as React.CSSProperties,

  grid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `linear-gradient(rgba(122, 92, 255, 0.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(212, 175, 55, 0.035) 1px, transparent 1px)`,
    backgroundSize: '44px 44px',
    maskImage: 'radial-gradient(circle at 50% 25%, black 40%, transparent 100%)',
    opacity: 0.65,
    pointerEvents: 'none',
  } as React.CSSProperties,

  glow: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: '50%',
    filter: 'blur(64px)',
    opacity: 0.2,
    pointerEvents: 'none',
  } as React.CSSProperties,

  glowA: { top: 80, left: -60, background: 'rgba(212, 175, 55, 0.9)' } as React.CSSProperties,
  glowB: { right: -90, top: 120, background: 'rgba(155, 92, 255, 0.9)' } as React.CSSProperties,

  nav: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 1200,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 14px',
    border: `1px solid ${borderSubtle}`,
    borderRadius: 'var(--radius-lg)',
    background: 'linear-gradient(180deg, rgba(12, 17, 31, 0.78), rgba(10, 15, 28, 0.64))',
    backdropFilter: 'blur(16px) saturate(115%)',
    boxShadow: '0 10px 28px rgba(0, 0, 0, 0.2)',
  } as React.CSSProperties,

  brand: { display: 'inline-flex', alignItems: 'center', gap: 12 } as React.CSSProperties,
  brandLogo: {
    width: 48,
    height: 48,
    objectFit: 'contain',
    borderRadius: 'var(--radius-lg)',
    boxShadow: '0 0 22px rgba(212, 175, 55, 0.12)',
  } as React.CSSProperties,
  brandText: { display: 'flex', flexDirection: 'column', lineHeight: 1.05 } as React.CSSProperties,
  brandName: { fontWeight: 700, letterSpacing: '0.02em', color: 'var(--text)' } as React.CSSProperties,
  brandSub: { fontSize: '0.72rem', color: 'var(--text-faint)' } as React.CSSProperties,

  navActions: { display: 'inline-flex', alignItems: 'center', gap: 10 } as React.CSSProperties,

  navLink: {
    borderRadius: 10,
    padding: '9px 12px',
    fontWeight: 600,
    fontSize: '0.92rem',
    textDecoration: 'none',
    color: 'var(--text-muted)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
  } as React.CSSProperties,

  navCta: {
    borderRadius: 10,
    padding: '9px 12px',
    fontWeight: 600,
    fontSize: '0.92rem',
    textDecoration: 'none',
    color: '#071019',
    background: 'linear-gradient(135deg, #67dfff, #6b8dff 56%, #b26dff)',
    boxShadow: '0 10px 24px rgba(212, 175, 55, 0.16)',
  } as React.CSSProperties,

  section: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 1200,
    margin: '18px auto 0',
  } as React.CSSProperties,

  kicker: {
    color: '#8eefff',
    fontSize: '0.78rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
  } as React.CSSProperties,

  blogTitle: {
    margin: 0,
    fontSize: 'clamp(2rem, 4vw, 2.8rem)',
    lineHeight: 1.05,
    letterSpacing: '-0.02em',
  } as React.CSSProperties,

  sectionHeaderP: {
    marginTop: 10,
    color: 'var(--text-muted)',
    lineHeight: 1.65,
    maxWidth: '66ch',
  } as React.CSSProperties,

  cardGrid: {
    marginTop: 20,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 14,
  } as React.CSSProperties,

  guideCard: {
    display: 'grid',
    gap: 10,
    padding: 16,
    borderRadius: 'var(--radius-lg)',
    border: `1px solid ${borderBlog}`,
    background: `linear-gradient(180deg, rgba(24, 31, 51, 0.84), rgba(15, 20, 35, 0.88)),
      radial-gradient(circle at 10% 0%, rgba(92, 216, 255, 0.12), transparent 55%)`,
    color: 'inherit',
    textDecoration: 'none',
    transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
  } as React.CSSProperties,

  guideCardHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  } as React.CSSProperties,

  guideChip: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3px 8px',
    borderRadius: 'var(--radius-pill)',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    background: 'rgba(212, 175, 55, 0.08)',
    color: '#b9f3ff',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  } as React.CSSProperties,

  guideLink: { fontSize: 12, color: 'var(--text-faint)' } as React.CSSProperties,

  guideCardH3: { margin: 0, fontSize: 16, color: 'var(--text)' } as React.CSSProperties,
  guideCardP: { margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45 } as React.CSSProperties,

  guidesSection: { paddingTop: 12 } as React.CSSProperties,

  guideList: { display: 'grid', gap: 14 } as React.CSSProperties,

  guideArticle: {
    scrollMarginTop: 84,
    padding: '18px 18px 16px',
    borderRadius: 'var(--radius-lg)',
    border: `1px solid ${borderBlog12}`,
    background: 'rgba(16, 22, 36, 0.74)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.02)',
  } as React.CSSProperties,

  guideArticleH2: { margin: '4px 0 8px', fontSize: 20, color: 'var(--text)' } as React.CSSProperties,
  guideArticleP: { margin: 0, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 } as React.CSSProperties,

  guideSteps: {
    margin: '12px 0 0',
    paddingLeft: 18,
    display: 'grid',
    gap: 8,
  } as React.CSSProperties,

  guideStepLi: { color: 'var(--text)', lineHeight: 1.45 } as React.CSSProperties,

  sectionPanel: {
    border: `1px solid ${borderSubtle}`,
    borderRadius: 'var(--radius-xl)',
    background: 'linear-gradient(180deg, rgba(11, 16, 30, 0.68), rgba(9, 13, 24, 0.6))',
    backdropFilter: 'blur(16px) saturate(110%)',
    boxShadow: '0 16px 42px rgba(0, 0, 0, 0.22)',
    padding: 20,
  } as React.CSSProperties,

  finalCta: {
    display: 'grid',
    gridTemplateColumns: '1.1fr auto',
    gap: 20,
    alignItems: 'center',
    borderRadius: 'var(--radius-lg)',
    border: `1px solid ${borderSubtle12}`,
    background: `radial-gradient(420px 200px at 15% 10%, rgba(103, 223, 255, 0.08), transparent 75%),
      radial-gradient(380px 220px at 90% 20%, rgba(178, 109, 255, 0.08), transparent 75%),
      ${thinGlassBg}`,
    padding: 18,
  } as React.CSSProperties,

  finalCtaH2: {
    marginTop: 6,
    fontSize: 'clamp(1.25rem, 2.8vw, 1.9rem)',
    lineHeight: 1.08,
    letterSpacing: '-0.02em',
  } as React.CSSProperties,

  finalCtaP: { marginTop: 10, color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: '58ch' } as React.CSSProperties,

  finalActions: { display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' } as React.CSSProperties,

  btnPrimary: {
    borderRadius: 'var(--radius-lg)',
    padding: '12px 16px',
    fontWeight: 700,
    textDecoration: 'none',
    color: '#071019',
    background: 'linear-gradient(135deg, #67dfff, #6790ff 52%, #b26dff)',
    boxShadow: '0 12px 24px rgba(103, 144, 255, 0.18)',
  } as React.CSSProperties,

  btnSecondary: {
    borderRadius: 'var(--radius-lg)',
    padding: '12px 16px',
    fontWeight: 700,
    textDecoration: 'none',
    color: 'var(--text)',
    border: '1px solid rgba(122, 144, 201, 0.2)',
    background: 'rgba(255, 255, 255, 0.03)',
  } as React.CSSProperties,
};

export function BlogPage() {
  const [hoveredNavLink, setHoveredNavLink] = useState<string | null>(null);

  const navLinkStyle = (id: string): React.CSSProperties => ({
    ...s.navLink,
    ...(hoveredNavLink === id
      ? { color: 'var(--text)', background: 'rgba(255, 255, 255, 0.03)', borderColor: borderSubtle }
      : {}),
  });

  return (
    <main style={s.page}>
      <div style={s.grid} aria-hidden="true" />
      <div style={{ ...s.glow, ...s.glowA }} />
      <div style={{ ...s.glow, ...s.glowB }} />

      <header style={s.nav}>
        <div style={s.brand}>
          <img src={appIcon} alt="" style={s.brandLogo} />
          <div style={s.brandText}>
            <span style={s.brandName}>Gratonite</span>
            <span style={s.brandSub}>Blog &amp; Guides</span>
          </div>
        </div>
        <div style={s.navActions}>
          <Link
            to="/"
            style={navLinkStyle('home')}
            onMouseEnter={() => setHoveredNavLink('home')}
            onMouseLeave={() => setHoveredNavLink(null)}
          >
            Home
          </Link>
          <Link
            to="/"
            style={navLinkStyle('app')}
            onMouseEnter={() => setHoveredNavLink('app')}
            onMouseLeave={() => setHoveredNavLink(null)}
          >
            Open App
          </Link>
          <Link
            to="/login"
            style={navLinkStyle('login')}
            onMouseEnter={() => setHoveredNavLink('login')}
            onMouseLeave={() => setHoveredNavLink(null)}
          >
            Log In
          </Link>
          <Link to="/register" style={s.navCta}>Create Account</Link>
        </div>
      </header>

      <section style={{ ...s.section, paddingTop: 8 }}>
        <div>
          <p style={s.kicker}>Guides</p>
          <h1 style={s.blogTitle}>Product walkthroughs for the web beta</h1>
          <p style={s.sectionHeaderP}>
            This blog is the user-facing guide surface for Gratonite. It explains how to navigate the app,
            join portals, use messaging and voice, configure notifications, and report issues during beta.
          </p>
        </div>
        <div style={s.cardGrid}>
          {guides.map((guide) => (
            <a key={guide.id} href={`#${guide.id}`} style={s.guideCard}>
              <div style={s.guideCardHead}>
                <span style={s.guideChip}>Guide</span>
                <span style={s.guideLink}>Open</span>
              </div>
              <h3 style={s.guideCardH3}>{guide.title}</h3>
              <p style={s.guideCardP}>{guide.summary}</p>
            </a>
          ))}
        </div>
      </section>

      <section style={{ ...s.section, ...s.guidesSection }}>
        <div style={s.guideList}>
          {guides.map((guide) => (
            <article key={guide.id} id={guide.id} style={s.guideArticle}>
              <div>
                <p style={s.kicker}>Guide</p>
                <h2 style={s.guideArticleH2}>{guide.title}</h2>
                <p style={s.guideArticleP}>{guide.summary}</p>
              </div>
              <ol style={s.guideSteps}>
                {guide.steps.map((step) => (
                  <li key={step} style={s.guideStepLi}>{step}</li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>

      <section style={{ ...s.section, ...s.sectionPanel }}>
        <div style={s.finalCta}>
          <div>
            <p style={s.kicker}>Need more help?</p>
            <h2 style={s.finalCtaH2}>Use the built-in bug report button while testing</h2>
            <p style={s.finalCtaP}>
              The fastest way to report issues is the in-app Report bug modal, which captures route and device context automatically.
            </p>
          </div>
          <div style={s.finalActions}>
            <Link to="/" style={s.btnPrimary}>Open App</Link>
            <Link to="/" style={s.btnSecondary}>Back to Home</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
