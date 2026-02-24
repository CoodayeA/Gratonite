import { useMemo, type CSSProperties } from 'react';
import { useGratoniteGuysLab } from '@/hooks/useGratoniteGuysLab';
import { formatGuyDisplayName, getRarityMeta } from '@/lib/gratoniteguys';

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
    <section className="gg-native-shell">
      <header className="gg-native-header">
        <div>
          <div className="shop-eyebrow">Native React Extraction</div>
          <h2 className="gg-native-title">GratoniteGuys MVP State + Reveal Card</h2>
          <p className="gg-native-subtitle">
            Native pack roll logic, collection tracking, dust rewards, and reveal UI extracted from the prototype path.
          </p>
        </div>
        <div className="gg-native-actions">
          <button type="button" className="shop-link" onClick={() => grantCoins(1000)}>+1,000 Coins</button>
          <button type="button" className="shop-link shop-link-muted" onClick={resetProgress}>Reset Native Progress</button>
        </div>
      </header>

      <div className="gg-native-grid">
        <section className="gg-native-panel">
          <h3>Capsule Control</h3>
          <div className="gg-native-currency-row">
            <div className="gg-native-currency">
              <span>Coins</span>
              <strong>{coins.toLocaleString()}</strong>
            </div>
            <div className="gg-native-currency">
              <span>Dust</span>
              <strong>{dust.toLocaleString()}</strong>
            </div>
          </div>
          <div className="gg-native-collection-row">
            <div><span>Unique</span><strong>{uniqueCount} / 640</strong></div>
            <div><span>Total Owned</span><strong>{totalOwned}</strong></div>
            <div><span>Duplicates</span><strong>{duplicateCount}</strong></div>
            <div><span>Completion</span><strong>{collectionPercent}%</strong></div>
          </div>
          <button
            type="button"
            className="gg-native-open-btn"
            onClick={() => openOne()}
            disabled={!canOpen}
          >
            Open GratoPod ({openCost} coins)
          </button>
          {!canOpen && (
            <p className="gg-native-hint">Not enough coins. Use the coin grant button in the lab while we build economy flows.</p>
          )}
        </section>

        <section className="gg-native-panel gg-native-reveal-panel">
          <h3>Reveal Card (Native)</h3>
          {lastResult ? (
            <div
              className={`gg-native-reveal-card rarity-${lastResult.entry.rarity}`}
              style={
                {
                  ['--gg-rarity-color' as string]: lastRarity?.color ?? '#8B90B0',
                  ['--gg-rarity-glow' as string]: lastRarity?.glow ?? 'rgba(139,144,176,0.25)',
                } as CSSProperties
              }
            >
              <div className="gg-native-reveal-top">
                <div className="gg-native-reveal-symbol">{lastResult.entry.symbol}</div>
                <div className="gg-native-reveal-copy">
                  <div className="gg-native-reveal-name">{formatGuyDisplayName(lastResult.entry)}</div>
                  <div className="gg-native-reveal-meta">
                    #{String(lastResult.entry.elementNumber).padStart(3, '0')} • {lastRarity?.label ?? lastResult.entry.rarity}
                  </div>
                </div>
                <div className={`gg-native-status-pill ${lastResult.isDuplicate ? 'is-dupe' : 'is-new'}`}>
                  {lastResult.isDuplicate ? 'Duplicate' : 'New'}
                </div>
              </div>
              <div className="gg-native-reveal-path">{lastResult.entry.relativePath}</div>
              <div className="gg-native-reveal-bottom">
                <span>Count owned: {lastResult.duplicateCountAfter}</span>
                <span>{lastResult.dustAwarded > 0 ? `+${lastResult.dustAwarded} dust` : 'No dust (new pull)'}</span>
              </div>
            </div>
          ) : (
            <div className="gg-native-empty">
              <strong>No reveal yet</strong>
              <span>Open a GratoPod to generate a native React reveal result.</span>
            </div>
          )}
        </section>
      </div>

      <section className="gg-native-panel">
        <h3>Recent Native Results</h3>
        {recent.length === 0 ? (
          <div className="gg-native-empty compact">
            <span>No native results yet.</span>
          </div>
        ) : (
          <div className="gg-native-recent-list">
            {recent.map((result, idx) => {
              const rarity = getRarityMeta(result.entry.rarity);
              return (
                <div key={`${result.entry.rarity}-${result.entry.elementNumber}-${idx}`} className="gg-native-recent-row">
                  <span
                    className="gg-native-recent-dot"
                    style={{ background: rarity?.color ?? '#8B90B0', boxShadow: `0 0 10px ${rarity?.glow ?? 'rgba(139,144,176,0.25)'}` }}
                  />
                  <span className="gg-native-recent-label">
                    {result.entry.symbol} · {formatGuyDisplayName(result.entry)}
                  </span>
                  <span className="gg-native-recent-rarity">{rarity?.label ?? result.entry.rarity}</span>
                  <span className={`gg-native-recent-status ${result.isDuplicate ? 'is-dupe' : 'is-new'}`}>
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
