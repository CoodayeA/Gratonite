import React, { useMemo } from 'react';
import { useGratoniteGuysLab } from '@/hooks/useGratoniteGuysLab';
import { formatGuyDisplayName, getRarityMeta } from '@/lib/gratoniteguys';

/* ---------- styles ---------- */

const styles = {
  shell: {
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    borderRadius: 'var(--radius-xl)',
    background: 'rgba(10, 16, 28, 0.48)',
    padding: 14,
    display: 'grid',
    gap: 12,
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
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
    fontSize: 18,
  } as React.CSSProperties,
  subtitle: {
    marginTop: 4,
    color: 'var(--text-muted)',
    fontSize: 12,
    maxWidth: '72ch',
  } as React.CSSProperties,
  actions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  } as React.CSSProperties,
  shopLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'start',
    borderRadius: 'var(--radius-pill)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(121, 223, 255, 0.24)',
    background: 'rgba(121, 223, 255, 0.08)',
    color: 'var(--text)',
    textDecoration: 'none',
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  shopLinkMuted: {
    borderColor: 'color-mix(in srgb, var(--stroke) 88%, transparent)',
    background: 'rgba(255, 255, 255, 0.03)',
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: '360px minmax(0, 1fr)',
    gap: 12,
  } as React.CSSProperties,
  panel: {
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    borderRadius: 'var(--radius-lg)',
    background: 'rgba(255,255,255,0.02)',
    padding: 12,
    display: 'grid',
    gap: 10,
  } as React.CSSProperties,
  panelH3: {
    margin: 0,
    fontSize: 14,
  } as React.CSSProperties,
  currencyRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  } as React.CSSProperties,
  currency: {
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 'var(--radius-lg)',
    padding: 10,
    background: 'rgba(255,255,255,0.02)',
    display: 'grid',
    gap: 5,
  } as React.CSSProperties,
  currencySpan: {
    fontSize: 11,
    color: 'var(--text-faint)',
  } as React.CSSProperties,
  currencyStrong: {
    fontSize: 18,
    color: 'var(--text)',
  } as React.CSSProperties,
  collectionRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  } as React.CSSProperties,
  collectionCell: {
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 8,
    background: 'rgba(255,255,255,0.015)',
    display: 'grid',
    gap: 4,
  } as React.CSSProperties,
  collectionSpan: {
    fontSize: 10,
    color: 'var(--text-faint)',
  } as React.CSSProperties,
  collectionStrong: {
    fontSize: 13,
  } as React.CSSProperties,
  openBtn: {
    borderRadius: 'var(--radius-lg)',
    border: '1px solid rgba(121, 223, 255, 0.26)',
    background: 'linear-gradient(180deg, rgba(121,223,255,0.1), rgba(138,123,255,0.06)), rgba(10, 16, 28, 0.72)',
    color: 'var(--text)',
    fontWeight: 700,
    fontSize: 13,
    padding: '10px 12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  hint: {
    color: 'var(--text-faint)',
    fontSize: 11,
    lineHeight: 1.4,
  } as React.CSSProperties,
  revealPanel: {
    alignContent: 'start',
  } as React.CSSProperties,
  revealCard: {
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    borderRadius: 'var(--radius-lg)',
    padding: 12,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02), 0 8px 24px rgba(0,0,0,0.18)',
    display: 'grid',
    gap: 10,
  } as React.CSSProperties,
  revealTop: {
    display: 'grid',
    gridTemplateColumns: '48px minmax(0, 1fr) auto',
    gap: 10,
    alignItems: 'center',
  } as React.CSSProperties,
  revealSymbol: {
    width: 48,
    height: 48,
    borderRadius: 'var(--radius-lg)',
    display: 'grid',
    placeItems: 'center',
    fontSize: 18,
    fontWeight: 800,
    color: 'var(--text)',
  } as React.CSSProperties,
  revealCopy: {
    minWidth: 0,
    display: 'grid',
    gap: 4,
  } as React.CSSProperties,
  revealName: {
    fontWeight: 700,
    fontSize: 14,
    color: 'var(--text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,
  revealMeta: {
    color: 'var(--text-muted)',
    fontSize: 11,
  } as React.CSSProperties,
  statusPill: {
    borderRadius: 'var(--radius-pill)',
    padding: '5px 8px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.08)',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text)',
    background: 'rgba(255,255,255,0.03)',
  } as React.CSSProperties,
  statusPillNew: {
    borderColor: 'rgba(74, 222, 128, 0.22)',
    background: 'rgba(74, 222, 128, 0.08)',
  } as React.CSSProperties,
  statusPillDupe: {
    borderColor: 'rgba(245, 158, 11, 0.22)',
    background: 'rgba(245, 158, 11, 0.08)',
  } as React.CSSProperties,
  revealPath: {
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.015)',
    padding: '8px 10px',
    color: 'var(--text-faint)',
    fontSize: 11,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    wordBreak: 'break-all',
  } as React.CSSProperties,
  revealBottom: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    color: 'var(--text-muted)',
    fontSize: 11,
  } as React.CSSProperties,
  empty: {
    minHeight: 140,
    border: '1px dashed rgba(255,255,255,0.08)',
    borderRadius: 'var(--radius-lg)',
    background: 'rgba(255,255,255,0.015)',
    display: 'grid',
    alignContent: 'center',
    justifyItems: 'center',
    gap: 6,
    textAlign: 'center',
    padding: 12,
  } as React.CSSProperties,
  emptyCompact: {
    minHeight: 72,
  } as React.CSSProperties,
  emptyStrong: {
    color: 'var(--text)',
    fontSize: 13,
  } as React.CSSProperties,
  emptySpan: {
    color: 'var(--text-muted)',
    fontSize: 12,
  } as React.CSSProperties,
  recentList: {
    display: 'grid',
    gap: 8,
  } as React.CSSProperties,
  recentRow: {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr) auto auto',
    gap: 8,
    alignItems: 'center',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.05)',
    background: 'rgba(255,255,255,0.015)',
    padding: '7px 8px',
  } as React.CSSProperties,
  recentDot: {
    width: 8,
    height: 8,
    borderRadius: 'var(--radius-pill)',
  } as React.CSSProperties,
  recentLabel: {
    minWidth: 0,
    color: 'var(--text)',
    fontSize: 12,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,
  recentRarity: {
    color: 'var(--text-faint)',
    fontSize: 11,
  } as React.CSSProperties,
  recentStatus: {
    color: 'var(--text-faint)',
    fontSize: 11,
    fontWeight: 700,
  } as React.CSSProperties,
  recentStatusNew: {
    color: '#86efac',
  } as React.CSSProperties,
  recentStatusDupe: {
    color: '#fcd34d',
  } as React.CSSProperties,
};

export function GratoniteGuysNativeLab() {
  const {
    dust,
    coins,
    recent,
    lastResult,
    uniqueCount,
    totalOwned,
    duplicateCount,
    openOne,
    resetProgress,
    grantCoins,
    canOpen,
    openCost,
  } = useGratoniteGuysLab();

  const lastRarity = lastResult ? getRarityMeta(lastResult.entry.rarity) : null;
  const collectionPercent = useMemo(() => Math.round((uniqueCount / 640) * 1000) / 10, [uniqueCount]);

  return (
    <section style={styles.shell}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Native React Extraction</div>
          <h2 style={styles.title}>GratoniteGuys MVP State + Reveal Card</h2>
          <p style={styles.subtitle}>
            Native pack roll logic, collection tracking, dust rewards, and reveal UI extracted from the prototype path.
          </p>
        </div>
        <div style={styles.actions}>
          <button type="button" style={styles.shopLink} onClick={() => grantCoins(1000)}>+1,000 Coins</button>
          <button type="button" style={{ ...styles.shopLink, ...styles.shopLinkMuted }} onClick={resetProgress}>Reset Native Progress</button>
        </div>
      </header>

      <div style={styles.grid}>
        <section style={styles.panel}>
          <h3 style={styles.panelH3}>Capsule Control</h3>
          <div style={styles.currencyRow}>
            <div style={styles.currency}>
              <span style={styles.currencySpan}>Coins</span>
              <strong style={styles.currencyStrong}>{coins.toLocaleString()}</strong>
            </div>
            <div style={styles.currency}>
              <span style={styles.currencySpan}>Dust</span>
              <strong style={styles.currencyStrong}>{dust.toLocaleString()}</strong>
            </div>
          </div>
          <div style={styles.collectionRow}>
            <div style={styles.collectionCell}><span style={styles.collectionSpan}>Unique</span><strong style={styles.collectionStrong}>{uniqueCount} / 640</strong></div>
            <div style={styles.collectionCell}><span style={styles.collectionSpan}>Total Owned</span><strong style={styles.collectionStrong}>{totalOwned}</strong></div>
            <div style={styles.collectionCell}><span style={styles.collectionSpan}>Duplicates</span><strong style={styles.collectionStrong}>{duplicateCount}</strong></div>
            <div style={styles.collectionCell}><span style={styles.collectionSpan}>Completion</span><strong style={styles.collectionStrong}>{collectionPercent}%</strong></div>
          </div>
          <button
            type="button"
            style={{
              ...styles.openBtn,
              ...(!canOpen ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
            }}
            onClick={() => openOne()}
            disabled={!canOpen}
          >
            Open GratoPod ({openCost} coins)
          </button>
          {!canOpen && (
            <p style={styles.hint}>Not enough coins. Use the coin grant button in the lab while we build economy flows.</p>
          )}
        </section>

        <section style={{ ...styles.panel, ...styles.revealPanel }}>
          <h3 style={styles.panelH3}>Reveal Card (Native)</h3>
          {lastResult ? (
            <div
              style={{
                ...styles.revealCard,
                background: `radial-gradient(circle at 90% 8%, color-mix(in srgb, ${lastRarity?.color ?? '#8B90B0'} 20%, transparent), transparent 42%), radial-gradient(circle at 10% 0%, ${lastRarity?.glow ?? 'rgba(139,144,176,0.25)'}, transparent 36%), rgba(8, 12, 22, 0.62)`,
              }}
            >
              <div style={styles.revealTop}>
                <div style={{
                  ...styles.revealSymbol,
                  border: `1px solid color-mix(in srgb, ${lastRarity?.color ?? '#8B90B0'} 50%, rgba(255,255,255,0.1))`,
                  background: `color-mix(in srgb, ${lastRarity?.color ?? '#8B90B0'} 18%, rgba(8,12,22,0.8))`,
                }}>{lastResult.entry.symbol}</div>
                <div style={styles.revealCopy}>
                  <div style={styles.revealName}>{formatGuyDisplayName(lastResult.entry)}</div>
                  <div style={styles.revealMeta}>
                    #{String(lastResult.entry.elementNumber).padStart(3, '0')} • {lastRarity?.label ?? lastResult.entry.rarity}
                  </div>
                </div>
                <div style={{
                  ...styles.statusPill,
                  ...(lastResult.isDuplicate ? styles.statusPillDupe : styles.statusPillNew),
                }}>
                  {lastResult.isDuplicate ? 'Duplicate' : 'New'}
                </div>
              </div>
              <div style={styles.revealPath}>{lastResult.entry.relativePath}</div>
              <div style={styles.revealBottom}>
                <span>Count owned: {lastResult.duplicateCountAfter}</span>
                <span>{lastResult.dustAwarded > 0 ? `+${lastResult.dustAwarded} dust` : 'No dust (new pull)'}</span>
              </div>
            </div>
          ) : (
            <div style={styles.empty}>
              <strong style={styles.emptyStrong}>No reveal yet</strong>
              <span style={styles.emptySpan}>Open a GratoPod to generate a native React reveal result.</span>
            </div>
          )}
        </section>
      </div>

      <section style={styles.panel}>
        <h3 style={styles.panelH3}>Recent Native Results</h3>
        {recent.length === 0 ? (
          <div style={{ ...styles.empty, ...styles.emptyCompact }}>
            <span style={styles.emptySpan}>No native results yet.</span>
          </div>
        ) : (
          <div style={styles.recentList}>
            {recent.map((result, idx) => {
              const rarity = getRarityMeta(result.entry.rarity);
              return (
                <div key={`${result.entry.rarity}-${result.entry.elementNumber}-${idx}`} style={styles.recentRow}>
                  <span
                    style={{ ...styles.recentDot, background: rarity?.color ?? '#8B90B0', boxShadow: `0 0 10px ${rarity?.glow ?? 'rgba(139,144,176,0.25)'}` }}
                  />
                  <span style={styles.recentLabel}>
                    {result.entry.symbol} · {formatGuyDisplayName(result.entry)}
                  </span>
                  <span style={styles.recentRarity}>{rarity?.label ?? result.entry.rarity}</span>
                  <span style={{
                    ...styles.recentStatus,
                    ...(result.isDuplicate ? styles.recentStatusDupe : styles.recentStatusNew),
                  }}>
                    {result.isDuplicate ? 'Dupe' : 'New'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
