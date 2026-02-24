import { useEffect, useMemo, useState } from 'react';

interface Props {
  className?: string;
}

function buildPrototypeSrcDoc(html: string) {
  return html
    .replaceAll('gratonite_collection', 'gratonite_guys_collection')
    .replaceAll('gratonite_dust', 'gratonite_guys_dust')
    .replaceAll('<title>Gratonite Pack Opening v9</title>', '<title>GratoniteGuys Pack Opening Lab</title>');
}

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
    <section className={`gg-lab-shell ${className ?? ''}`.trim()}>
      <header className="gg-lab-header">
        <div>
          <div className="shop-eyebrow">GratoniteGuys Lab</div>
          <h2 className="gg-lab-title">Pack Opening Prototype (v9.2)</h2>
          <p className="gg-lab-subtitle">
            Embedded prototype extracted from the standalone HTML. Local storage is namespaced for safe in-app testing.
          </p>
        </div>
        <div className="gg-lab-actions">
          <button type="button" className="shop-link" onClick={() => setReloadKey((k) => k + 1)}>
            Reload Prototype
          </button>
        </div>
      </header>
      <div className="gg-lab-frame-wrap">
        {loadError ? (
          <div className="gg-lab-load-state">
            <strong>Prototype Load Failed</strong>
            <span>{loadError}</span>
          </div>
        ) : !srcDoc ? (
          <div className="gg-lab-load-state">
            <strong>Loading Prototype</strong>
            <span>Fetching <code>pack-opening-v9_2.html</code> from the app bundle...</span>
          </div>
        ) : (
          <iframe
            key={reloadKey}
            className="gg-lab-frame"
            title="GratoniteGuys Pack Opening Prototype"
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-same-origin"
          />
        )}
      </div>
    </section>
  );
}
