import { useState, useEffect } from 'react';
import { Trophy, GripVertical, X, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface ShowcaseItem {
  id: string;
  slot: number;
  itemType: 'cosmetic' | 'achievement' | 'stat';
  referenceId: string;
  displayOrder: number;
}

interface ProfileShowcaseProps {
  userId: string;
  isOwn?: boolean;
}

const RARITY_STYLES: Record<string, string> = {
  legendary: 'ring-2 ring-yellow-500 shadow-yellow-500/30 shadow-lg',
  epic: 'ring-2 ring-purple-500 shadow-purple-500/30 shadow-lg',
  rare: 'ring-2 ring-blue-500 shadow-blue-500/20 shadow-md',
  common: 'ring-1 ring-gray-600',
};

const ITEM_TYPES = [
  { value: 'achievement', label: 'Achievement' },
  { value: 'cosmetic', label: 'Cosmetic' },
  { value: 'stat', label: 'Stat' },
];

const MAX_SLOTS = 12;

function getRarity(referenceId: string): string {
  // Determine rarity from referenceId prefix convention: "legendary:xxx", "epic:xxx", etc.
  const prefix = referenceId.split(':')[0];
  if (['legendary', 'epic', 'rare'].includes(prefix)) return prefix;
  return 'common';
}

function getItemLabel(item: ShowcaseItem): string {
  const parts = item.referenceId.split(':');
  return parts.length > 1 ? parts.slice(1).join(':') : item.referenceId;
}

export default function ProfileShowcase({ userId, isOwn }: ProfileShowcaseProps) {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [editing, setEditing] = useState(false);
  const [addSlot, setAddSlot] = useState<number | null>(null);
  const [newType, setNewType] = useState('achievement');
  const [newRefId, setNewRefId] = useState('');
  const [dragItem, setDragItem] = useState<number | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    loadShowcase();
  }, [userId]);

  async function loadShowcase() {
    try {
      const res = await api.get(`/users/${userId}/showcase`);
      setItems(res.data);
    } catch { /* no items */ }
  }

  async function saveItems(newItems: ShowcaseItem[]) {
    try {
      const res = await api.put('/users/@me/showcase', {
        items: newItems.map((item, i) => ({
          slot: item.slot,
          itemType: item.itemType,
          referenceId: item.referenceId,
        })),
      });
      setItems(res.data);
      addToast('Showcase updated', 'success');
    } catch {
      addToast('Failed to save', 'error');
    }
  }

  async function removeSlot(slot: number) {
    try {
      await api.delete(`/users/@me/showcase/${slot}`);
      setItems(items.filter(i => i.slot !== slot));
      addToast('Item removed', 'success');
    } catch {
      addToast('Failed to remove', 'error');
    }
  }

  function handleAddItem() {
    if (addSlot === null || !newRefId) return;
    const newItems = [
      ...items.filter(i => i.slot !== addSlot),
      { id: '', slot: addSlot, itemType: newType as ShowcaseItem['itemType'], referenceId: newRefId, displayOrder: items.length },
    ];
    saveItems(newItems);
    setAddSlot(null);
    setNewRefId('');
  }

  function handleDragStart(index: number) {
    setDragItem(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragItem === null || dragItem === index) return;
    const reordered = [...items];
    const [dragged] = reordered.splice(dragItem, 1);
    reordered.splice(index, 0, dragged);
    setItems(reordered);
    setDragItem(index);
  }

  function handleDragEnd() {
    if (dragItem !== null) {
      saveItems(items);
      setDragItem(null);
    }
  }

  const usedSlots = new Set(items.map(i => i.slot));
  const availableSlots = Array.from({ length: MAX_SLOTS }, (_, i) => i).filter(s => !usedSlots.has(s));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-1.5">
          <Trophy className="w-4 h-4" /> Showcase
        </h4>
        {isOwn && (
          <button
            onClick={() => setEditing(!editing)}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            {editing ? 'Done' : 'Edit'}
          </button>
        )}
      </div>

      {items.length === 0 && !editing && (
        <p className="text-xs text-gray-500 text-center py-3">
          {isOwn ? 'Add items to your showcase!' : 'No showcase items'}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {items.map((item, index) => {
          const rarity = getRarity(item.referenceId);
          return (
            <div
              key={item.slot}
              draggable={editing}
              onDragStart={() => handleDragStart(index)}
              onDragOver={e => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`bg-gray-800 rounded-lg p-3 text-center relative ${RARITY_STYLES[rarity]} ${editing ? 'cursor-grab' : ''}`}
            >
              {editing && (
                <>
                  <button
                    onClick={() => removeSlot(item.slot)}
                    className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="absolute top-1 left-1 text-gray-600">
                    <GripVertical className="w-3 h-3" />
                  </div>
                </>
              )}
              <div className="text-lg mb-1">
                {item.itemType === 'achievement' ? '🏆' : item.itemType === 'cosmetic' ? '✨' : '📊'}
              </div>
              <p className="text-xs text-gray-300 truncate">{getItemLabel(item)}</p>
              <p className="text-[10px] text-gray-500 capitalize">{item.itemType}</p>
            </div>
          );
        })}

        {editing && availableSlots.length > 0 && (
          <button
            onClick={() => { setAddSlot(availableSlots[0]); setNewType('achievement'); setNewRefId(''); }}
            className="bg-gray-800/50 border-2 border-dashed border-gray-700 rounded-lg p-3 flex flex-col items-center justify-center hover:border-gray-500 transition-colors"
          >
            <Plus className="w-5 h-5 text-gray-500" />
            <span className="text-xs text-gray-500 mt-1">Add</span>
          </button>
        )}
      </div>

      {addSlot !== null && (
        <div className="bg-gray-800 rounded-lg p-3 space-y-2">
          <select
            value={newType}
            onChange={e => setNewType(e.target.value)}
            className="w-full bg-gray-700 text-white rounded px-2 py-1.5 text-sm"
          >
            {ITEM_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={newRefId}
            onChange={e => setNewRefId(e.target.value)}
            placeholder="Item reference (e.g. legendary:first_message)"
            className="w-full bg-gray-700 text-white rounded px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddItem}
              className="flex-1 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-500"
            >
              Add
            </button>
            <button
              onClick={() => setAddSlot(null)}
              className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
