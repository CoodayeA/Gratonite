import { useState, useEffect } from 'react';
import { Search, Filter, Star, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';

interface Card {
  id: string;
  name: string;
  image: string;
  rarity: string;
  series: string;
  description: string | null;
  owned: boolean;
  count: number;
}

const RARITY_COLORS: Record<string, string> = {
  common: '#94a3b8',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

const RARITY_BG: Record<string, string> = {
  common: 'rgba(148, 163, 184, 0.1)',
  uncommon: 'rgba(34, 197, 94, 0.1)',
  rare: 'rgba(59, 130, 246, 0.1)',
  epic: 'rgba(168, 85, 247, 0.1)',
  legendary: 'rgba(245, 158, 11, 0.15)',
};

export default function CardCollectionViewer() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRarity, setFilterRarity] = useState<string>('all');
  const [filterOwned, setFilterOwned] = useState<'all' | 'owned' | 'missing'>('all');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  useEffect(() => {
    api.collectibleCards.getCollection()
      .then(data => setCards(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = cards.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRarity !== 'all' && c.rarity !== filterRarity) return false;
    if (filterOwned === 'owned' && !c.owned) return false;
    if (filterOwned === 'missing' && c.owned) return false;
    return true;
  });

  const ownedCount = cards.filter(c => c.owned).length;
  const totalCount = cards.length;

  if (loading) {
    return <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '20px' }}>Loading collection...</p>;
  }

  return (
    <div>
      {/* Stats bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '16px', padding: '12px 16px', borderRadius: '10px',
        background: 'var(--bg-elevated)',
      }}>
        <div>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {ownedCount}/{totalCount}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>Cards Collected</span>
        </div>
        <div style={{
          width: '120px', height: '6px', borderRadius: '3px',
          background: 'rgba(255,255,255,0.1)', overflow: 'hidden',
        }}>
          <div style={{
            width: `${totalCount > 0 ? (ownedCount / totalCount) * 100 : 0}%`,
            height: '100%', borderRadius: '3px',
            background: 'linear-gradient(90deg, var(--accent-primary), #8b5cf6)',
          }} />
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '200px',
          padding: '6px 10px', borderRadius: '8px',
          background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
        }}>
          <Search size={14} color="var(--text-muted)" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search cards..."
            style={{
              flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)',
              fontSize: '13px', outline: 'none',
            }}
          />
        </div>
        <select
          value={filterRarity}
          onChange={e => setFilterRarity(e.target.value)}
          style={{
            padding: '6px 10px', borderRadius: '8px',
            background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
            color: 'var(--text-primary)', fontSize: '12px',
          }}
        >
          <option value="all">All Rarities</option>
          <option value="common">Common</option>
          <option value="uncommon">Uncommon</option>
          <option value="rare">Rare</option>
          <option value="epic">Epic</option>
          <option value="legendary">Legendary</option>
        </select>
        <select
          value={filterOwned}
          onChange={e => setFilterOwned(e.target.value as any)}
          style={{
            padding: '6px 10px', borderRadius: '8px',
            background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
            color: 'var(--text-primary)', fontSize: '12px',
          }}
        >
          <option value="all">All</option>
          <option value="owned">Owned</option>
          <option value="missing">Missing</option>
        </select>
      </div>

      {/* Card grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
        {filtered.map(card => (
          <div
            key={card.id}
            onClick={() => setSelectedCard(card)}
            style={{
              borderRadius: '12px', overflow: 'hidden', cursor: 'pointer',
              background: RARITY_BG[card.rarity] || 'var(--bg-elevated)',
              border: `2px solid ${card.owned ? (RARITY_COLORS[card.rarity] || 'var(--stroke)') : 'rgba(255,255,255,0.06)'}`,
              opacity: card.owned ? 1 : 0.4,
              transition: 'transform 0.2s, box-shadow 0.2s',
              position: 'relative',
            }}
          >
            <div style={{
              width: '100%', aspectRatio: '3/4',
              background: `url(${card.image}) center/cover no-repeat`,
              filter: card.owned ? 'none' : 'grayscale(100%)',
            }} />
            <div style={{ padding: '8px 10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {card.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: RARITY_COLORS[card.rarity], textTransform: 'uppercase' }}>
                  {card.rarity}
                </span>
                {card.count > 1 && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>x{card.count}</span>
                )}
              </div>
            </div>
            {card.rarity === 'legendary' && card.owned && (
              <Sparkles size={14} color="#f59e0b" style={{ position: 'absolute', top: 6, right: 6 }} />
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '40px 0' }}>
          No cards match your filters.
        </p>
      )}

      {/* Card detail modal */}
      {selectedCard && (
        <div
          onClick={() => setSelectedCard(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-secondary)', borderRadius: '16px', padding: '24px',
            width: '320px', maxWidth: '95vw', textAlign: 'center',
          }}>
            <div style={{
              width: '200px', height: '260px', margin: '0 auto 16px',
              borderRadius: '12px', overflow: 'hidden',
              border: `3px solid ${RARITY_COLORS[selectedCard.rarity]}`,
              background: `url(${selectedCard.image}) center/cover`,
              boxShadow: `0 0 20px ${RARITY_COLORS[selectedCard.rarity]}40`,
            }} />
            <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {selectedCard.name}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{
                fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                padding: '2px 8px', borderRadius: '4px',
                background: `${RARITY_COLORS[selectedCard.rarity]}20`,
                color: RARITY_COLORS[selectedCard.rarity],
              }}>
                {selectedCard.rarity}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{selectedCard.series}</span>
            </div>
            {selectedCard.description && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {selectedCard.description}
              </p>
            )}
            {selectedCard.owned && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                Owned: x{selectedCard.count}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
