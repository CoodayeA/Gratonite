import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCosmeticsStore } from '@/stores/cosmetics.store';
import type { EquippedCosmetic } from '@/stores/cosmetics.store';

interface Cosmetic {
  id: string;
  name: string;
  description: string | null;
  type: 'avatar_decoration' | 'effect' | 'nameplate' | 'soundboard';
  previewImageUrl: string | null;
  assetUrl: string | null;
  price: number;
}

interface OwnedCosmetic {
  id: string;
  cosmeticId: string;
  isEquipped: boolean;
  cosmetic: Cosmetic;
}

const TYPE_LABEL: Record<string, string> = {
  avatar_decoration: 'Avatar Decorations',
  effect: 'Profile Effects',
  nameplate: 'Nameplates',
  soundboard: 'Soundboard Sounds',
};

const TYPE_ORDER = ['avatar_decoration', 'effect', 'nameplate', 'soundboard'] as const;

const S = {
  page: { minHeight: '100vh', background: 'var(--bg-primary, #0d0b1a)', color: 'var(--text, #e8e4e0)' },
  header: {
    padding: '32px 32px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--text, #e8e4e0)' },
  subtitle: { margin: '6px 0 0', fontSize: 14, color: '#a8a4b8' },
  body: { padding: '28px 32px' },
  section: { marginBottom: 36 },
  sectionTitle: { fontSize: 13, fontWeight: 700, letterSpacing: 1, color: '#6b6880', textTransform: 'uppercase' as const, marginBottom: 14 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 },
  card: {
    background: 'var(--bg-secondary, #1a1730)', borderRadius: 12,
    padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 10,
    border: '1px solid rgba(255,255,255,0.06)', transition: 'border-color 0.2s',
  },
  cardEquipped: { borderColor: '#d4af37' },
  previewBox: {
    background: '#0d0b1a', borderRadius: 8, height: 120,
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  previewImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' as const },
  previewEmpty: { color: '#4a4560', fontSize: 36 },
  cardName: { fontSize: 14, fontWeight: 600, color: 'var(--text, #e8e4e0)', margin: 0 },
  equippedBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 11, fontWeight: 600, color: '#d4af37', padding: '2px 8px',
    background: 'rgba(212,175,55,0.1)', borderRadius: 20,
  },
  equipBtn: {
    padding: '7px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, width: '100%',
    background: 'rgba(212,175,55,0.15)', color: '#d4af37',
  },
  unequipBtn: {
    padding: '7px 12px', borderRadius: 7,
    border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, width: '100%',
    background: 'transparent', color: '#a8a4b8',
  },
  empty: { textAlign: 'center' as const, padding: '48px 0', color: '#a8a4b8' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15 },
  toast: {
    position: 'fixed' as const, bottom: 24, right: 24,
    background: '#276749', color: '#9ae6b4',
    padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
    zIndex: 9999,
  },
};

export function CosmeticsInventoryPage() {
  const [owned, setOwned] = useState<OwnedCosmetic[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const { equipped, setEquipped, unsetEquipped, loadEquipped } = useCosmeticsStore();

  async function load() {
    setLoading(true);
    try {
      const data = await api.cosmetics.listMine();
      setOwned(data as OwnedCosmetic[]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadEquipped();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }

  async function handleEquip(item: OwnedCosmetic) {
    setBusyId(item.id);
    try {
      await api.cosmetics.equip(item.cosmeticId);
      setEquipped({ ...item.cosmetic } as EquippedCosmetic);
      setOwned((prev) =>
        prev.map((o) =>
          o.cosmetic.type === item.cosmetic.type
            ? { ...o, isEquipped: o.id === item.id }
            : o,
        ),
      );
      showToast(`✓ "${item.cosmetic.name}" equipped`);
    } catch {
      showToast('Failed to equip. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnequip(item: OwnedCosmetic) {
    setBusyId(item.id);
    try {
      await api.cosmetics.unequip(item.cosmeticId);
      unsetEquipped(item.cosmetic.type);
      setOwned((prev) =>
        prev.map((o) => (o.id === item.id ? { ...o, isEquipped: false } : o)),
      );
      showToast(`"${item.cosmetic.name}" unequipped`);
    } catch {
      showToast('Failed to unequip. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  // Group owned cosmetics by type
  const byType: Partial<Record<string, OwnedCosmetic[]>> = {};
  for (const item of owned) {
    const t = item.cosmetic.type;
    if (!byType[t]) byType[t] = [];
    byType[t]!.push(item);
  }

  const totalOwned = owned.length;
  const totalEquipped = Object.keys(equipped).length;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}>My Cosmetics</h1>
          <p style={S.subtitle}>{totalOwned} owned · {totalEquipped} equipped</p>
        </div>
      </div>

      <div style={S.body}>
        {loading ? (
          <p style={{ color: '#a8a4b8' }}>Loading…</p>
        ) : totalOwned === 0 ? (
          <div style={S.empty}>
            <div style={S.emptyIcon}>🎨</div>
            <p style={S.emptyText}>You haven't purchased any cosmetics yet.</p>
          </div>
        ) : (
          TYPE_ORDER.map((type) => {
            const items = byType[type];
            if (!items || items.length === 0) return null;
            return (
              <div key={type} style={S.section}>
                <div style={S.sectionTitle}>{TYPE_LABEL[type]}</div>
                <div style={S.grid}>
                  {items.map((item) => {
                    const isEquipped = item.isEquipped || equipped[type]?.id === item.cosmeticId;
                    const busy = busyId === item.id;
                    return (
                      <div
                        key={item.id}
                        style={{ ...S.card, ...(isEquipped ? S.cardEquipped : {}) }}
                      >
                        <div style={S.previewBox}>
                          {item.cosmetic.previewImageUrl
                            ? <img src={item.cosmetic.previewImageUrl} alt={item.cosmetic.name} style={S.previewImg} />
                            : <span style={S.previewEmpty}>🎨</span>
                          }
                        </div>
                        <p style={S.cardName}>{item.cosmetic.name}</p>
                        {isEquipped && <span style={S.equippedBadge}>✦ Equipped</span>}
                        {isEquipped
                          ? (
                            <button
                              style={S.unequipBtn}
                              onClick={() => handleUnequip(item)}
                              disabled={busy}
                            >
                              {busy ? '…' : 'Unequip'}
                            </button>
                          ) : (
                            <button
                              style={S.equipBtn}
                              onClick={() => handleEquip(item)}
                              disabled={busy}
                            >
                              {busy ? '…' : 'Equip'}
                            </button>
                          )
                        }
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}
