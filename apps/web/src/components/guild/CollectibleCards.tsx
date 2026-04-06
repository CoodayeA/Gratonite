/**
 * 128. Collectible Cards — Card collection, pack opening, and trading UI.
 */
import { useState, useEffect, useCallback } from 'react';
import { Package, Repeat, Star, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface Card {
  id: string;
  name: string;
  rarity: string;
  imageUrl?: string;
  description?: string;
  series?: string;
}

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

const RARITY_BG: Record<string, string> = {
  common: 'from-gray-700 to-gray-800',
  uncommon: 'from-green-900 to-gray-800',
  rare: 'from-blue-900 to-gray-800',
  epic: 'from-purple-900 to-gray-800',
  legendary: 'from-yellow-900 to-gray-800',
};

export default function CollectibleCards() {
  const [tab, setTab] = useState<'collection' | 'packs' | 'trades'>('collection');
  const [collection, setCollection] = useState<Card[]>([]);
  const [packs, setPacks] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [openedCards, setOpenedCards] = useState<Card[] | null>(null);
  const { addToast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      if (tab === 'collection') setCollection(await api.collectibleCards.getCollection());
      else if (tab === 'packs') setPacks(await api.collectibleCards.getPacks());
      else setTrades(await api.collectibleCards.getTrades());
    } catch { addToast({ title: 'Failed to load cards', variant: 'error' }); }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openPack = async (packId: string) => {
    try {
      const result = await api.collectibleCards.openPack(packId);
      setOpenedCards(result.cards as unknown as Card[]);
      fetchData();
    } catch { addToast({ title: 'Failed to open pack', variant: 'error' }); }
  };

  const acceptTrade = async (tradeId: string) => {
    try { await api.collectibleCards.acceptTrade(tradeId); fetchData(); } catch { addToast({ title: 'Failed to accept trade', variant: 'error' }); }
  };

  const declineTrade = async (tradeId: string) => {
    try { await api.collectibleCards.declineTrade(tradeId); fetchData(); } catch { addToast({ title: 'Failed to decline trade', variant: 'error' }); }
  };

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <h3 className="text-white font-medium flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-yellow-400" /> Collectible Cards
      </h3>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['collection', 'packs', 'trades'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setOpenedCards(null); }}
            className={`px-3 py-1.5 text-sm rounded capitalize ${
              tab === t ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Pack opening animation */}
      {openedCards && (
        <div className="mb-4 p-4 bg-gray-800 rounded-lg border border-yellow-700">
          <h4 className="text-sm text-yellow-400 font-medium mb-3 flex items-center gap-1">
            <Star className="w-4 h-4" /> Cards Received!
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {openedCards.map((card, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg bg-gradient-to-b ${RARITY_BG[card.rarity] || RARITY_BG.common} border`}
                style={{ borderColor: RARITY_COLORS[card.rarity] || RARITY_COLORS.common }}
              >
                <div className="w-full aspect-square bg-gray-700/50 rounded mb-2 flex items-center justify-center">
                  {card.imageUrl ? (
                    <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover rounded" />
                  ) : (
                    <Star className="w-8 h-8" style={{ color: RARITY_COLORS[card.rarity] }} />
                  )}
                </div>
                <p className="text-xs text-white font-medium text-center truncate">{card.name}</p>
                <p className="text-xs text-center capitalize" style={{ color: RARITY_COLORS[card.rarity] }}>{card.rarity}</p>
              </div>
            ))}
          </div>
          <button onClick={() => setOpenedCards(null)} className="mt-3 text-xs text-gray-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Collection */}
      {tab === 'collection' && (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[400px] overflow-y-auto">
          {collection.map(card => (
            <div
              key={card.id}
              className={`p-2 rounded-lg bg-gradient-to-b ${RARITY_BG[card.rarity] || RARITY_BG.common} border cursor-default`}
              style={{ borderColor: `${RARITY_COLORS[card.rarity] || RARITY_COLORS.common}50` }}
              title={`${card.name} (${card.rarity})${card.description ? '\n' + card.description : ''}`}
            >
              <div className="w-full aspect-square bg-gray-700/50 rounded mb-1 flex items-center justify-center">
                {card.imageUrl ? (
                  <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover rounded" />
                ) : (
                  <Star className="w-6 h-6" style={{ color: RARITY_COLORS[card.rarity] }} />
                )}
              </div>
              <p className="text-xs text-white truncate text-center">{card.name}</p>
            </div>
          ))}
          {collection.length === 0 && (
            <p className="text-gray-500 text-sm col-span-full">No cards yet. Open packs to start collecting!</p>
          )}
        </div>
      )}

      {/* Packs */}
      {tab === 'packs' && (
        <div className="space-y-2">
          {packs.map(pack => (
            <div key={pack.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
              <Package className="w-8 h-8 text-indigo-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-white font-medium">{pack.name}</p>
                <p className="text-xs text-gray-400">{pack.cardCount || 3} cards per pack</p>
              </div>
              <button
                onClick={() => openPack(pack.id)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded font-medium"
              >
                Open ({pack.cost || 0} coins)
              </button>
            </div>
          ))}
          {packs.length === 0 && <p className="text-gray-500 text-sm">No packs available right now.</p>}
        </div>
      )}

      {/* Trades */}
      {tab === 'trades' && (
        <div className="space-y-2">
          {trades.map(trade => (
            <div key={trade.tradeId || trade.id} className="p-3 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Repeat className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-white">Trade with {trade.withUsername || 'user'}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                  trade.status === 'pending' ? 'bg-yellow-900/30 text-yellow-400' :
                  trade.status === 'accepted' ? 'bg-green-900/30 text-green-400' :
                  'bg-gray-700 text-gray-400'
                }`}>
                  {trade.status}
                </span>
              </div>
              {trade.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => acceptTrade(trade.tradeId || trade.id)} className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded">
                    Accept
                  </button>
                  <button onClick={() => declineTrade(trade.tradeId || trade.id)} className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded">
                    Decline
                  </button>
                </div>
              )}
            </div>
          ))}
          {trades.length === 0 && <p className="text-gray-500 text-sm">No active trades.</p>}
        </div>
      )}
    </div>
  );
}
