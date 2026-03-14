/**
 * 125. User Titles / Flairs — Display and equip user titles.
 */
import { useState, useEffect } from 'react';
import { Award, Check, Crown } from 'lucide-react';
import { api } from '../../lib/api';

interface Title {
  id: string;
  name: string;
  color: string;
  rarity: string;
  description?: string;
}

/** Inline badge for showing a user's equipped title */
export function UserTitleBadge({ userId }: { userId: string }) {
  const [title, setTitle] = useState<{ name: string; color: string; rarity: string } | null>(null);

  useEffect(() => {
    api.userTitles.getUserTitle(userId).then(setTitle).catch(() => {});
  }, [userId]);

  if (!title) return null;

  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: `${title.color}20`, color: title.color, border: `1px solid ${title.color}40` }}
    >
      {title.name}
    </span>
  );
}

/** Full title manager for settings/profile */
export default function UserTitleManager() {
  const [allTitles, setAllTitles] = useState<Title[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [equippedId, setEquippedId] = useState<string | null>(null);

  useEffect(() => {
    api.userTitles.listAll().then(setAllTitles).catch(() => {});
    api.userTitles.listOwned().then(owned => {
      setOwnedIds(new Set(owned.map((t: any) => t.titleId || t.id)));
      const equipped = owned.find((t: any) => t.equipped);
      if (equipped) setEquippedId(equipped.titleId || equipped.id);
    }).catch(() => {});
  }, []);

  const equip = async (titleId: string) => {
    try {
      await api.userTitles.equip(titleId);
      setEquippedId(titleId);
    } catch {}
  };

  const unequip = async () => {
    try {
      await api.userTitles.unequip();
      setEquippedId(null);
    } catch {}
  };

  const rarityOrder: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
  const sorted = [...allTitles].sort((a, b) => (rarityOrder[b.rarity] ?? 0) - (rarityOrder[a.rarity] ?? 0));

  const rarityColor: Record<string, string> = {
    common: '#9ca3af', uncommon: '#22c55e', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b',
  };

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <h3 className="text-white font-medium flex items-center gap-2 mb-4">
        <Crown className="w-5 h-5 text-yellow-400" /> Titles & Flairs
      </h3>

      {equippedId && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-indigo-900/20 border border-indigo-800 rounded-lg">
          <span className="text-xs text-gray-400">Equipped:</span>
          <span className="text-sm text-white font-medium">
            {allTitles.find(t => t.id === equippedId)?.name || 'Unknown'}
          </span>
          <button onClick={unequip} className="ml-auto text-xs text-red-400 hover:text-red-300">Remove</button>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map(title => {
          const owned = ownedIds.has(title.id);
          const equipped = equippedId === title.id;
          return (
            <div
              key={title.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                owned ? 'bg-gray-800 border-gray-700' : 'bg-gray-800/40 border-gray-700/50 opacity-50'
              }`}
            >
              <Award className="w-5 h-5 flex-shrink-0" style={{ color: title.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium">{title.name}</span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded capitalize"
                    style={{ color: rarityColor[title.rarity] || '#9ca3af', backgroundColor: `${rarityColor[title.rarity] || '#9ca3af'}15` }}
                  >
                    {title.rarity}
                  </span>
                </div>
                {title.description && (
                  <p className="text-xs text-gray-500 truncate">{title.description}</p>
                )}
              </div>
              {owned && !equipped && (
                <button onClick={() => equip(title.id)} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded">
                  Equip
                </button>
              )}
              {equipped && (
                <Check className="w-4 h-4 text-green-400" />
              )}
              {!owned && (
                <span className="text-xs text-gray-500">Locked</span>
              )}
            </div>
          );
        })}
        {sorted.length === 0 && <p className="text-gray-500 text-sm">No titles available yet.</p>}
      </div>
    </div>
  );
}
