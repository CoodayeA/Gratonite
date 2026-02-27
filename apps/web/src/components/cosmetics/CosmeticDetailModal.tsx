import React, { useState } from 'react';
import { api } from '@/lib/api';

interface Cosmetic {
  id: string;
  name: string;
  description: string | null;
  type: string;
  previewImageUrl: string | null;
  price: number;
  creatorId: string;
}

interface CosmeticDetailModalProps {
  cosmetic: Cosmetic;
  owned: boolean;
  onClose: () => void;
  onPurchased: (id: string) => void;
}

const S = {
  overlay: {
    position: 'fixed' as const, inset: 0,
    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'var(--bg-secondary, #1a1730)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, width: 420, maxWidth: '95vw',
    padding: 28, display: 'flex', flexDirection: 'column' as const, gap: 20,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  title: { margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text, #e8e4e0)' },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#a8a4b8', fontSize: 20, padding: 4,
  },
  previewBox: {
    background: '#0d0b1a', borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 200,
  },
  previewImg: { maxWidth: 200, maxHeight: 200, objectFit: 'contain' as const },
  previewEmpty: { color: '#4a4560', fontSize: 48 },
  badge: {
    display: 'inline-block', padding: '3px 10px', borderRadius: 20,
    fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
    background: 'rgba(212,175,55,0.15)', color: '#d4af37',
    textTransform: 'capitalize' as const,
  },
  desc: { margin: 0, fontSize: 14, color: '#a8a4b8', lineHeight: 1.6 },
  footer: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  price: { fontSize: 22, fontWeight: 700, color: '#d4af37' },
  priceSub: { fontSize: 12, color: '#6b6880', marginTop: 2 },
  buyBtn: {
    padding: '10px 24px', borderRadius: 8, border: 'none',
    background: 'linear-gradient(135deg,#d4af37,#c4a035)', color: '#1a1730',
    fontWeight: 700, fontSize: 15, cursor: 'pointer',
  },
  ownedBadge: {
    padding: '10px 24px', borderRadius: 8,
    background: 'rgba(34,197,94,0.15)', color: '#22c55e',
    fontWeight: 600, fontSize: 14,
  },
  errMsg: { fontSize: 13, color: '#ef4444', textAlign: 'center' as const },
};

const TYPE_LABEL: Record<string, string> = {
  avatar_decoration: 'Avatar Decoration',
  effect: 'Profile Effect',
  nameplate: 'Nameplate',
  soundboard: 'Soundboard Sound',
};

export function CosmeticDetailModal({ cosmetic, owned, onClose, onPurchased }: CosmeticDetailModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleBuy() {
    setError('');
    setBusy(true);
    try {
      await api.cosmetics.purchase(cosmetic.id);
      onPurchased(cosmetic.id);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? '';
      if (msg.includes('INSUFFICIENT_FUNDS')) setError('Not enough Gratonites.');
      else if (msg.includes('ALREADY_OWNED')) setError('You already own this.');
      else setError('Purchase failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.header}>
          <h2 style={S.title}>{cosmetic.name}</h2>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={S.previewBox}>
          {cosmetic.previewImageUrl
            ? <img src={cosmetic.previewImageUrl} alt={cosmetic.name} style={S.previewImg} />
            : <span style={S.previewEmpty}>🎨</span>
          }
        </div>

        <div>
          <span style={S.badge}>{TYPE_LABEL[cosmetic.type] ?? cosmetic.type}</span>
          {cosmetic.description && <p style={{ ...S.desc, marginTop: 12 }}>{cosmetic.description}</p>}
        </div>

        {error && <p style={S.errMsg}>{error}</p>}

        <div style={S.footer}>
          <div>
            <div style={S.price}>{cosmetic.price > 0 ? `${cosmetic.price} ✦` : 'Free'}</div>
            {cosmetic.price > 0 && <div style={S.priceSub}>Gratonites</div>}
          </div>
          {owned
            ? <div style={S.ownedBadge}>✓ Owned</div>
            : (
              <button style={S.buyBtn} onClick={handleBuy} disabled={busy}>
                {busy ? 'Buying…' : 'Buy Now'}
              </button>
            )
          }
        </div>
      </div>
    </div>
  );
}
