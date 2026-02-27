import React, { useEffect, useMemo, useState } from 'react';

interface Props {
  className?: string;
}

function buildPrototypeSrcDoc(html: string) {
  return html
    .replaceAll('gratonite_collection', 'gratonite_guys_collection')
    .replaceAll('gratonite_dust', 'gratonite_guys_dust')
    .replaceAll('<title>Gratonite Pack Opening v9</title>', '<title>GratoniteGuys Pack Opening Lab</title>');
}

/* ---------- styles ---------- */

const styles = {
  shell: {
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    borderRadius: 'var(--radius-xl)',
    background: 'rgba(10, 16, 28, 0.48)',
    display: 'grid',
    gap: 12,
    padding: 14,
  } as React.CSSProperties,
  header: {
    display: 'flex',
    gap: 12,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
    border: '1px solid rgba(121, 223, 255, 0.24)',
    background: 'rgba(121, 223, 255, 0.08)',
    color: 'var(--text)',
    textDecoration: 'none',
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  frameWrap: {
    minHeight: 720,
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    background: 'rgba(5, 8, 14, 0.8)',
  } as React.CSSProperties,
  frame: {
    width: '100%',
    minHeight: 720,
    height: 'min(1100px, 78vh)',
    border: 0,
    display: 'block',
    background: '#03060d',
  } as React.CSSProperties,
  loadState: {
    minHeight: 720,
    display: 'grid',
    alignContent: 'center',
    justifyItems: 'center',
    gap: 8,
    padding: 24,
    textAlign: 'center',
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  loadStateStrong: {
    color: 'var(--text)',
    fontSize: 14,
  } as React.CSSProperties,
  loadStateSpan: {
    fontSize: 12,
  } as React.CSSProperties,
};

export function GratoniteGuysPackOpeningLab({ className }: Props) {
  const [reloadKey, setReloadKey] = useState(0);
  const [rawHtml, setRawHtml] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    fetch('/gratoniteguys/prototypes/pack-opening-v9_2.html')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load prototype (${res.status})`);
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setRawHtml(text);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load prototype');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const srcDoc = useMemo(() => (rawHtml ? buildPrototypeSrcDoc(rawHtml) : ''), [rawHtml]);

  return (
    <section style={styles.shell}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>GratoniteGuys Lab</div>
          <h2 style={styles.title}>Pack Opening Prototype (v9.2)</h2>
          <p style={styles.subtitle}>
            Embedded prototype extracted from the standalone HTML. Local storage is namespaced for safe in-app testing.
          </p>
        </div>
        <div style={styles.actions}>
          <button type="button" style={styles.shopLink} onClick={() => setReloadKey((k) => k + 1)}>
            Reload Prototype
          </button>
        </div>
      </header>
      <div style={styles.frameWrap}>
        {loadError ? (
          <div style={styles.loadState}>
            <strong style={styles.loadStateStrong}>Prototype Load Failed</strong>
            <span style={styles.loadStateSpan}>{loadError}</span>
          </div>
        ) : !srcDoc ? (
          <div style={styles.loadState}>
            <strong style={styles.loadStateStrong}>Loading Prototype</strong>
            <span style={styles.loadStateSpan}>Fetching <code>pack-opening-v9_2.html</code> from the app bundle...</span>
          </div>
        ) : (
          <iframe
            key={reloadKey}
            style={styles.frame}
            title="GratoniteGuys Pack Opening Prototype"
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-same-origin"
          />
        )}
      </div>
    </section>
  );
}
