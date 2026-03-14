import { useState } from 'react';
import { Package, Sparkles, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';

interface CardPack {
  id: string;
  name: string;
  description: string | null;
  price: number;
  cardsCount: number;
  series: string | null;
  guaranteedRarity: string | null;
}

interface PulledCard {
  id: string;
  name: string;
  image: string;
  rarity: string;
  series: string;
  description: string | null;
}

const RARITY_COLORS: Record<string, string> = {
  common: '#94a3b8',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

const RARITY_GLOW: Record<string, string> = {
  common: '0 0 20px rgba(148,163,184,0.3)',
  uncommon: '0 0 30px rgba(34,197,94,0.4)',
  rare: '0 0 40px rgba(59,130,246,0.5)',
  epic: '0 0 50px rgba(168,85,247,0.6)',
  legendary: '0 0 60px rgba(245,158,11,0.7), 0 0 120px rgba(245,158,11,0.3)',
};

interface Props {
  packs: CardPack[];
  userCoins: number;
  onPackOpened?: () => void;
}

export default function PackOpening({ packs, userCoins, onPackOpened }: Props) {
  const [selectedPack, setSelectedPack] = useState<CardPack | null>(null);
  const [opening, setOpening] = useState(false);
  const [pulledCards, setPulledCards] = useState<PulledCard[]>([]);
  const [revealIndex, setRevealIndex] = useState(-1);
  const [coinsSpent, setCoinsSpent] = useState(0);

  const handleOpen = async () => {
    if (!selectedPack || opening) return;
    setOpening(true);
    setPulledCards([]);
    setRevealIndex(-1);
    try {
      const result = await api.collectibleCards.openPack(selectedPack.id);
      setPulledCards(result.cards as any);
      setCoinsSpent(result.coinsSpent);
      // Start reveal sequence
      setRevealIndex(0);
    } catch {
      setOpening(false);
    }
  };

  const handleNext = () => {
    if (revealIndex < pulledCards.length - 1) {
      setRevealIndex(revealIndex + 1);
    } else {
      // Done — reset
      setPulledCards([]);
      setRevealIndex(-1);
      setOpening(false);
      setSelectedPack(null);
      onPackOpened?.();
    }
  };

  // Reveal view
  if (pulledCards.length > 0 && revealIndex >= 0) {
    const card = pulledCards[revealIndex];
    const isLast = revealIndex === pulledCards.length - 1;
    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Card {revealIndex + 1} of {pulledCards.length}
          </span>
        </div>

        <div
          onClick={handleNext}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            cursor: 'pointer', padding: '20px',
          }}
        >
          <div style={{
            width: '180px', height: '240px', borderRadius: '14px', overflow: 'hidden',
            border: `3px solid ${RARITY_COLORS[card.rarity] || '#666'}`,
            boxShadow: RARITY_GLOW[card.rarity] || 'none',
            background: `url(${card.image}) center/cover no-repeat`,
            animation: 'cardReveal 0.5s ease-out',
          }} />

          <h3 style={{
            margin: '14px 0 4px', fontSize: '18px', fontWeight: 700,
            color: 'var(--text-primary)',
          }}>
            {card.name}
          </h3>

          <span style={{
            fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            padding: '2px 10px', borderRadius: '4px',
            background: `${RARITY_COLORS[card.rarity]}20`,
            color: RARITY_COLORS[card.rarity],
          }}>
            {card.rarity}
          </span>

          {card.rarity === 'legendary' && (
            <Sparkles size={18} color="#f59e0b" style={{ marginTop: '8px' }} />
          )}

          {card.description && (
            <p style={{
              fontSize: '12px', color: 'var(--text-secondary)',
              marginTop: '8px', textAlign: 'center', maxWidth: '240px',
            }}>
              {card.description}
            </p>
          )}

          <div style={{
            marginTop: '16px', display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: '13px', color: 'var(--accent-primary)',
          }}>
            {isLast ? 'Done' : 'Next card'}
            <ChevronRight size={14} />
          </div>
        </div>

        {/* Thumbnail strip */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '6px',
          marginTop: '8px',
        }}>
          {pulledCards.map((c, i) => (
            <div key={i} style={{
              width: '32px', height: '42px', borderRadius: '4px', overflow: 'hidden',
              border: `2px solid ${i === revealIndex ? RARITY_COLORS[c.rarity] : 'rgba(255,255,255,0.1)'}`,
              opacity: i <= revealIndex ? 1 : 0.3,
              background: i <= revealIndex
                ? `url(${c.image}) center/cover no-repeat`
                : 'var(--bg-elevated)',
            }} />
          ))}
        </div>

        <style>{`
          @keyframes cardReveal {
            0% { transform: scale(0.5) rotateY(180deg); opacity: 0; }
            60% { transform: scale(1.08) rotateY(0deg); opacity: 1; }
            100% { transform: scale(1) rotateY(0deg); }
          }
        `}</style>
      </div>
    );
  }

  // Pack selection view
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        marginBottom: '12px', fontSize: '12px', color: 'var(--text-muted)',
      }}>
        <span>Your balance:</span>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{userCoins} coins</span>
      </div>

      {packs.length === 0 && (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>
          No packs available right now.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {packs.map(pack => {
          const canAfford = userCoins >= pack.price;
          const isSelected = selectedPack?.id === pack.id;
          return (
            <div
              key={pack.id}
              onClick={() => !opening && setSelectedPack(isSelected ? null : pack)}
              style={{
                padding: '12px 14px', borderRadius: '10px', cursor: opening ? 'default' : 'pointer',
                background: isSelected ? 'rgba(99,102,241,0.12)' : 'var(--bg-elevated)',
                border: `1.5px solid ${isSelected ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                opacity: !canAfford ? 0.5 : 1,
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Package size={20} color={isSelected ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {pack.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                      {pack.cardsCount} cards{pack.series ? ` · ${pack.series}` : ''}
                      {pack.guaranteedRarity && ` · ${pack.guaranteedRarity}+ guaranteed`}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: canAfford ? 'var(--text-primary)' : '#ef4444' }}>
                  {pack.price} coins
                </span>
              </div>
              {pack.description && (
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', paddingLeft: '30px' }}>
                  {pack.description}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {selectedPack && (
        <button
          onClick={handleOpen}
          disabled={opening || userCoins < selectedPack.price}
          style={{
            width: '100%', marginTop: '14px', padding: '10px',
            borderRadius: '8px', border: 'none', cursor: opening ? 'wait' : 'pointer',
            background: 'var(--accent-primary)', color: '#fff',
            fontSize: '14px', fontWeight: 600,
            opacity: opening || userCoins < selectedPack.price ? 0.6 : 1,
          }}
        >
          {opening ? 'Opening...' : `Open Pack — ${selectedPack.price} coins`}
        </button>
      )}
    </div>
  );
}
