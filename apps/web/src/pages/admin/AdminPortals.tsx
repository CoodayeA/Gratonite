import { useState, useEffect } from 'react';
import {
  Globe,
  Pin,
  Star,
  EyeOff,
  Search,
  Users,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api, API_BASE } from '../../lib/api';
import { getDeterministicGradient } from '../../utils/colors';

interface PortalItem {
  id: string;
  name: string;
  description: string | null;
  iconHash: string | null;
  memberCount: number;
  isDiscoverable: boolean;
  isFeatured: boolean;
  isPinned: boolean;
  discoverRank: number;
  createdAt: string;
}

export default function AdminPortals() {
  const { addToast } = useToast();
  const [items, setItems] = useState<PortalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const fetchPortals = () => {
    setLoading(true);
    setLoadError(null);
    api.adminPortals.list()
      .then(res => setItems(res.items))
      .catch(() => { setLoadError('Could not fetch portals. Please try again.'); addToast({ title: 'Failed to load portals', variant: 'error' }); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPortals(); }, []);

  const handleUpdate = async (guildId: string, data: { isPinned?: boolean; isFeatured?: boolean; isPublic?: boolean }) => {
    setUpdating(guildId);
    try {
      await api.adminPortals.update(guildId, data);
      if (data.isPublic === false) {
        setItems(prev => prev.filter(p => p.id !== guildId));
        addToast({ title: 'Portal removed from Discover', variant: 'success' });
      } else {
        setItems(prev => prev.map(p => {
          if (p.id !== guildId) return p;
          return {
            ...p,
            ...(data.isPinned !== undefined ? { isPinned: data.isPinned } : {}),
            ...(data.isFeatured !== undefined ? { isFeatured: data.isFeatured } : {}),
          };
        }));
        const label = data.isPinned !== undefined
          ? (data.isPinned ? 'Pinned' : 'Unpinned')
          : data.isFeatured !== undefined
            ? (data.isFeatured ? 'Featured' : 'Unfeatured')
            : 'Updated';
        addToast({ title: `Portal ${label.toLowerCase()}`, variant: 'success' });
      }
    } catch {
      addToast({ title: 'Failed to update portal', variant: 'error' });
    } finally {
      setUpdating(null);
      setConfirmRemove(null);
    }
  };

  const filtered = items.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '32px', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Portal Management</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Manage public portals in the Discover section
          </p>
        </div>
        <button
          onClick={fetchPortals}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '8px',
            background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
            color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px',
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Search portals..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px',
            background: 'var(--bg-secondary)', border: '1px solid var(--stroke)',
            color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>Loading portals...</div>
      ) : loadError ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ color: 'var(--error)', marginBottom: '16px', fontWeight: 600 }}>{loadError}</p>
          <button onClick={fetchPortals} style={{ padding: '8px 20px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          {search ? 'No portals match your search' : 'No discoverable portals found'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(portal => (
            <div
              key={portal.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '14px 16px', borderRadius: '10px',
                background: 'var(--bg-secondary)', border: '1px solid var(--stroke)',
              }}
            >
              {/* Icon */}
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                background: portal.iconHash ? undefined : getDeterministicGradient(portal.name),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', color: 'white', fontWeight: 700, fontSize: '18px',
              }}>
                {portal.iconHash ? (
                  <img src={`${API_BASE}/files/${portal.iconHash}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                ) : (
                  portal.name.charAt(0).toUpperCase()
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{portal.name}</span>
                  {portal.isPinned && (
                    <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(234,179,8,0.15)', color: 'var(--warning)' }}>Pinned</span>
                  )}
                  {portal.isFeatured && (
                    <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(139,92,246,0.15)', color: 'var(--accent-purple)' }}>Featured</span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Users size={12} /> {portal.memberCount.toLocaleString()}
                  </span>
                  {portal.description && (
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {portal.description}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button
                  disabled={updating === portal.id}
                  onClick={() => handleUpdate(portal.id, { isPinned: !portal.isPinned })}
                  title={portal.isPinned ? 'Unpin' : 'Pin'}
                  style={{
                    padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--stroke)',
                    background: portal.isPinned ? 'rgba(234,179,8,0.15)' : 'var(--bg-tertiary)',
                    color: portal.isPinned ? 'var(--warning)' : 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px',
                  }}
                >
                  <Pin size={14} /> {portal.isPinned ? 'Unpin' : 'Pin'}
                </button>

                <button
                  disabled={updating === portal.id}
                  onClick={() => handleUpdate(portal.id, { isFeatured: !portal.isFeatured })}
                  title={portal.isFeatured ? 'Unfeature' : 'Feature'}
                  style={{
                    padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--stroke)',
                    background: portal.isFeatured ? 'rgba(139,92,246,0.15)' : 'var(--bg-tertiary)',
                    color: portal.isFeatured ? 'var(--accent-purple)' : 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px',
                  }}
                >
                  <Star size={14} /> {portal.isFeatured ? 'Unfeature' : 'Feature'}
                </button>

                {confirmRemove === portal.id ? (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      disabled={updating === portal.id}
                      onClick={() => handleUpdate(portal.id, { isPublic: false })}
                      style={{
                        padding: '6px 10px', borderRadius: '6px', cursor: 'pointer',
                        background: 'var(--error)', border: 'none', color: 'white',
                        fontSize: '12px',
                      }}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmRemove(null)}
                      style={{
                        padding: '6px 10px', borderRadius: '6px', cursor: 'pointer',
                        background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                        color: 'var(--text-secondary)', fontSize: '12px',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    disabled={updating === portal.id}
                    onClick={() => setConfirmRemove(portal.id)}
                    title="Remove from Discover"
                    style={{
                      padding: '6px 10px', borderRadius: '6px', cursor: 'pointer',
                      background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                      color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px',
                    }}
                  >
                    <EyeOff size={14} /> Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
