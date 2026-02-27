import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

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
  creatorId: string;
}

const TYPE_LABELS: Record<CosmeticType, string> = {
  avatar_decoration: 'Avatar Decoration',
  effect: 'Effect',
  nameplate: 'Nameplate',
  soundboard: 'Soundboard',
};

const TYPE_FILTERS = [
  { value: '', label: 'All Types' },
  { value: 'avatar_decoration', label: 'Avatar Decorations' },
  { value: 'effect', label: 'Effects' },
  { value: 'nameplate', label: 'Nameplates' },
  { value: 'soundboard', label: 'Soundboard' },
];

const s = {
  page: { padding: 32, color: '#e8e4e0', minHeight: '100%', background: '#1a1a2e' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { margin: 0, fontSize: 24, fontWeight: 700 },
  subtitle: { color: '#a8a4b8', fontSize: 14, margin: '4px 0 24px' },
  controls: { display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' as const, alignItems: 'center' },
  search: {
    flex: 1, minWidth: 200,
    padding: '10px 14px',
    background: '#12121f', border: '1px solid #3a3650',
    borderRadius: 8, color: '#e8e4e0', fontSize: 14, outline: 'none',
  },
  select: {
    padding: '10px 14px',
    background: '#12121f', border: '1px solid #3a3650',
    borderRadius: 8, color: '#e8e4e0', fontSize: 14, outline: 'none', cursor: 'pointer',
  },
  filterBtn: (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 20, border: '1px solid',
    borderColor: active ? '#d4af37' : '#3a3650',
    background: active ? '#d4af3718' : 'transparent',
    color: active ? '#d4af37' : '#a8a4b8',
    fontSize: 13, cursor: 'pointer', fontWeight: active ? 600 : 400,
  }),
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 },
  card: {
    background: '#12121f', border: '1px solid #3a3650',
    borderRadius: 10, overflow: 'hidden' as const,
    cursor: 'pointer', transition: 'border-color 0.2s',
  },
  cardImg: { width: '100%', height: 160, objectFit: 'cover' as const, background: '#0d0d1a' },
  cardImgPlaceholder: {
    width: '100%', height: 160,
    background: '#0d0d1a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#3a3650', fontSize: 40,
  },
  cardBody: { padding: 14 },
  cardName: { margin: '0 0 6px', fontSize: 15, fontWeight: 600 },
  cardMeta: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  typeBadge: {
    padding: '2px 8px', borderRadius: 4,
    background: '#2a2a3e', color: '#a8a4b8',
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const,
  },
  price: { marginLeft: 'auto', fontSize: 14, color: '#d4af37', fontWeight: 700 },
  buyBtn: {
    width: '100%', padding: '8px 0',
    border: 'none', borderRadius: 6,
    background: '#d4af37', color: '#1a1a2e',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  loadMore: {
    display: 'block', margin: '32px auto 0',
    padding: '10px 28px', borderRadius: 8,
    border: '1px solid #3a3650', background: 'transparent',
    color: '#a8a4b8', fontSize: 14, cursor: 'pointer',
  },
  empty: { textAlign: 'center' as const, padding: 64, color: '#a8a4b8' },
  createBtn: {
    padding: '10px 20px', borderRadius: 8,
    background: 'transparent', border: '1px solid #d4af37' as any,
    color: '#d4af37', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  toast: {
    position: 'fixed' as const, bottom: 24, right: 24,
    background: '#276749', color: '#9ae6b4',
    padding: '12px 20px', borderRadius: 8,
    fontSize: 14, fontWeight: 600, zIndex: 2000,
  },
  purchaseOverlay: {
    position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  purchaseModal: {
    background: '#1e1e2e', border: '1px solid #3a3650',
    borderRadius: 12, padding: 28, width: 400,
    color: '#e8e4e0',
  },
  purchaseTitle: { margin: '0 0 16px', fontSize: 18, fontWeight: 700 },
  purchaseRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14 },
  purchaseActions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 },
  btn: { padding: '10px 20px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnPrimary: { background: '#d4af37', color: '#1a1a2e' },
  btnSecondary: { background: '#3a3650', color: '#e8e4e0' },
  errorMsg: { color: '#fc8181', fontSize: 13, marginTop: 8 },
};

export function CosmeticsMarketplacePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Cosmetic[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [purchasing, setPurchasing] = useState<Cosmetic | null>(null);
  const [purchaseError, setPurchaseError] = useState('');
  const [purchasing2, setPurchasing2] = useState(false);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const newOffset = reset ? 0 : offset;
      const data = await api.cosmetics.browse({ type: typeFilter || undefined, limit: 20, offset: newOffset }) as Cosmetic[];
      if (reset) {
        setItems(data);
        setOffset(20);
      } else {
        setItems(prev => [...prev, ...data]);
        setOffset(prev => prev + 20);
      }
      setHasMore(data.length === 20);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, offset]);

  useEffect(() => { load(true); }, [typeFilter]);

  useEffect(() => {
    api.cosmetics.getEquipped().then(equipped => {
      // Also try to get purchased items - for now track from purchase actions
    }).catch(() => {});
  }, []);

  const displayed = search
    ? items.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  async function handleBuy(cosmetic: Cosmetic) {
    setPurchaseError('');
    setPurchasing(cosmetic);
  }

  async function confirmPurchase() {
    if (!purchasing) return;
    setPurchasing2(true);
    setPurchaseError('');
    try {
      await api.cosmetics.purchase(purchasing.id);
      setOwnedIds(prev => new Set([...prev, purchasing.id]));
      setPurchasing(null);
      showToast('Cosmetic added to your collection!');
    } catch (e: any) {
      const code = e?.code ?? e?.message ?? 'UNKNOWN';
      if (code === 'INSUFFICIENT_FUNDS') {
        setPurchaseError('Not enough Gratonites. Visit the Gratonite hub to get more.');
      } else if (code === 'ALREADY_OWNED') {
        setPurchaseError('You already own this cosmetic.');
      } else {
        setPurchaseError('Purchase failed. Please try again.');
      }
    } finally {
      setPurchasing2(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Cosmetics Marketplace</h1>
        <button style={s.createBtn} onClick={() => navigate('/creator/dashboard')}>
          + Create & Sell
        </button>
      </div>
      <p style={s.subtitle}>Browse and purchase cosmetics created by the community</p>

      <div style={s.controls}>
        <input
          style={s.search}
          placeholder="Search cosmetics..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {TYPE_FILTERS.map(f => (
          <button key={f.value} style={s.filterBtn(typeFilter === f.value)} onClick={() => setTypeFilter(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && items.length === 0 ? (
        <div style={s.empty}>Loading...</div>
      ) : displayed.length === 0 ? (
        <div style={s.empty}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛍️</div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>No cosmetics found</div>
          <div style={{ fontSize: 13 }}>Be the first to create and sell cosmetics!</div>
        </div>
      ) : (
        <>
          <div style={s.grid}>
            {displayed.map(c => (
              <div key={c.id} style={s.card}>
                {c.previewImageUrl
                  ? <img src={c.previewImageUrl} alt={c.name} style={s.cardImg} />
                  : <div style={s.cardImgPlaceholder}>✨</div>
                }
                <div style={s.cardBody}>
                  <p style={s.cardName}>{c.name}</p>
                  <div style={s.cardMeta}>
                    <span style={s.typeBadge}>{TYPE_LABELS[c.type]}</span>
                    <span style={s.price}>{c.price > 0 ? `${c.price} G` : 'Free'}</span>
                  </div>
                  {ownedIds.has(c.id) ? (
                    <button
                      style={{ ...s.buyBtn, background: '#276749', color: '#9ae6b4' }}
                      onClick={() => navigate('/cosmetics/inventory')}
                    >
                      Owned — Go to Inventory
                    </button>
                  ) : (
                    <button style={s.buyBtn} onClick={() => handleBuy(c)}>
                      {c.price > 0 ? `Buy for ${c.price} G` : 'Get Free'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {hasMore && !search && (
            <button style={s.loadMore} onClick={() => load(false)}>Load more</button>
          )}
        </>
      )}

      {purchasing && (
        <div style={s.purchaseOverlay} onClick={e => e.target === e.currentTarget && setPurchasing(null)}>
          <div style={s.purchaseModal}>
            <h2 style={s.purchaseTitle}>Confirm Purchase</h2>
            {purchasing.previewImageUrl && (
              <img src={purchasing.previewImageUrl} alt={purchasing.name} style={{ width: '100%', maxHeight: 120, objectFit: 'contain', borderRadius: 8, background: '#12121f', marginBottom: 16 }} />
            )}
            <div style={s.purchaseRow}><span>Cosmetic</span><strong>{purchasing.name}</strong></div>
            <div style={s.purchaseRow}><span>Price</span><strong style={{ color: '#d4af37' }}>{purchasing.price > 0 ? `${purchasing.price} G` : 'Free'}</strong></div>
            {purchaseError && <div style={s.errorMsg}>{purchaseError}</div>}
            <div style={s.purchaseActions}>
              <button style={{ ...s.btn, ...s.btnSecondary }} onClick={() => setPurchasing(null)} disabled={purchasing2}>Cancel</button>
              <button style={{ ...s.btn, ...s.btnPrimary }} onClick={confirmPurchase} disabled={purchasing2}>
                {purchasing2 ? 'Purchasing...' : 'Confirm Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );
}
