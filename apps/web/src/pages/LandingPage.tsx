import React, { useState } from 'react';
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

/* ── shared border/glass tokens ── */
const borderSubtle = 'rgba(122, 144, 201, 0.14)';
const borderSubtle12 = 'rgba(122, 144, 201, 0.12)';
const borderSubtle10 = 'rgba(122, 144, 201, 0.1)';
const glassBg = 'linear-gradient(180deg, rgba(13, 19, 35, 0.72), rgba(10, 15, 28, 0.64))';
const thinGlassBg = 'rgba(255, 255, 255, 0.02)';
const thinGlassBg015 = 'rgba(255, 255, 255, 0.015)';

const s = {
  page: {
    minHeight: '100%',
    position: 'relative',
    overflow: 'hidden',
    padding: '20px 20px 56px',
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

  navLinkBase: {
    borderRadius: 10,
    padding: '9px 12px',
    fontWeight: 600,
    fontSize: '0.92rem',
    textDecoration: 'none',
  } as React.CSSProperties,

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

  hero: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 1200,
    margin: '18px auto 0',
    display: 'grid',
    gridTemplateColumns: '1.05fr 0.95fr',
    gap: 24,
    alignItems: 'stretch',
  } as React.CSSProperties,

  heroCopy: {
    border: `1px solid ${borderSubtle}`,
    borderRadius: 'var(--radius-xl)',
    background: glassBg,
    backdropFilter: 'blur(20px) saturate(115%)',
    boxShadow: '0 18px 48px rgba(0, 0, 0, 0.28)',
    padding: '28px 28px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  } as React.CSSProperties,

  kicker: {
    color: '#8eefff',
    fontSize: '0.78rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
  } as React.CSSProperties,

  h1: {
    fontSize: 'clamp(2rem, 5vw, 3.25rem)',
    lineHeight: 0.98,
    letterSpacing: '-0.03em',
    maxWidth: '13ch',
  } as React.CSSProperties,

  subtitle: { color: 'var(--text-muted)', maxWidth: '58ch', lineHeight: 1.65 } as React.CSSProperties,

  ctaRow: { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 } as React.CSSProperties,

  btnPrimary: {
    borderRadius: 'var(--radius-lg)',
    padding: '12px 16px',
    fontWeight: 700,
    textDecoration: 'none',
    color: '#071019',
    background: 'linear-gradient(135deg, #67dfff, #6790ff 52%, #b26dff)',
    boxShadow: '0 12px 24px rgba(103, 144, 255, 0.18)',
    transition: 'transform 140ms ease',
  } as React.CSSProperties,

  btnSecondary: {
    borderRadius: 'var(--radius-lg)',
    padding: '12px 16px',
    fontWeight: 700,
    textDecoration: 'none',
    color: 'var(--text)',
    border: '1px solid rgba(122, 144, 201, 0.2)',
    background: 'rgba(255, 255, 255, 0.03)',
    transition: 'transform 140ms ease, border-color 140ms ease, background 140ms ease',
  } as React.CSSProperties,

  statRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 10,
    marginTop: 'auto',
    paddingTop: 8,
  } as React.CSSProperties,

  stat: {
    borderRadius: 'var(--radius-lg)',
    border: `1px solid ${borderSubtle12}`,
    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.015))',
    padding: 12,
  } as React.CSSProperties,

  statSpan: {
    display: 'block',
    fontSize: '0.72rem',
    color: 'var(--text-faint)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  } as React.CSSProperties,

  statStrong: { display: 'block', marginTop: 4, fontSize: '0.95rem' } as React.CSSProperties,

  previewShell: {
    border: `1px solid ${borderSubtle}`,
    borderRadius: 'var(--radius-xl)',
    background: glassBg,
    backdropFilter: 'blur(20px) saturate(115%)',
    boxShadow: '0 18px 48px rgba(0, 0, 0, 0.28)',
    overflow: 'hidden',
  } as React.CSSProperties,

  previewTopbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 14px',
    borderBottom: `1px solid ${borderSubtle12}`,
    background: thinGlassBg,
  } as React.CSSProperties,

  dot: { width: 8, height: 8, borderRadius: '50%', opacity: 0.95 } as React.CSSProperties,
  dotRed: { background: '#ff6b6b' } as React.CSSProperties,
  dotGold: { background: '#ffcf6a' } as React.CSSProperties,
  dotGreen: { background: '#79f0bb' } as React.CSSProperties,

  previewTitle: { marginLeft: 6, color: 'var(--text-muted)', fontSize: '0.88rem' } as React.CSSProperties,

  previewToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 14px 6px',
    flexWrap: 'wrap',
  } as React.CSSProperties,

  filterPill: {
    borderRadius: 'var(--radius-pill)',
    padding: '6px 10px',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    border: `1px solid ${borderSubtle12}`,
    background: thinGlassBg,
  } as React.CSSProperties,

  filterPillActive: {
    borderRadius: 'var(--radius-pill)',
    padding: '6px 10px',
    fontSize: '0.75rem',
    color: 'var(--text)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(212, 175, 55, 0.2)',
    background: 'rgba(212, 175, 55, 0.06)',
  } as React.CSSProperties,

  previewSearch: {
    borderRadius: 'var(--radius-pill)',
    padding: '6px 10px',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    border: `1px solid ${borderSubtle12}`,
    background: thinGlassBg,
    marginLeft: 'auto',
    minWidth: 140,
    textAlign: 'left',
  } as React.CSSProperties,

  previewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
    padding: '8px 14px 14px',
  } as React.CSSProperties,

  portalCard: {
    borderRadius: 'var(--radius-lg)',
    border: `1px solid ${borderSubtle}`,
    background: `linear-gradient(180deg, ${thinGlassBg}, ${thinGlassBg015})`,
    overflow: 'hidden',
    transition: 'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
  } as React.CSSProperties,

  portalBanner: {
    position: 'relative',
    height: 92,
    padding: 10,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    background: `radial-gradient(180px 100px at 20% 20%, rgba(212, 175, 55, 0.22), transparent 70%),
      radial-gradient(160px 110px at 82% 20%, rgba(178, 109, 255, 0.2), transparent 70%),
      linear-gradient(150deg, rgba(103, 144, 255, 0.12), rgba(255, 255, 255, 0.01))`,
  } as React.CSSProperties,

  portalChip: {
    borderRadius: 'var(--radius-pill)',
    padding: '5px 8px',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: 'var(--text)',
    background: 'rgba(7, 10, 18, 0.44)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  } as React.CSSProperties,

  portalHover: {
    alignSelf: 'flex-end',
    maxWidth: '60%',
    borderRadius: 10,
    padding: '5px 8px',
    fontSize: '0.7rem',
    color: 'rgba(241, 246, 255, 0.84)',
    background: 'rgba(7, 10, 18, 0.46)',
    border: `1px solid ${borderSubtle}`,
    opacity: 0.88,
  } as React.CSSProperties,

  portalMeta: { padding: 12 } as React.CSSProperties,
  portalMetaH3: { fontSize: '0.95rem' } as React.CSSProperties,
  portalMetaP: { color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 2 } as React.CSSProperties,

  previewFooter: {
    borderTop: `1px solid ${borderSubtle10}`,
    padding: '10px 14px 14px',
  } as React.CSSProperties,

  previewCallout: {
    borderRadius: 10,
    border: `1px solid ${borderSubtle12}`,
    background: thinGlassBg,
    padding: '10px 12px',
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
    lineHeight: 1.45,
  } as React.CSSProperties,

  section: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 1200,
    margin: '18px auto 0',
  } as React.CSSProperties,

  sectionPanel: {
    border: `1px solid ${borderSubtle}`,
    borderRadius: 'var(--radius-xl)',
    background: 'linear-gradient(180deg, rgba(11, 16, 30, 0.68), rgba(9, 13, 24, 0.6))',
    backdropFilter: 'blur(16px) saturate(110%)',
    boxShadow: '0 16px 42px rgba(0, 0, 0, 0.22)',
  } as React.CSSProperties,

  sectionFeatures: { padding: 22 } as React.CSSProperties,
  sectionRoadmap: { padding: 20 } as React.CSSProperties,
  sectionCta: { padding: 20 } as React.CSSProperties,

  sectionHeaderH2: {
    fontSize: 'clamp(1.4rem, 3vw, 2.15rem)',
    lineHeight: 1.05,
    letterSpacing: '-0.02em',
    marginTop: 6,
  } as React.CSSProperties,

  sectionHeaderP: {
    marginTop: 10,
    color: 'var(--text-muted)',
    lineHeight: 1.65,
    maxWidth: '66ch',
  } as React.CSSProperties,

  featureGrid: {
    marginTop: 18,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 12,
  } as React.CSSProperties,

  featureCard: {
    position: 'relative',
    borderRadius: 'var(--radius-lg)',
    border: `1px solid ${borderSubtle12}`,
    background: thinGlassBg,
    padding: 14,
    transition: 'transform 160ms ease, border-color 160ms ease, background 160ms ease',
  } as React.CSSProperties,

  featureLine: {
    width: 48,
    height: 2,
    borderRadius: 'var(--radius-pill)',
    background: 'linear-gradient(90deg, #67dfff, #6b8dff, #b26dff)',
    marginBottom: 10,
    opacity: 0.8,
  } as React.CSSProperties,

  featureCardH3: { fontSize: '0.98rem', lineHeight: 1.2 } as React.CSSProperties,
  featureCardP: { marginTop: 8, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.55 } as React.CSSProperties,

  roadmapShell: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.05fr',
    gap: 16,
  } as React.CSSProperties,

  roadmapCopy: {
    borderRadius: 'var(--radius-lg)',
    border: `1px solid ${borderSubtle12}`,
    background: thinGlassBg,
    padding: 16,
  } as React.CSSProperties,

  roadmapCopyH2: {
    marginTop: 6,
    fontSize: 'clamp(1.35rem, 2.8vw, 2rem)',
    lineHeight: 1.05,
    letterSpacing: '-0.02em',
  } as React.CSSProperties,

  roadmapCopyP: { marginTop: 10, color: 'var(--text-muted)', lineHeight: 1.65 } as React.CSSProperties,

  checklist: { listStyle: 'none', marginTop: 14, display: 'grid', gap: 8, padding: 0 } as React.CSSProperties,

  checklistLi: {
    position: 'relative',
    padding: '9px 10px 9px 28px',
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: `${borderSubtle10}`,
    background: thinGlassBg015,
    fontSize: '0.88rem',
    color: 'var(--text)',
  } as React.CSSProperties,

  checklistDot: {
    content: '""',
    position: 'absolute',
    left: 10,
    top: '50%',
    width: 8,
    height: 8,
    borderRadius: '50%',
    transform: 'translateY(-50%)',
    background: 'linear-gradient(135deg, #67dfff, #b26dff)',
    boxShadow: '0 0 12px rgba(103, 223, 255, 0.35)',
  } as React.CSSProperties,

  roadmapPanel: {
    borderRadius: 'var(--radius-lg)',
    border: `1px solid ${borderSubtle12}`,
    background: thinGlassBg,
    padding: 16,
  } as React.CSSProperties,

  roadmapPanelTitle: {
    fontSize: '0.86rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontWeight: 700,
  } as React.CSSProperties,

  roadmapTrack: { marginTop: 12, display: 'grid', gap: 10 } as React.CSSProperties,

  roadmapStep: {
    display: 'grid',
    gridTemplateColumns: '44px 1fr',
    gap: 10,
    borderRadius: 'var(--radius-lg)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: `${borderSubtle10}`,
    background: thinGlassBg015,
    padding: 10,
  } as React.CSSProperties,

  roadmapStepDone: {
    borderColor: 'rgba(103, 223, 255, 0.16)',
    background: 'rgba(103, 223, 255, 0.04)',
  } as React.CSSProperties,

  roadmapStepActive: {
    borderColor: 'rgba(178, 109, 255, 0.2)',
    background: 'linear-gradient(180deg, rgba(178, 109, 255, 0.06), rgba(103, 144, 255, 0.04))',
    boxShadow: 'inset 0 0 0 1px rgba(178, 109, 255, 0.08)',
  } as React.CSSProperties,

  stepIndex: {
    display: 'grid',
    placeItems: 'center',
    width: 34,
    height: 34,
    borderRadius: 10,
    border: `1px solid ${borderSubtle12}`,
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: 700,
  } as React.CSSProperties,

  roadmapStepStrong: { display: 'block', fontSize: '0.92rem', lineHeight: 1.25 } as React.CSSProperties,
  roadmapStepP: { marginTop: 4, color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.45 } as React.CSSProperties,

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

  footer: {
    padding: 18,
    border: `1px solid ${borderSubtle12}`,
    borderRadius: 'var(--radius-xl)',
    background: 'linear-gradient(180deg, rgba(10, 14, 26, 0.64), rgba(8, 12, 22, 0.56))',
    backdropFilter: 'blur(14px) saturate(110%)',
    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.18)',
  } as React.CSSProperties,

  footerShell: {
    display: 'grid',
    gridTemplateColumns: '1.15fr 1fr',
    gap: 18,
    alignItems: 'start',
  } as React.CSSProperties,

  footerBrand: {
    display: 'grid',
    gridTemplateColumns: '56px 1fr',
    gap: 12,
    alignItems: 'start',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: `${borderSubtle10}`,
    borderRadius: 'var(--radius-lg)',
    background: thinGlassBg,
    padding: 14,
  } as React.CSSProperties,

  footerLogo: {
    width: 80,
    height: 80,
    borderRadius: 'var(--radius-xl)',
    objectFit: 'contain',
    boxShadow: '0 0 20px rgba(103, 144, 255, 0.12)',
  } as React.CSSProperties,

  footerBrandH3: { fontSize: '1rem', lineHeight: 1.1 } as React.CSSProperties,
  footerBrandP: { marginTop: 8, color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '0.9rem', maxWidth: '52ch' } as React.CSSProperties,

  footerLinks: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 10,
  } as React.CSSProperties,

  footerGroup: {
    display: 'grid',
    alignContent: 'start',
    gap: 8,
    borderRadius: 'var(--radius-lg)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: `${borderSubtle10}`,
    background: thinGlassBg,
    padding: 12,
  } as React.CSSProperties,

  footerTitle: {
    color: 'var(--text-faint)',
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    fontWeight: 700,
    marginBottom: 2,
  } as React.CSSProperties,

  footerLink: {
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontSize: '0.86rem',
    lineHeight: 1.35,
  } as React.CSSProperties,
};

export function LandingPage() {
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
            <span style={s.brandSub}>Community platform</span>
          </div>
        </div>
        <div style={s.navActions}>
          <Link
            to="/blog"
            style={navLinkStyle('blog')}
            onMouseEnter={() => setHoveredNavLink('blog')}
            onMouseLeave={() => setHoveredNavLink(null)}
          >
            Blog
          </Link>
          <Link
            to="/app"
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
          <Link to="/register" style={s.navCta}>
            Create Account
          </Link>
        </div>
      </header>

      <section style={s.hero}>
        <div style={s.heroCopy}>
          <p style={s.kicker}>Web beta &bull; Portal-first community chat</p>
          <h1 style={s.h1}>Build communities that feel designed, not generic.</h1>
          <p style={s.subtitle}>
            Gratonite is a realtime communication platform focused on visual portal discovery,
            customizable user identity, and low-friction voice rooms. The current beta is web-first,
            with desktop and mobile planned in the same design language.
          </p>
          <div style={s.ctaRow}>
            <Link to="/register" style={s.btnPrimary}>
              Create Free Account
            </Link>
            <Link to="/login" style={s.btnSecondary}>
              Sign In
            </Link>
          </div>
          <div style={s.statRow}>
            <div style={s.stat}>
              <span style={s.statSpan}>Focus</span>
              <strong style={s.statStrong}>Web beta readiness</strong>
            </div>
            <div style={s.stat}>
              <span style={s.statSpan}>Core UX</span>
              <strong style={s.statStrong}>Portals + voice + media</strong>
            </div>
            <div style={s.stat}>
              <span style={s.statSpan}>Direction</span>
              <strong style={s.statStrong}>Customization-led platform</strong>
            </div>
          </div>
        </div>

        <div style={s.previewShell}>
          <div style={s.previewTopbar}>
            <span style={{ ...s.dot, ...s.dotRed }} />
            <span style={{ ...s.dot, ...s.dotGold }} />
            <span style={{ ...s.dot, ...s.dotGreen }} />
            <span style={s.previewTitle}>Portal Gallery</span>
          </div>

          <div style={s.previewToolbar}>
            <div style={s.filterPillActive}>Recommended</div>
            <div style={s.filterPill}>Recent</div>
            <div style={s.filterPill}>Favorites</div>
            <div style={s.previewSearch}>Search portals</div>
          </div>

          <div style={s.previewGrid} role="presentation">
            {previewPortals.map((portal) => (
              <article key={portal.name} style={s.portalCard}>
                <div style={s.portalBanner}>
                  <span style={s.portalChip}>{portal.category}</span>
                  <span style={s.portalHover}>{portal.activity}</span>
                </div>
                <div style={s.portalMeta}>
                  <h3 style={s.portalMetaH3}>{portal.name}</h3>
                  <p style={s.portalMetaP}>{portal.members} members</p>
                </div>
              </article>
            ))}
          </div>

          <div style={s.previewFooter}>
            <div style={s.previewCallout}>
              Voice channels join silently. Camera and screen share are available inside the room.
            </div>
          </div>
        </div>
      </section>

      <section style={{ ...s.section, ...s.sectionPanel, ...s.sectionFeatures }}>
        <div>
          <p style={s.kicker}>Product direction</p>
          <h2 style={s.sectionHeaderH2}>Designed around community identity and realtime flow</h2>
          <p style={s.sectionHeaderP}>
            The product vision is not another clone with a different color palette. The goal is to
            make community spaces feel personal, expressive, and easier to navigate.
          </p>
        </div>
        <div style={s.featureGrid}>
          {productPillars.map((pillar) => (
            <article key={pillar.title} style={s.featureCard}>
              <div style={s.featureLine} />
              <h3 style={s.featureCardH3}>{pillar.title}</h3>
              <p style={s.featureCardP}>{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ ...s.section, ...s.sectionPanel, ...s.sectionRoadmap }}>
        <div style={s.roadmapShell}>
          <div style={s.roadmapCopy}>
            <p style={s.kicker}>Current rollout</p>
            <h2 style={s.roadmapCopyH2}>Shipping the web experience first</h2>
            <p style={s.roadmapCopyP}>
              We are prioritizing a stable web launch with strong messaging, media, and voice flows,
              then extending the same design system and interaction patterns to desktop and mobile.
            </p>
            <ul style={s.checklist}>
              {rolloutChecklist.map((item) => (
                <li key={item} style={s.checklistLi}>
                  <span style={s.checklistDot} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div style={s.roadmapPanel}>
            <div style={s.roadmapPanelTitle}>Customization roadmap</div>
            <div style={s.roadmapTrack}>
              <div style={{ ...s.roadmapStep, ...s.roadmapStepDone }}>
                <span style={s.stepIndex}>01</span>
                <div>
                  <strong style={s.roadmapStepStrong}>Display styles and profile cosmetics</strong>
                  <p style={s.roadmapStepP}>Fonts, effects, colors, nameplates, profile effects</p>
                </div>
              </div>
              <div style={{ ...s.roadmapStep, ...s.roadmapStepActive }}>
                <span style={s.stepIndex}>02</span>
                <div>
                  <strong style={s.roadmapStepStrong}>Portal customization and sharing</strong>
                  <p style={s.roadmapStepP}>Banner-driven discovery, layout polish, server identity upgrades</p>
                </div>
              </div>
              <div style={s.roadmapStep}>
                <span style={s.stepIndex}>03</span>
                <div>
                  <strong style={s.roadmapStepStrong}>Creator marketplace and community items</strong>
                  <p style={s.roadmapStepP}>User-submitted cosmetics and shop moderation pipeline</p>
                </div>
              </div>
              <div style={s.roadmapStep}>
                <span style={s.stepIndex}>04</span>
                <div>
                  <strong style={s.roadmapStepStrong}>Advanced avatar systems</strong>
                  <p style={s.roadmapStepP}>Expanded avatar creation and chat presence surfaces</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ ...s.section, ...s.sectionPanel, ...s.sectionCta }}>
        <div style={s.finalCta}>
          <div>
            <p style={s.kicker}>Join the beta</p>
            <h2 style={s.finalCtaH2}>Start with the web app and help shape the platform</h2>
            <p style={s.finalCtaP}>
              Create an account, build your first portal, and test the current realtime chat, media,
              and voice experience while the desktop and mobile clients follow.
            </p>
          </div>
          <div style={s.finalActions}>
            <Link to="/blog" style={s.btnSecondary}>
              Read Guides
            </Link>
            <Link to="/register" style={s.btnPrimary}>
              Create Account
            </Link>
            <Link to="/login" style={s.btnSecondary}>
              Sign In
            </Link>
          </div>
        </div>
      </section>

      <footer style={{ ...s.section, ...s.footer }}>
        <div style={s.footerShell}>
          <div style={s.footerBrand}>
            <img src={appIcon} alt="" style={s.footerLogo} />
            <div>
              <h3 style={s.footerBrandH3}>Gratonite</h3>
              <p style={s.footerBrandP}>
                Portal-first community platform focused on realtime communication, identity
                customization, and a stronger visual experience across web, desktop, and mobile.
              </p>
            </div>
          </div>

          <div style={s.footerLinks}>
            <div style={s.footerGroup}>
              <div style={s.footerTitle}>Product</div>
              <Link to="/app" style={s.footerLink}>Open App</Link>
              <Link to="/blog" style={s.footerLink}>Blog &amp; Guides</Link>
              <Link to="/register" style={s.footerLink}>Create Account</Link>
              <Link to="/login" style={s.footerLink}>Log In</Link>
            </div>

            <div style={s.footerGroup}>
              <div style={s.footerTitle}>Resources</div>
              {resourceLinks.map((link) => (
                <a key={link.label} href={link.href} target="_blank" rel="noreferrer" style={s.footerLink}>
                  {link.label}
                </a>
              ))}
            </div>

            <div style={s.footerGroup}>
              <div style={s.footerTitle}>Domains</div>
              <a href="https://gratonite.chat" target="_blank" rel="noreferrer" style={s.footerLink}>
                gratonite.chat
              </a>
              <a href="https://gratonite.com" target="_blank" rel="noreferrer" style={s.footerLink}>
                gratonite.com
              </a>
              <a href="https://gratonitechat.com" target="_blank" rel="noreferrer" style={s.footerLink}>
                gratonitechat.com
              </a>
              <a href="https://api.gratonite.chat" target="_blank" rel="noreferrer" style={s.footerLink}>
                api.gratonite.chat
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
