import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { parseRoute } from './route';
import { appConfig } from './config';

function App() {
  const route = parseRoute(window.location.pathname.replace('/app', '') || '/');
  const isDownload = route.view === 'download';
  const [remoteDownloads, setRemoteDownloads] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    fetch('/releases.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.downloads) setRemoteDownloads(data.downloads);
      })
      .catch(() => null);
  }, []);

  const downloads = useMemo(() => ({
    macSilicon: remoteDownloads?.macSilicon ?? appConfig.downloads.macSilicon,
    macIntel: remoteDownloads?.macIntel ?? appConfig.downloads.macIntel,
    winX64: remoteDownloads?.winX64 ?? appConfig.downloads.winX64,
    linuxAppImage: remoteDownloads?.linuxAppImage ?? appConfig.downloads.linuxAppImage,
    linuxDeb: remoteDownloads?.linuxDeb ?? appConfig.downloads.linuxDeb,
    linuxRpm: remoteDownloads?.linuxRpm ?? appConfig.downloads.linuxRpm,
  }), [remoteDownloads]);

  return (
    <div className="app">
      <aside className="rail">
        <div className="logo">G</div>
        <nav className="rail-nav">
          <button className="rail-item active">Home</button>
          <button className="rail-item">Spaces</button>
          <button className="rail-item">DMs</button>
          <button className="rail-item">Events</button>
          <button className="rail-item">Settings</button>
        </nav>
      </aside>

      <div className="shell">
        <header className="topbar">
          <div>
            <h1>Gratonite Web</h1>
            <p>Staging-ready UI shell for Phase 7.</p>
          </div>
          <div className="topbar-actions">
            <button className="ghost">Search</button>
            <button className="ghost">New</button>
            <button className="primary">Connect</button>
          </div>
        </header>

        <div className="status-banner">
          <span className="pill">
            <span className="dot" />
            {appConfig.tunnelStatus}
          </span>
          <span className="status-copy">Tunnel status reflects current staging URL.</span>
        </div>

        <main className="content">
          <section className="card">
            <div className="card-header">
              <div>
                <h2>Spaces</h2>
                <span>Fast navigation and context switching.</span>
              </div>
              <button className="ghost">Browse</button>
            </div>
            <div className="list">
              <div className="list-item active">
                <div className="avatar">AI</div>
                <div>
                  <strong>Arclight Guild</strong>
                  <p>#lab • 7 new messages</p>
                </div>
              </div>
              <div className="list-item">
                <div className="avatar alt">FX</div>
                <div>
                  <strong>Flux Studio</strong>
                  <p>Voice active • #render</p>
                </div>
              </div>
              <div className="list-item">
                <div className="avatar alt-2">NX</div>
                <div>
                  <strong>Nightshift</strong>
                  <p>2 scheduled events</p>
                </div>
              </div>
            </div>
          </section>

          {isDownload ? (
            <section className="card focus">
              <div className="card-header">
                <div>
                  <h2>Downloads</h2>
                  <span>Grab the latest desktop builds.</span>
                </div>
                <div className="pill">
                  <span className="dot" />
                  Alpha
                </div>
              </div>
              <div className="download-grid">
                <a className="download" href={downloads.macSilicon ?? '#'}>
                  macOS (Apple Silicon)
                </a>
                <a className="download" href={downloads.macIntel ?? '#'}>
                  macOS (Intel)
                </a>
                <a className="download" href={downloads.winX64 ?? '#'}>
                  Windows (x64)
                </a>
                <a className="download" href={downloads.linuxAppImage ?? '#'}>
                  Linux (AppImage)
                </a>
                <a className="download" href={downloads.linuxDeb ?? '#'}>
                  Linux (deb)
                </a>
                <a className="download" href={downloads.linuxRpm ?? '#'}>
                  Linux (rpm)
                </a>
              </div>
              <p className="muted">Downloads load from releases.json or env overrides.</p>
            </section>
          ) : (
            <section className="card focus">
              <div className="card-header">
                <div>
                  <h2>#general</h2>
                  <span>142 online • design review today</span>
                </div>
                <div className="pill">
                  <span className="dot" />
                  Live
                </div>
              </div>
              <div className="chat">
                <div className="message">
                  <div className="avatar small">AV</div>
                  <div>
                    <strong>Avery</strong>
                    <p>Voice stack is live for mobile.</p>
                  </div>
                </div>
                <div className="message">
                  <div className="avatar small alt">LM</div>
                  <div>
                    <strong>Leona</strong>
                    <p>New gradient maps shipped to themes.</p>
                  </div>
                </div>
                <div className="message">
                  <div className="avatar small alt-2">UX</div>
                  <div>
                    <strong>UX Team</strong>
                    <p>Navigation tabs optimized for desktop + mobile parity.</p>
                  </div>
                </div>
              </div>
              <div className="composer">
                <input placeholder="Message #general" />
                <button className="primary">Send</button>
              </div>
            </section>
          )}

          <section className="card">
            <div className="card-header">
              <div>
                <h2>System</h2>
                <span>Staging environment details.</span>
              </div>
            </div>
            <div className="stat">
              <span>Status</span>
              <strong>Ready for tunnel</strong>
            </div>
            <div className="stat">
              <span>Route</span>
              <strong>{route.view}</strong>
            </div>
            <div className="stat">
              <span>API</span>
              <strong>{appConfig.apiUrl}</strong>
            </div>
            <div className="stat">
              <span>Notifications</span>
              <strong>Grouped + routed</strong>
            </div>
            <div className="stat">
              <span>Offline</span>
              <strong>WatermelonDB planned</strong>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
