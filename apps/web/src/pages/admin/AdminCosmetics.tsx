/**
 * AdminCosmetics.tsx — Admin page for reviewing marketplace cosmetic submissions.
 */

import { useState, useEffect } from 'react';
import { Palette, Check, X, RefreshCw, Eye } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/ToastManager';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const API_BASE = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/api\/v1$/, '');

export default function AdminCosmetics() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();
  const { prompt: promptDialog } = useConfirm();

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await api.get('/admin/cosmetics/pending') as any[];
      setItems(data);
    } catch {
      // Endpoint may not exist yet — show empty state
      setItems([]);
    }
    setLoading(false);
  };

  useEffect(() => { loadItems(); }, []);

  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/admin/cosmetics/${id}/approve`, {});
      addToast({ title: 'Cosmetic approved', variant: 'success' });
      loadItems();
    } catch (err: any) {
      addToast({ title: err?.message || 'Failed to approve', variant: 'error' });
    }
  };

  const handleReject = async (id: string) => {
    const reason = await promptDialog({ title: 'Reject cosmetic', message: 'Rejection reason:', placeholder: 'Reason shown to the creator', confirmLabel: 'Reject' });
    if (reason === null) return;
    try {
      await api.patch(`/admin/cosmetics/${id}/reject`, { reason });
      addToast({ title: 'Cosmetic rejected', variant: 'success' });
      loadItems();
    } catch (err: any) {
      addToast({ title: err?.message || 'Failed to reject', variant: 'error' });
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
      {/* Header */}
      <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid var(--stroke, #2a2a3e)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Palette size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, fontFamily: 'var(--font-display)' }}>Cosmetics Review</h1>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Approve or reject user-submitted marketplace items</p>
            </div>
          </div>
          <button onClick={loadItems} style={{ padding: '8px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }} title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} style={{ margin: '0 auto 12px', opacity: 0.4, animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: '13px' }}>Loading...</p>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            <Palette size={36} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
            <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>No items pending review</p>
            <p style={{ fontSize: '13px' }}>User-submitted cosmetics will appear here for approval.</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {items.map((item: any) => (
              <div key={item.id} style={{
                background: 'var(--bg-secondary, #1a1a2e)', borderRadius: '12px',
                border: '1px solid var(--stroke, #2a2a3e)', overflow: 'hidden',
              }}>
                {/* Preview */}
                {item.previewUrl && (
                  <div style={{ height: '140px', background: `url(${item.previewUrl}) center/cover`, position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '8px', right: '8px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(0,0,0,0.7)', fontSize: '11px', fontWeight: 600, color: '#fff' }}>
                      {item.type || 'cosmetic'}
                    </div>
                  </div>
                )}
                {!item.previewUrl && (
                  <div style={{ height: '80px', background: 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-primary))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Palette size={24} style={{ opacity: 0.3 }} />
                  </div>
                )}

                {/* Info */}
                <div style={{ padding: '14px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>{item.name}</h3>
                  {item.description && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.4 }}>{item.description}</p>}
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    {item.price != null && <span>Price: {item.price} coins · </span>}
                    <span>By @{item.creatorUsername || 'unknown'}</span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleApprove(item.id)}
                      style={{ flex: 1, padding: '7px', borderRadius: '6px', background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      onClick={() => handleReject(item.id)}
                      style={{ flex: 1, padding: '7px', borderRadius: '6px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--stroke)', cursor: 'pointer', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    >
                      <X size={14} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
