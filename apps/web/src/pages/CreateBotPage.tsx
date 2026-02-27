import { useState, CSSProperties, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const S = {
  page: {
    display: 'flex',
    height: '100%',
    background: 'var(--bg)',
    color: 'var(--text)',
    overflow: 'hidden',
  },
  sidebar: {
    width: 260,
    minWidth: 260,
    background: 'var(--bg-elevated)',
    borderRight: '1px solid var(--stroke)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarHeader: {
    padding: '20px 16px 12px',
    borderBottom: '1px solid var(--stroke)',
  },
  sidebarHeaderTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 10,
  },
  searchInput: {
    width: '100%',
    height: 36,
    background: 'var(--bg-input)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-sm)',
    padding: '0 12px',
    fontSize: 13,
    color: 'var(--text)',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  botList: {
    flex: 1,
    overflowY: 'auto' as const,
  },
  botRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    height: 52,
    padding: '0 20px',
    cursor: 'pointer',
    borderBottom: '1px solid var(--stroke)',
  },
  botRowActive: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    height: 52,
    padding: '0 20px',
    cursor: 'pointer',
    borderBottom: '1px solid var(--stroke)',
    background: 'var(--bg-soft)',
  },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'var(--bg-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
  botName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
  },
  addBotRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    height: 52,
    padding: '0 20px',
    cursor: 'pointer',
    color: 'var(--accent)',
    fontSize: 13,
    fontWeight: 600,
    borderTop: '1px solid var(--stroke)',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '28px 32px',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 28,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 12,
  },
  formRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
  },
  input: {
    height: 40,
    background: 'var(--bg-input)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    padding: '0 12px',
    fontSize: 14,
    color: 'var(--text)',
    outline: 'none',
  },
  textarea: {
    background: 'var(--bg-input)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 12px',
    fontSize: 14,
    color: 'var(--text)',
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: 80,
    fontFamily: 'inherit',
  },
  hint: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  permRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    marginBottom: 8,
  },
  permLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
  },
  permDesc: {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginTop: 2,
  },
  toggle: {
    width: 40,
    height: 22,
    borderRadius: 'var(--radius-pill)',
    cursor: 'pointer',
    border: 'none',
    transition: 'background 0.2s',
    flexShrink: 0,
  },
  actionBar: {
    borderTop: '1px solid var(--stroke)',
    padding: '16px 32px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    flexShrink: 0,
  },
  cancelBtn: {
    height: 42,
    padding: '0 24px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  createBtn: {
    height: 42,
    padding: '0 28px',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-on-gold)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
};

const PERMISSIONS = [
  { key: 'readMessages', label: 'Read Messages', desc: 'Can view channel messages' },
  { key: 'sendMessages', label: 'Send Messages', desc: 'Can post messages in channels' },
  { key: 'manageMessages', label: 'Manage Messages', desc: 'Can delete or pin messages' },
  { key: 'embedLinks', label: 'Embed Links', desc: 'Can embed links and media' },
  { key: 'mentionEveryone', label: 'Mention Everyone', desc: 'Can use @everyone and @here' },
];

export function CreateBotPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prefix, setPrefix] = useState('!');
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    readMessages: true,
    sendMessages: true,
    manageMessages: false,
    embedLinks: true,
    mentionEveryone: false,
  });
  const [search, setSearch] = useState('');

  const { data: bots } = useQuery({
    queryKey: ['bots', guildId],
    queryFn: () => api.guilds.getMine(), // placeholder — bots endpoint TBD
    enabled: !!guildId,
  });

  const createBot = useMutation({
    mutationFn: () =>
      api.guilds.get(guildId!).then(() => {
        // TODO: wire to real bots API when endpoint exists
        return { id: Date.now().toString(), name };
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots', guildId] });
      navigate(`/guild/${guildId}`);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createBot.mutate();
  }

  function togglePerm(key: string) {
    setPermissions((p) => ({ ...p, [key]: !p[key] }));
  }

  const mockBots = [
    { id: '1', name: 'MusicBot' },
    { id: '2', name: 'ModBot' },
    { id: '3', name: 'WelcomeBot' },
  ];

  return (
    <form style={S.page} onSubmit={handleSubmit}>
      {/* Sidebar */}
      <aside style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <div style={S.sidebarHeaderTitle}>Bots</div>
          <input
            style={S.searchInput}
            placeholder="Search bots…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={S.botList}>
          {mockBots
            .filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))
            .map((b, i) => (
              <div key={b.id} style={i === 0 ? S.botRowActive : S.botRow}>
                <div style={S.botAvatar}>{b.name[0]}</div>
                <div style={S.botName}>{b.name}</div>
              </div>
            ))}
        </div>
        <div style={S.addBotRow}>
          <span>+</span> Create New Bot
        </div>
      </aside>

      {/* Main */}
      <div style={S.main}>
        <div style={S.content}>
          <div style={S.pageTitle}>Create New Bot</div>

          {/* Bot Identity */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Bot Identity</div>
            <div style={S.formRow}>
              <label style={S.label}>Bot Name *</label>
              <input
                style={S.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Awesome Bot"
                required
              />
            </div>
            <div style={S.formRow}>
              <label style={S.label}>Description</label>
              <textarea
                style={S.textarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this bot do?"
              />
              <span style={S.hint}>Shown to members when they interact with the bot.</span>
            </div>
          </div>

          {/* Permissions */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Bot Permissions</div>
            {PERMISSIONS.map((p) => (
              <div key={p.key} style={S.permRow}>
                <div>
                  <div style={S.permLabel}>{p.label}</div>
                  <div style={S.permDesc}>{p.desc}</div>
                </div>
                <button
                  type="button"
                  style={{
                    ...S.toggle,
                    background: permissions[p.key] ? 'var(--accent)' : 'var(--stroke)',
                  }}
                  onClick={() => togglePerm(p.key)}
                  aria-label={`Toggle ${p.label}`}
                  aria-checked={permissions[p.key]}
                />
              </div>
            ))}
          </div>

          {/* Command Prefix */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Command Prefix</div>
            <div style={S.formRow}>
              <label style={S.label}>Prefix Character</label>
              <input
                style={{ ...S.input, width: 80 }}
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.slice(0, 3))}
                placeholder="!"
              />
              <span style={S.hint}>
                Members type this before commands, e.g. <code>{prefix}play</code>
              </span>
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div style={S.actionBar}>
          <button type="button" style={S.cancelBtn} onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button type="submit" style={S.createBtn} disabled={!name.trim() || createBot.isPending}>
            {createBot.isPending ? 'Creating…' : 'Create Bot'}
          </button>
        </div>
      </div>
    </form>
  );
}
