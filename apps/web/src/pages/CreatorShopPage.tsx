import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { CosmeticDetailModal } from '@/components/cosmetics/CosmeticDetailModal';

interface Cosmetic {
  id: string;
  name: string;
  description: string | null;
  type: string;
  previewImageUrl: string | null;
  assetUrl: string | null;
  price: number;
  creatorId: string;
}

const TYPE_LABEL: Record<string, string> = {
  avatar_decoration: 'Avatar Decoration',
  effect: 'Profile Effect',
  nameplate: 'Nameplate',
  soundboard: 'Sound',
};

const S = {
  page: { minHeight: '100vh', background: 'var(--bg-primary, #0d0b1a)', color: 'var(--text, #e8e4e0)' },
  header: {
    padding: '32px 32px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  backBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#a8a4b8', fontSize: 13, padding: 0, marginBottom: 16,
    display: 'flex', alignItems: 'center', gap: 6,
  },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text, #e8e4e0)' },
  sub: { margin: '6px 0 0', fontSize: 14, color: '#a8a4b8' },
  body: { padding: '24px 32px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 },
  card: {
    background: 'var(--bg-secondary, #1a1730)', borderRadius: 12,
    overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)',
    cursor: 'pointer', transition: 'transform 0.15s, border-color 0.15s',
  },
  previewBox: {
    background: '#0d0b1a', height: 140,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  previewImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' as const },
  previewEmpty: { fontSize: 42, color: '#4a4560' },
  cardBody: { padding: '12px 14px' },
  cardName: { margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text, #e8e4e0)' },
  cardType: { fontSize: 11, color: '#a8a4b8', marginTop: 3, textTransform: 'capitalize' as const },
  cardPrice: { fontSize: 16, fontWeight: 700, color: '#d4af37', marginTop: 6 },
  empty: { textAlign: 'center' as const, padding: '64px 0', color: '#a8a4b8' },
};

export function CreatorShopPage() {
  const { creatorId } = useParams<{ creatorId: string }>();
  const navigate = useNavigate();
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Cosmetic | null>(null);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!creatorId) return;
    setLoading(true);
    Promise.all([
      api.cosmetics.listByCreator(creatorId),
      api.cosmetics.listMine(),
    ]).then(([items, mine]) => {
      setCosmetics(items as Cosmetic[]);
      const owned = new Set<string>((mine as any[]).map((m: any) => m.cosmeticId as string));
      setOwnedIds(owned);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [creatorId]);

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate(-1)}>← Back</button>
        <h1 style={S.title}>Creator Shop</h1>
        <p style={S.sub}>{cosmetics.length} item{cosmetics.length !== 1 ? 's' : ''} available</p>
      </div>

      <div style={S.body}>
        {loading ? (
          <p style={{ color: '#a8a4b8' }}>Loading…</p>
        ) : cosmetics.length === 0 ? (
          <div style={S.empty}>
            <p>No cosmetics published yet.</p>
          </div>
        ) : (
          <div style={S.grid}>
            {cosmetics.map((c) => (
              <div
                key={c.id}
                style={S.card}
                onClick={() => setSelected(c)}
              >
                <div style={S.previewBox}>
                  {c.previewImageUrl
                    ? <img src={c.previewImageUrl} alt={c.name} style={S.previewImg} />
                    : <span style={S.previewEmpty}>🎨</span>
                  }
                </div>
                <div style={S.cardBody}>
                  <p style={S.cardName}>{c.name}</p>
                  <div style={S.cardType}>{TYPE_LABEL[c.type] ?? c.type}</div>
                  <div style={S.cardPrice}>{c.price > 0 ? `${c.price} ✦` : 'Free'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <CosmeticDetailModal
          cosmetic={selected}
          owned={ownedIds.has(selected.id)}
          onClose={() => setSelected(null)}
          onPurchased={(id) => {
            setOwnedIds((prev) => new Set(prev).add(id));
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
