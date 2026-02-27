import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { CosmeticForm } from '@/components/cosmetics/CosmeticForm';

type CosmeticType = 'avatar_decoration' | 'effect' | 'nameplate' | 'soundboard';

interface Cosmetic {
  id: string;
  name: string;
  description: string | null;
  type: CosmeticType;
  previewImageUrl: string | null;
  assetUrl: string | null;
  price: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CosmeticStats {
  cosmeticId: string;
  totalSales: number;
  totalRevenueGratonites: number;
}

const TYPE_LABELS: Record<CosmeticType, string> = {
  avatar_decoration: 'Avatar Decoration',
  effect: 'Effect',
  nameplate: 'Nameplate',
  soundboard: 'Soundboard',
};

const FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'avatar_decoration', label: 'Avatar Decorations' },
  { value: 'effect', label: 'Effects' },
  { value: 'nameplate', label: 'Nameplates' },
  { value: 'soundboard', label: 'Soundboard' },
];

const s = {
  page: { padding: 32, color: '#e8e4e0', minHeight: '100%', background: '#1a1a2e' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  title: { margin: 0, fontSize: 24, fontWeight: 700 },
  tabs: { display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #3a3650', paddingBottom: 0 },
  tab: (active: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    border: 'none',
    background: 'none',
    color: active ? '#d4af37' : '#a8a4b8',
    fontWeight: active ? 700 : 400,
    fontSize: 14,
    cursor: 'pointer',
    borderBottom: active ? '2px solid #d4af37' : '2px solid transparent',
    marginBottom: -1,
  }),
  filterRow: { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' as const },
  filterBtn: (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: 20,
    border: '1px solid',
    borderColor: active ? '#d4af37' : '#3a3650',
    background: active ? '#d4af3718' : 'transparent',
    color: active ? '#d4af37' : '#a8a4b8',
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
  }),
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 },
  card: {
    background: '#12121f',
    border: '1px solid #3a3650',
    borderRadius: 10,
    overflow: 'hidden' as const,
  },
  cardImg: { width: '100%', height: 140, objectFit: 'cover' as const, background: '#0d0d1a' },
  cardImgPlaceholder: {
    width: '100%', height: 140,
    background: '#0d0d1a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#3a3650', fontSize: 32,
  },
  cardBody: { padding: 14 },
  cardName: { margin: '0 0 4px', fontSize: 15, fontWeight: 600 },
  cardMeta: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 },
  typeBadge: {
    padding: '2px 8px', borderRadius: 4,
    background: '#2a2a3e', color: '#a8a4b8',
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const,
  },
  draftBadge: {
    padding: '2px 8px', borderRadius: 4,
    background: '#3a3650', color: '#a8a4b8',
    fontSize: 11, fontWeight: 600,
  },
  publishedBadge: {
    padding: '2px 8px', borderRadius: 4,
    background: '#276749', color: '#9ae6b4',
    fontSize: 11, fontWeight: 600,
  },
  price: { marginLeft: 'auto', fontSize: 13, color: '#d4af37', fontWeight: 600 },
  cardActions: { display: 'flex', gap: 6 },
  actionBtn: (variant: 'edit' | 'delete' | 'publish' | 'unpublish'): React.CSSProperties => ({
    flex: 1, padding: '6px 10px',
    borderRadius: 6, border: 'none',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    background: variant === 'delete' ? '#742a2a' : variant === 'publish' ? '#276749' : variant === 'unpublish' ? '#4a4660' : '#3a3650',
    color: variant === 'delete' ? '#fc8181' : variant === 'publish' ? '#9ae6b4' : '#e8e4e0',
  }),
  statsRow: { display: 'flex', gap: 6, marginBottom: 10, fontSize: 12, color: '#a8a4b8' },
  createBtn: {
    padding: '10px 20px', border: 'none', borderRadius: 8,
    background: '#d4af37', color: '#1a1a2e', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  empty: { textAlign: 'center' as const, padding: 64, color: '#a8a4b8' },
  analyticsTable: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#a8a4b8', textTransform: 'uppercase' as const, borderBottom: '1px solid #3a3650' },
  td: { padding: '12px 14px', fontSize: 14, borderBottom: '1px solid #2a2a3e' },
  summaryCards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 },
  summaryCard: { background: '#12121f', border: '1px solid #3a3650', borderRadius: 8, padding: 16 },
  summaryVal: { fontSize: 28, fontWeight: 700, color: '#d4af37' },
  summaryLabel: { fontSize: 12, color: '#a8a4b8', marginTop: 4 },
  toast: {
    position: 'fixed' as const, bottom: 24, right: 24,
    background: '#276749', color: '#9ae6b4',
    padding: '12px 20px', borderRadius: 8,
    fontSize: 14, fontWeight: 600, zIndex: 2000,
  },
};

export function CreatorDashboardPage() {
  const [tab, setTab] = useState<'cosmetics' | 'analytics'>('cosmetics');
  const [filter, setFilter] = useState('all');
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([]);
  const [stats, setStats] = useState<Record<string, CosmeticStats>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Cosmetic | null>(null);
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function load() {
    setLoading(true);
    try {
      const data = await api.cosmetics.listMine() as Cosmetic[];
      setCosmetics(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function loadStats(items: Cosmetic[]) {
    const entries = await Promise.allSettled(items.map(c => api.cosmetics.getStats(c.id)));
    const map: Record<string, CosmeticStats> = {};
    entries.forEach((r, i) => {
      if (r.status === 'fulfilled' && items[i]) map[items[i]!.id] = r.value as CosmeticStats;
    });
    setStats(map);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { if (cosmetics.length > 0) loadStats(cosmetics); }, [cosmetics]);

  const filtered = filter === 'all' ? cosmetics : cosmetics.filter(c => c.type === filter);
  const drafts = filtered.filter(c => !c.isPublished);
  const published = filtered.filter(c => c.isPublished);

  async function handleSave(data: any) {
    if (editTarget) {
      await api.cosmetics.update(editTarget.id, data);
      showToast(data.isPublished ? 'Cosmetic published!' : 'Draft saved');
    } else {
      await api.cosmetics.create(data);
      if (data.isPublished) {
        // update to published after create
        const list = await api.cosmetics.listMine() as Cosmetic[];
        const newest = list[0];
        if (newest) await api.cosmetics.update(newest.id, { isPublished: true });
      }
      showToast(data.isPublished ? 'Cosmetic published!' : 'Draft saved');
    }
    setShowForm(false);
    setEditTarget(null);
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this cosmetic? This cannot be undone.')) return;
    await api.cosmetics.delete(id);
    showToast('Cosmetic deleted');
    await load();
  }

  async function handleTogglePublish(c: Cosmetic) {
    await api.cosmetics.update(c.id, { isPublished: !c.isPublished });
    showToast(c.isPublished ? 'Unpublished' : 'Published!');
    await load();
  }

  const totalSales = Object.values(stats).reduce((s, v) => s + v.totalSales, 0);
  const totalRevenue = Object.values(stats).reduce((s, v) => s + v.totalRevenueGratonites, 0);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Creator Dashboard</h1>
        <button style={s.createBtn} onClick={() => { setEditTarget(null); setShowForm(true); }}>
          + Create Cosmetic
        </button>
      </div>

      <div style={s.tabs}>
        <button style={s.tab(tab === 'cosmetics')} onClick={() => setTab('cosmetics')}>My Cosmetics</button>
        <button style={s.tab(tab === 'analytics')} onClick={() => setTab('analytics')}>Analytics</button>
      </div>

      {tab === 'cosmetics' && (
        <>
          <div style={s.filterRow}>
            {FILTERS.map(f => (
              <button key={f.value} style={s.filterBtn(filter === f.value)} onClick={() => setFilter(f.value)}>
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={s.empty}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={s.empty}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
              <div style={{ fontSize: 16, marginBottom: 8 }}>No cosmetics yet</div>
              <div style={{ fontSize: 13 }}>Create your first cosmetic to start selling</div>
            </div>
          ) : (
            <>
              {drafts.length > 0 && (
                <>
                  <h3 style={{ color: '#a8a4b8', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>
                    Drafts ({drafts.length})
                  </h3>
                  <div style={{ ...s.grid, marginBottom: 28 }}>
                    {drafts.map(c => <CosmeticCard key={c.id} cosmetic={c} stats={stats[c.id]} onEdit={() => { setEditTarget(c); setShowForm(true); }} onDelete={() => handleDelete(c.id)} onTogglePublish={() => handleTogglePublish(c)} />)}
                  </div>
                </>
              )}
              {published.length > 0 && (
                <>
                  <h3 style={{ color: '#a8a4b8', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>
                    Published ({published.length})
                  </h3>
                  <div style={s.grid}>
                    {published.map(c => <CosmeticCard key={c.id} cosmetic={c} stats={stats[c.id]} onEdit={() => { setEditTarget(c); setShowForm(true); }} onDelete={() => handleDelete(c.id)} onTogglePublish={() => handleTogglePublish(c)} />)}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {tab === 'analytics' && (
        <>
          <div style={s.summaryCards}>
            <div style={s.summaryCard}><div style={s.summaryVal}>{totalSales}</div><div style={s.summaryLabel}>Total Sales</div></div>
            <div style={s.summaryCard}><div style={s.summaryVal}>{totalRevenue.toLocaleString()}</div><div style={s.summaryLabel}>Total Revenue (G)</div></div>
            <div style={s.summaryCard}><div style={s.summaryVal}>{cosmetics.filter(c => c.isPublished).length}</div><div style={s.summaryLabel}>Published</div></div>
            <div style={s.summaryCard}><div style={s.summaryVal}>{cosmetics.filter(c => !c.isPublished).length}</div><div style={s.summaryLabel}>Drafts</div></div>
          </div>
          <table style={s.analyticsTable}>
            <thead>
              <tr>
                <th style={s.th}>Cosmetic</th>
                <th style={s.th}>Type</th>
                <th style={s.th}>Sales</th>
                <th style={s.th}>Revenue (G)</th>
                <th style={s.th}>Price</th>
                <th style={s.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {cosmetics.map(c => (
                <tr key={c.id}>
                  <td style={s.td}>{c.name}</td>
                  <td style={s.td}>{TYPE_LABELS[c.type]}</td>
                  <td style={s.td}>{stats[c.id]?.totalSales ?? '—'}</td>
                  <td style={s.td}>{stats[c.id]?.totalRevenueGratonites?.toLocaleString() ?? '—'}</td>
                  <td style={s.td}>{c.price > 0 ? `${c.price} G` : 'Free'}</td>
                  <td style={s.td}>
                    <span style={c.isPublished ? s.publishedBadge : s.draftBadge}>
                      {c.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {showForm && (
        <CosmeticForm
          mode={editTarget ? 'edit' : 'create'}
          initial={editTarget ? {
            id: editTarget.id,
            name: editTarget.name,
            description: editTarget.description ?? '',
            type: editTarget.type,
            previewImageUrl: editTarget.previewImageUrl ?? '',
            assetUrl: editTarget.assetUrl ?? '',
            price: editTarget.price,
          } : undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}

      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );
}

function CosmeticCard({ cosmetic, stats, onEdit, onDelete, onTogglePublish }: {
  cosmetic: Cosmetic;
  stats?: CosmeticStats;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
}) {
  return (
    <div style={s.card}>
      {cosmetic.previewImageUrl
        ? <img src={cosmetic.previewImageUrl} alt={cosmetic.name} style={s.cardImg} />
        : <div style={s.cardImgPlaceholder}>✨</div>
      }
      <div style={s.cardBody}>
        <p style={s.cardName}>{cosmetic.name}</p>
        <div style={s.cardMeta}>
          <span style={s.typeBadge}>{TYPE_LABELS[cosmetic.type]}</span>
          <span style={cosmetic.isPublished ? s.publishedBadge : s.draftBadge}>
            {cosmetic.isPublished ? 'Published' : 'Draft'}
          </span>
          <span style={s.price}>{cosmetic.price > 0 ? `${cosmetic.price} G` : 'Free'}</span>
        </div>
        {stats && (
          <div style={s.statsRow}>
            <span>{stats.totalSales} sales</span>
            <span>·</span>
            <span>{stats.totalRevenueGratonites.toLocaleString()} G revenue</span>
          </div>
        )}
        <div style={s.cardActions}>
          <button style={s.actionBtn('edit')} onClick={onEdit}>Edit</button>
          <button style={s.actionBtn(cosmetic.isPublished ? 'unpublish' : 'publish')} onClick={onTogglePublish}>
            {cosmetic.isPublished ? 'Unpublish' : 'Publish'}
          </button>
          {!cosmetic.isPublished && (
            <button style={s.actionBtn('delete')} onClick={onDelete}>Delete</button>
          )}
        </div>
      </div>
    </div>
  );
}
