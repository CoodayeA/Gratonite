import { useEffect, useState, CSSProperties } from 'react';
import { shouldEnableUiV2Tokens } from '@/theme/initTheme';

interface BotApp {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  botUserId?: string;
  isVerified: boolean;
  tags: string[];
  installCount: number;
}

interface MyBot {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  botUserId: string;
  clientId: string;
  token?: string;
  webhookUrl?: string;
  status: 'draft' | 'in_review' | 'published' | 'suspended';
  commands: number;
  guildCount: number;
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 16,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
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
  botCard: {
    background: '#25243a',
    borderRadius: 'var(--radius-md)',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  botIcon: {
    width: 48,
    height: 48,
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    flexShrink: 0,
  },
  botIconImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  botIconPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 'var(--radius-lg)',
    background: '#413d58',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 700,
    color: '#d4af37',
  },
  botInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  botName: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: '#e8e4e0',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  botVerified: {
    color: '#d4af37',
    fontSize: 14,
  },
  botDesc: {
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
  botTags: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  botTag: {
    padding: '3px 8px',
    borderRadius: 'var(--radius-sm)',
    background: '#413d58',
    color: '#a8a4b8',
    fontSize: 11,
    fontWeight: 500,
  },
  botStats: {
    fontSize: 12,
    color: '#6e6a80',
  },
  installBtn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: '#d4af37',
    color: '#1a1a2e',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  myBotsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  myBotCard: {
    background: '#25243a',
    borderRadius: 'var(--radius-md)',
    padding: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  botMeta: {
    display: 'flex',
    gap: 16,
    fontSize: 12,
    color: '#6e6a80',
    marginTop: 2,
  },
  botStatus: {
    fontWeight: 600,
    textTransform: 'capitalize',
  },
  botActions: {
    display: 'flex',
    gap: 8,
    flexShrink: 0,
  },
  editBtn: {
    padding: '6px 14px',
    border: '1px solid #4a4660',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: '#a8a4b8',
    fontSize: 12,
    cursor: 'pointer',
  },
  configBtn: {
    padding: '6px 14px',
    border: '1px solid #d4af37',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: '#d4af37',
    fontSize: 12,
    cursor: 'pointer',
  },
};

const inputStyle: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid #4a4660',
  background: '#25243a',
  color: '#e8e4e0',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const labelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: '#a8a4b8',
};

export function BotsPage() {
  const uiV2TokensEnabled = shouldEnableUiV2Tokens();
  const [tab, setTab] = useState<'discover' | 'my_bots'>('discover');
  const [bots, setBots] = useState<BotApp[]>([]);
  const [myBots, setMyBots] = useState<MyBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Application modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Configure modal state
  const [configBot, setConfigBot] = useState<MyBot | null>(null);
  const [configName, setConfigName] = useState('');
  const [configDescription, setConfigDescription] = useState('');
  const [configWebhookUrl, setConfigWebhookUrl] = useState('');
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        if (tab === 'discover') {
          const res = await fetch('/api/v1/bots/discover', {
            credentials: 'include',
          });
          if (!res.ok) throw new Error('Failed to fetch bots');
          const data = await res.json();
          setBots(data);
        } else {
          const res = await fetch('/api/v1/bots/my-apps', {
            credentials: 'include',
          });
          if (!res.ok) throw new Error('Failed to fetch your bots');
          const data = await res.json();
          setMyBots(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [tab]);

  const refreshMyBots = async () => {
    try {
      const res = await fetch('/api/v1/bots/my-apps', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMyBots(data);
      }
    } catch {
      // ignore
    }
  };

  const handleCreateBot = async () => {
    if (!newName.trim()) { setCreateError('Name is required'); return; }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/v1/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() }),
      });
      if (!res.ok) throw new Error('Failed to create application');
      setShowCreateModal(false);
      setNewName('');
      setNewDescription('');
      // Switch to my_bots tab and refresh
      setTab('my_bots');
      setLoading(true);
      await refreshMyBots();
      setLoading(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create application');
    } finally {
      setCreating(false);
    }
  };

  const openConfigure = (bot: MyBot) => {
    setConfigBot(bot);
    setConfigName(bot.name);
    setConfigDescription(bot.description);
    setConfigWebhookUrl(bot.webhookUrl ?? '');
    setConfigError(null);
    setShowToken(false);
  };

  const handleSaveConfig = async () => {
    if (!configBot) return;
    setConfigSaving(true);
    setConfigError(null);
    try {
      const res = await fetch(`/api/v1/bots/${configBot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: configName.trim(),
          description: configDescription.trim(),
          webhookUrl: configWebhookUrl.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to save configuration');
      const updated = await res.json();
      setMyBots(prev => prev.map(b => b.id === configBot.id ? { ...b, ...updated } : b));
      setConfigBot(null);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setConfigSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return '#6aea8a';
      case 'in_review': return '#d4af37';
      case 'draft': return '#6e6a80';
      case 'suspended': return '#e85a6e';
      default: return '#a8a4b8';
    }
  };

  if (loading) {
    return (
      <div style={s.page}>
        <div style={s.loading}>
          <div style={s.spinner} />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Bots & Apps</h1>
        <button style={s.createBtn} onClick={() => setShowCreateModal(true)}>New Application</button>
      </div>

      <div style={s.tabs}>
        <button
          style={tab === 'discover' ? s.tabActive : s.tab}
          onClick={() => { setTab('discover'); setLoading(true); }}
        >
          Discover
        </button>
        <button
          style={tab === 'my_bots' ? s.tabActive : s.tab}
          onClick={() => { setTab('my_bots'); setLoading(true); }}
        >
          My Applications
        </button>
      </div>

      {error && (
        <div style={s.error}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {tab === 'discover' && (
        <div style={s.grid}>
          {bots.length === 0 ? (
            <div style={s.empty}>
              <h3 style={s.emptyTitle}>No bots available</h3>
              <p style={s.emptyText}>Be the first to publish a bot!</p>
            </div>
          ) : (
            bots.map((bot) => (
              <div key={bot.id} style={s.botCard}>
                <div style={s.botIcon}>
                  {bot.iconUrl ? (
                    <img src={bot.iconUrl} alt={bot.name} style={s.botIconImg} />
                  ) : (
                    <span style={s.botIconPlaceholder}>{bot.name[0]}</span>
                  )}
                </div>
                <div style={s.botInfo}>
                  <h3 style={s.botName}>
                    {bot.name}
                    {bot.isVerified && <span style={s.botVerified}>&#10003;</span>}
                  </h3>
                  <p style={s.botDesc}>{bot.description}</p>
                  <div style={s.botTags}>
                    {bot.tags.slice(0, 3).map((tag) => (
                      <span key={tag} style={s.botTag}>{tag}</span>
                    ))}
                  </div>
                  <div style={s.botStats}>
                    <span>{bot.installCount} servers</span>
                  </div>
                </div>
                <button style={s.installBtn}>Add to Server</button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'my_bots' && (
        <div style={s.myBotsList}>
          {myBots.length === 0 ? (
            <div style={s.empty}>
              <h3 style={s.emptyTitle}>No applications yet</h3>
              <p style={s.emptyText}>Create your first bot application</p>
              <button style={s.createBtn} onClick={() => setShowCreateModal(true)}>Create Application</button>
            </div>
          ) : (
            myBots.map((bot) => (
              <div key={bot.id} style={s.myBotCard}>
                <div style={s.botIcon}>
                  {bot.iconUrl ? (
                    <img src={bot.iconUrl} alt={bot.name} style={s.botIconImg} />
                  ) : (
                    <span style={s.botIconPlaceholder}>{bot.name[0]}</span>
                  )}
                </div>
                <div style={s.botInfo}>
                  <h3 style={s.botName}>{bot.name}</h3>
                  <p style={s.botDesc}>{bot.description}</p>
                  <div style={s.botMeta}>
                    <span style={{ ...s.botStatus, color: getStatusColor(bot.status) }}>
                      {bot.status.replace('_', ' ')}
                    </span>
                    <span>{bot.commands} commands</span>
                    <span>{bot.guildCount} servers</span>
                  </div>
                </div>
                <div style={s.botActions}>
                  <button style={s.editBtn} onClick={() => openConfigure(bot)}>Edit</button>
                  <button style={s.configBtn} onClick={() => openConfigure(bot)}>Configure</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* New Application Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              background: '#2c2c3e',
              border: '1px solid #4a4660',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              maxWidth: 480,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#e8e4e0' }}>New Application</h2>

            {createError && (
              <div style={{ padding: '8px 12px', background: 'rgba(232,90,110,0.15)', color: '#e85a6e', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                {createError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Name *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My Awesome Bot"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
                placeholder="Describe what your bot does..."
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #4a4660',
                  background: 'transparent',
                  color: '#a8a4b8',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBot}
                disabled={creating}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: '#d4af37',
                  color: '#1a1a2e',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: creating ? 'not-allowed' : 'pointer',
                  opacity: creating ? 0.7 : 1,
                }}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configure Bot Modal */}
      {configBot && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setConfigBot(null)}
        >
          <div
            style={{
              background: '#2c2c3e',
              border: '1px solid #4a4660',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              maxWidth: 480,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#e8e4e0' }}>Configure Application</h2>

            {configError && (
              <div style={{ padding: '8px 12px', background: 'rgba(232,90,110,0.15)', color: '#e85a6e', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                {configError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Name</label>
              <input
                type="text"
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Description</label>
              <textarea
                value={configDescription}
                onChange={(e) => setConfigDescription(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Token</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type={showToken ? 'text' : 'password'}
                  value={configBot.token ?? '••••••••••••••••'}
                  readOnly
                  style={{ ...inputStyle, flex: 1, fontFamily: showToken ? 'monospace' : 'inherit' }}
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  style={{
                    padding: '8px 14px',
                    border: '1px solid #4a4660',
                    borderRadius: 'var(--radius-sm)',
                    background: 'transparent',
                    color: '#a8a4b8',
                    fontSize: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {showToken ? 'Hide' : 'Show'}
                </button>
                {configBot.token && (
                  <button
                    onClick={() => navigator.clipboard.writeText(configBot.token!).catch(() => {})}
                    style={{
                      padding: '8px 14px',
                      border: '1px solid #4a4660',
                      borderRadius: 'var(--radius-sm)',
                      background: 'transparent',
                      color: '#a8a4b8',
                      fontSize: 12,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Copy
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Webhook URL</label>
              <input
                type="url"
                value={configWebhookUrl}
                onChange={(e) => setConfigWebhookUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={() => setConfigBot(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #4a4660',
                  background: 'transparent',
                  color: '#a8a4b8',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={configSaving}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: '#d4af37',
                  color: '#1a1a2e',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: configSaving ? 'not-allowed' : 'pointer',
                  opacity: configSaving ? 0.7 : 1,
                }}
              >
                {configSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
