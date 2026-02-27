import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { GratoniteGuysPackOpeningLab } from '@/components/gratoniteguys/GratoniteGuysPackOpeningLab';
import { GratoniteGuysNativeLab } from '@/components/gratoniteguys/GratoniteGuysNativeLab';
import manifest from '@/assets/gratoniteguys/element-run-03-manifest.json';
import mythicAliases from '@/assets/gratoniteguys/mythics-gif-aliases.json';

/* ---------- styles ---------- */

const styles = {
  page: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: 20,
    display: 'grid',
    alignContent: 'start',
    gap: 12,
  } as React.CSSProperties,
  hero: {
    display: 'grid',
    gap: 8,
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    borderRadius: 'var(--radius-xl)',
    padding: 16,
    background: 'radial-gradient(circle at 88% 8%, rgba(138, 123, 255, 0.08), transparent 38%), radial-gradient(circle at 15% 10%, rgba(121, 223, 255, 0.07), transparent 32%), rgba(10, 16, 28, 0.58)',
  } as React.CSSProperties,
  eyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-faint)',
  } as React.CSSProperties,
  title: {
    margin: 0,
    fontSize: 22,
    lineHeight: 1.15,
  } as React.CSSProperties,
  subtitle: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: 13,
    maxWidth: '70ch',
  } as React.CSSProperties,
  card: {
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    borderRadius: 'var(--radius-xl)',
    background: 'rgba(10, 16, 28, 0.48)',
    padding: 14,
    display: 'grid',
    gap: 10,
  } as React.CSSProperties,
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 10,
  } as React.CSSProperties,
  statsCell: {
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    borderRadius: 'var(--radius-lg)',
    background: 'rgba(255,255,255,0.02)',
    padding: 10,
    display: 'grid',
    gap: 5,
  } as React.CSSProperties,
  statsCellSpan: {
    fontSize: 11,
    color: 'var(--text-faint)',
  } as React.CSSProperties,
  statsCellStrong: {
    fontSize: 17,
    color: 'var(--text)',
  } as React.CSSProperties,
  note: {
    fontSize: 11,
    color: 'var(--text-faint)',
  } as React.CSSProperties,
  shopLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'start',
    borderRadius: 'var(--radius-pill)',
    border: '1px solid rgba(121, 223, 255, 0.24)',
    background: 'rgba(121, 223, 255, 0.08)',
    color: 'var(--text)',
    textDecoration: 'none',
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 600,
  } as React.CSSProperties,
};

export function GratoniteGuysLabPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.username === 'ferdinand' || user?.username === 'coodaye';

  if (!isAdmin) {
    return <Navigate to="/shop" replace />;
  }

  return (
    <div style={styles.page}>
      <header style={styles.hero}>
        <div style={styles.eyebrow}>GratoniteGuys</div>
        <h1 style={styles.title}>Pack Opening Lab</h1>
        <p style={styles.subtitle}>
          Prototype integration track for GratoniteGuys. This route is admin/dev gated while we convert the standalone
          prototype into production components.
        </p>
      </header>

      <section style={styles.card}>
        <h2>Imported Asset Inventory (element-run-03)</h2>
        <div style={styles.statsGrid}>
          <div style={styles.statsCell}><span style={styles.statsCellSpan}>Rarity PNGs</span><strong style={styles.statsCellStrong}>{manifest.summary.rarityPngCount}</strong></div>
          <div style={styles.statsCell}><span style={styles.statsCellSpan}>Mythic GIFs</span><strong style={styles.statsCellStrong}>{manifest.summary.mythicGifCount}</strong></div>
          <div style={styles.statsCell}><span style={styles.statsCellSpan}>Mythic MP4s</span><strong style={styles.statsCellStrong}>{manifest.summary.mythicMp4Count}</strong></div>
          <div style={styles.statsCell}><span style={styles.statsCellSpan}>GIF Alias IDs</span><strong style={styles.statsCellStrong}>{mythicAliases.items.length}</strong></div>
        </div>
        <p style={styles.note}>
          Manifest and normalized aliases were generated from <code>element-run-03</code> for app-side use.
        </p>
        <Link style={styles.shopLink} to="/shop">Back to Shop</Link>
      </section>

      <GratoniteGuysNativeLab />
      <GratoniteGuysPackOpeningLab />
    </div>
  );
}
