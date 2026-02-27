import { useEffect, useState, CSSProperties } from 'react';
import { shouldEnableUiV2Tokens } from '@/theme/initTheme';

interface ThemePack {
  id: string;
  name: string;
  description: string;
  author: string;
  previewUrl?: string;
  isBuiltIn: boolean;
  isInstalled: boolean;
  installCount: number;
  rating: number;
  tags: string[];
}

const s = {
  page: {
    padding: 24,
    color: '#e8e4e0',
    minHeight: '100%',
    background: '#2c2c3e',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 64,
    color: '#a8a4b8',
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #4a4660',
    borderTopColor: '#d4af37',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    color: '#e8e4e0',
  },
  createBtn: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    background: '#d4af37',
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  tabs: {
    display: 'flex',
    gap: 4,
    background: '#25243a',
    borderRadius: 'var(--radius-md)',
    padding: 4,
    marginBottom: 20,
    width: 'fit-content',
  },
  tab: {
    padding: '8px 20px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: '#a8a4b8',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },
  tabActive: {
    padding: '8px 20px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: '#413d58',
    color: '#e8e4e0',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },
  filters: {
    display: 'flex',
    gap: 4,
    background: '#25243a',
    borderRadius: 'var(--radius-md)',
    padding: 4,
    marginBottom: 20,
    width: 'fit-content',
  },
  filterBtn: {
    padding: '6px 14px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: '#a8a4b8',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  filterBtnActive: {
    padding: '6px 14px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: '#413d58',
    color: '#e8e4e0',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  error: {
    background: 'rgba(232, 90, 110, 0.1)',
    border: '1px solid rgba(232, 90, 110, 0.3)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 16px',
    marginBottom: 16,
    color: '#e85a6e',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: 48,
    color: '#6e6a80',
    textAlign: 'center',
    gridColumn: '1 / -1',
  },
  emptyTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#a8a4b8',
  },
  emptyText: {
    margin: 0,
    fontSize: 14,
  },
  themeCard: {
    background: '#25243a',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    border: '2px solid transparent',
    transition: 'border-color 0.15s ease',
  },
  themeCardInstalled: {
    background: '#25243a',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    border: '2px solid #d4af37',
  },
  themePreview: {
    height: 140,
    background: '#353348',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPlaceholder: {
    fontSize: 40,
    opacity: 0.5,
  },
  themeInfo: {
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flex: 1,
  },
  themeName: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: '#e8e4e0',
  },
  themeAuthor: {
    margin: 0,
    fontSize: 12,
    color: '#6e6a80',
  },
  themeDesc: {
    margin: 0,
    fontSize: 13,
    color: '#a8a4b8',
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  themeTags: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  themeTag: {
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    background: '#413d58',
    color: '#a8a4b8',
    fontSize: 11,
    fontWeight: 500,
  },
  themeStats: {
    display: 'flex',
    gap: 12,
    fontSize: 12,
    color: '#6e6a80',
    alignItems: 'center',
  },
  builtIn: {
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(212, 175, 55, 0.15)',
    color: '#d4af37',
    fontSize: 10,
    fontWeight: 600,
  },
  themeActions: {
    padding: '12px 16px',
    borderTop: '1px solid #4a4660',
    display: 'flex',
    gap: 8,
  },
  installBtn: {
    padding: '7px 14px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: '#d4af37',
    color: '#1a1a2e',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    flex: 1,
  },
  uninstallBtn: {
    padding: '7px 14px',
    border: '1px solid rgba(232, 90, 110, 0.3)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: '#e85a6e',
    fontSize: 12,
    cursor: 'pointer',
    flex: 1,
  },
  previewBtn: {
    padding: '7px 14px',
    border: '1px solid #4a4660',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: '#a8a4b8',
    fontSize: 12,
    cursor: 'pointer',
  },
  installedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  installedCard: {
    background: '#25243a',
    borderRadius: 'var(--radius-md)',
    padding: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  previewSm: {
    width: 64,
    height: 48,
    borderRadius: 'var(--radius-sm)',
    background: '#353348',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    flexShrink: 0,
  },
  installedInfo: {
    flex: 1,
    minWidth: 0,
  },
  installedName: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: '#e8e4e0',
  },
  installedAuthor: {
    fontSize: 12,
    color: '#6e6a80',
  },
  installedActions: {
    display: 'flex',
    gap: 8,
    flexShrink: 0,
  },
  applyBtn: {
    padding: '7px 14px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: '#d4af37',
    color: '#1a1a2e',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  createSection: {
    padding: 32,
    textAlign: 'center',
  },
  createTitle: {
    margin: '0 0 8px 0',
    fontSize: 20,
    fontWeight: 600,
    color: '#e8e4e0',
  },
  createDesc: {
    margin: '0 0 32px 0',
    fontSize: 14,
    color: '#a8a4b8',
  },
  createOptions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
  },
  createOption: {
    background: '#25243a',
    borderRadius: 'var(--radius-lg)',
    padding: 24,
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'center',
  },
  createOptionTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#e8e4e0',
  },
  createOptionDesc: {
    margin: 0,
    fontSize: 13,
    color: '#a8a4b8',
  },
  createOptionBtn: {
    padding: '8px 20px',
    border: '1px solid #4a4660',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: '#e8e4e0',
    fontSize: 13,
    cursor: 'pointer',
    marginTop: 8,
  },
};

export function ThemesPage() {
  const uiV2TokensEnabled = shouldEnableUiV2Tokens();
  const [tab, setTab] = useState<'browse' | 'installed' | 'create'>('browse');
  const [themes, setThemes] = useState<ThemePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'built_in' | 'community'>('all');

  useEffect(() => {
    async function fetchThemes() {
      try {
        const endpoint = tab === 'installed'
          ? '/api/v1/themes/installed'
          : `/api/v1/themes?filter=${filter}`;
        const res = await fetch(endpoint, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to fetch themes');
        const data = await res.json();
        setThemes(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchThemes();
  }, [tab, filter]);

  const handleInstall = async (themeId: string) => {
    try {
      const res = await fetch(`/api/v1/themes/${themeId}/install`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to install theme');
      setThemes(themes.map(t =>
        t.id === themeId ? { ...t, isInstalled: true, installCount: t.installCount + 1 } : t
      ));
    } catch (err) {
      console.error('Install failed:', err);
    }
  };

  const handleUninstall = async (themeId: string) => {
    try {
      const res = await fetch(`/api/v1/themes/${themeId}/uninstall`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to uninstall theme');
      setThemes(themes.map(t =>
        t.id === themeId ? { ...t, isInstalled: false, installCount: t.installCount - 1 } : t
      ));
    } catch (err) {
      console.error('Uninstall failed:', err);
    }
  };

  if (loading) {
    return (
      <div style={s.page}>
        <div style={s.loading}>
          <div style={s.spinner} />
          <p>Loading themes...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Themes</h1>
        <button style={s.createBtn}>Create Theme</button>
      </div>

      <div style={s.tabs}>
        <button
          style={tab === 'browse' ? s.tabActive : s.tab}
          onClick={() => { setTab('browse'); setLoading(true); }}
        >
          Browse
        </button>
        <button
          style={tab === 'installed' ? s.tabActive : s.tab}
          onClick={() => { setTab('installed'); setLoading(true); }}
        >
          Installed
        </button>
        <button
          style={tab === 'create' ? s.tabActive : s.tab}
          onClick={() => { setTab('create'); setLoading(true); }}
        >
          Create
        </button>
      </div>

      {tab === 'browse' && (
        <div style={s.filters}>
          <button
            style={filter === 'all' ? s.filterBtnActive : s.filterBtn}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            style={filter === 'built_in' ? s.filterBtnActive : s.filterBtn}
            onClick={() => setFilter('built_in')}
          >
            Built-in
          </button>
          <button
            style={filter === 'community' ? s.filterBtnActive : s.filterBtn}
            onClick={() => setFilter('community')}
          >
            Community
          </button>
        </div>
      )}

      {error && (
        <div style={s.error}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {tab === 'browse' && (
        <div style={s.grid}>
          {themes.length === 0 ? (
            <div style={s.empty}>
              <h3 style={s.emptyTitle}>No themes found</h3>
              <p style={s.emptyText}>Be the first to create a community theme!</p>
            </div>
          ) : (
            themes.map((theme) => (
              <div key={theme.id} style={theme.isInstalled ? s.themeCardInstalled : s.themeCard}>
                <div
                  style={{
                    ...s.themePreview,
                    ...(theme.previewUrl ? { backgroundImage: `url(${theme.previewUrl})` } : {}),
                  }}
                >
                  {!theme.previewUrl && <span style={s.previewPlaceholder}>&#127912;</span>}
                </div>
                <div style={s.themeInfo}>
                  <h3 style={s.themeName}>{theme.name}</h3>
                  <p style={s.themeAuthor}>by {theme.author}</p>
                  <p style={s.themeDesc}>{theme.description}</p>
                  <div style={s.themeTags}>
                    {theme.tags.slice(0, 3).map((tag) => (
                      <span key={tag} style={s.themeTag}>{tag}</span>
                    ))}
                  </div>
                  <div style={s.themeStats}>
                    <span>&#11088; {theme.rating.toFixed(1)}</span>
                    <span>&#128229; {theme.installCount}</span>
                    {theme.isBuiltIn && <span style={s.builtIn}>Built-in</span>}
                  </div>
                </div>
                <div style={s.themeActions}>
                  {theme.isInstalled ? (
                    <button
                      style={s.uninstallBtn}
                      onClick={() => handleUninstall(theme.id)}
                    >
                      Uninstall
                    </button>
                  ) : (
                    <button
                      style={s.installBtn}
                      onClick={() => handleInstall(theme.id)}
                    >
                      Install
                    </button>
                  )}
                  <button style={s.previewBtn}>Preview</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'installed' && (
        <div style={s.installedList}>
          {themes.length === 0 ? (
            <div style={s.empty}>
              <h3 style={s.emptyTitle}>No themes installed</h3>
              <p style={s.emptyText}>Browse themes to find ones you like</p>
            </div>
          ) : (
            themes.map((theme) => (
              <div key={theme.id} style={s.installedCard}>
                <div
                  style={{
                    ...s.previewSm,
                    ...(theme.previewUrl ? { backgroundImage: `url(${theme.previewUrl})` } : {}),
                  }}
                />
                <div style={s.installedInfo}>
                  <h3 style={s.installedName}>{theme.name}</h3>
                  <span style={s.installedAuthor}>by {theme.author}</span>
                </div>
                <div style={s.installedActions}>
                  <button style={s.applyBtn}>Apply</button>
                  <button
                    style={s.uninstallBtn}
                    onClick={() => handleUninstall(theme.id)}
                  >
                    Uninstall
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'create' && (
        <div style={s.createSection}>
          <h2 style={s.createTitle}>Create Your Own Theme</h2>
          <p style={s.createDesc}>Customize colors, fonts, and effects to create a unique look</p>
          <div style={s.createOptions}>
            <div style={s.createOption}>
              <h3 style={s.createOptionTitle}>&#127912; Visual Editor</h3>
              <p style={s.createOptionDesc}>Use the visual editor to customize your theme</p>
              <button style={s.createOptionBtn}>Start Editing</button>
            </div>
            <div style={s.createOption}>
              <h3 style={s.createOptionTitle}>&#128221; Import CSS</h3>
              <p style={s.createOptionDesc}>Import your own CSS tokens</p>
              <button style={s.createOptionBtn}>Import CSS</button>
            </div>
            <div style={s.createOption}>
              <h3 style={s.createOptionTitle}>&#128228; Export</h3>
              <p style={s.createOptionDesc}>Export your theme to share with others</p>
              <button style={s.createOptionBtn}>Export Theme</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
