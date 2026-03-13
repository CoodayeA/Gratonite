import { useState, useEffect, useCallback } from 'react';
import { GripVertical, X, Plus, Save, Award, Sparkles, BarChart3 } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from './ui/ToastManager';

type ShowcaseItemType = 'cosmetic' | 'achievement' | 'stat';

type ShowcaseSlot = {
    slot: number;
    itemType: ShowcaseItemType;
    referenceId: string;
    label: string;
    icon?: string;
};

type InventoryItem = {
    id: string;
    name: string;
    type: string;
    rarity: string;
    equipped: boolean;
};

type Achievement = {
    id: string;
    key: string;
    name: string;
    icon: string;
    earnedAt?: string;
};

const MAX_SLOTS = 6;

const STAT_OPTIONS = [
    { id: 'messages_sent', label: 'Messages Sent', icon: '💬' },
    { id: 'fame_received', label: 'FAME Received', icon: '⭐' },
    { id: 'account_age', label: 'Account Age', icon: '📅' },
    { id: 'servers_joined', label: 'Servers Joined', icon: '🏠' },
];

interface ProfileShowcaseEditorProps {
    onClose: () => void;
    userId?: string;
}

const ProfileShowcaseEditor = ({ onClose, userId }: ProfileShowcaseEditorProps) => {
    const { addToast } = useToast();
    const [slots, setSlots] = useState<ShowcaseSlot[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [addPanel, setAddPanel] = useState<ShowcaseItemType | null>(null);
    const [dragIdx, setDragIdx] = useState<number | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [showcaseData, invData, achData] = await Promise.all([
                    api.showcase.get(userId ?? '@me').catch(() => []),
                    api.get<any>('/inventory').catch(() => ({ items: [] })),
                    api.get<any[]>('/achievements').catch(() => []),
                ]);

                if (Array.isArray(showcaseData)) {
                    setSlots(showcaseData.map((s: any) => ({
                        slot: s.slot ?? s.displayOrder,
                        itemType: s.itemType as ShowcaseItemType,
                        referenceId: s.referenceId,
                        label: s.label ?? s.referenceId,
                        icon: s.icon,
                    })));
                }

                const items = Array.isArray(invData) ? invData : (invData?.items ?? []);
                setInventory(items.map((i: any) => ({
                    id: i.id ?? i.itemId,
                    name: i.name ?? 'Item',
                    type: i.type ?? 'unknown',
                    rarity: i.rarity ?? 'common',
                    equipped: i.equipped ?? false,
                })));

                if (Array.isArray(achData)) {
                    setAchievements(achData.filter((a: any) => a.earnedAt).map((a: any) => ({
                        id: a.id, key: a.key ?? a.id, name: a.name ?? a.key, icon: a.icon ?? '🏆', earnedAt: a.earnedAt,
                    })));
                }
            } catch { /* empty */ }
            setLoading(false);
        };
        load();
    }, [userId]);

    const addItem = (type: ShowcaseItemType, refId: string, label: string, icon?: string) => {
        if (slots.length >= MAX_SLOTS) {
            addToast({ title: 'Max slots reached', description: `You can only showcase ${MAX_SLOTS} items.`, variant: 'error' });
            return;
        }
        setSlots(prev => [...prev, { slot: prev.length, itemType: type, referenceId: refId, label, icon }]);
        setAddPanel(null);
    };

    const removeSlot = (index: number) => {
        setSlots(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, slot: i })));
    };

    const handleDragStart = (idx: number) => setDragIdx(idx);
    const handleDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        if (dragIdx === null || dragIdx === idx) return;
        setSlots(prev => {
            const next = [...prev];
            const [item] = next.splice(dragIdx, 1);
            next.splice(idx, 0, item);
            return next.map((s, i) => ({ ...s, slot: i }));
        });
        setDragIdx(idx);
    };
    const handleDragEnd = () => setDragIdx(null);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.showcase.set(slots.map(s => ({
                slot: s.slot,
                itemType: s.itemType,
                referenceId: s.referenceId,
            })));
            addToast({ title: 'Showcase saved', variant: 'success' });
            onClose();
        } catch (err: any) {
            addToast({ title: 'Failed to save', description: err?.message ?? 'Try again', variant: 'error' });
        }
        setSaving(false);
    };

    const rarityColor: Record<string, string> = { common: '#71717a', uncommon: '#22c55e', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b' };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--stroke)', width: '600px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--stroke)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Profile Showcase</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>Loading...</div>
                    ) : (
                        <>
                            {/* Showcase slots */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                                {slots.map((slot, i) => (
                                    <div
                                        key={`${slot.referenceId}-${i}`}
                                        draggable
                                        onDragStart={() => handleDragStart(i)}
                                        onDragOver={e => handleDragOver(e, i)}
                                        onDragEnd={handleDragEnd}
                                        style={{
                                            padding: '12px', borderRadius: '10px',
                                            background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            cursor: 'grab', opacity: dragIdx === i ? 0.5 : 1,
                                        }}
                                    >
                                        <GripVertical size={14} color="var(--text-muted)" />
                                        <span style={{ fontSize: '16px' }}>{slot.icon ?? (slot.itemType === 'cosmetic' ? '🎨' : slot.itemType === 'achievement' ? '🏆' : '📊')}</span>
                                        <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.label}</span>
                                        <button onClick={() => removeSlot(i)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}><X size={14} /></button>
                                    </div>
                                ))}
                                {slots.length < MAX_SLOTS && (
                                    <button
                                        onClick={() => setAddPanel(addPanel ? null : 'cosmetic')}
                                        style={{
                                            padding: '12px', borderRadius: '10px',
                                            background: 'var(--bg-primary)', border: '2px dashed var(--stroke)',
                                            color: 'var(--text-muted)', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                            fontSize: '12px', fontWeight: 600,
                                        }}
                                    >
                                        <Plus size={14} /> Add Item
                                    </button>
                                )}
                            </div>

                            {/* Add panel */}
                            {addPanel && (
                                <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--stroke)', padding: '16px' }}>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                        {([
                                            { key: 'cosmetic' as const, label: 'Cosmetics', icon: <Sparkles size={12} /> },
                                            { key: 'achievement' as const, label: 'Achievements', icon: <Award size={12} /> },
                                            { key: 'stat' as const, label: 'Stats', icon: <BarChart3 size={12} /> },
                                        ]).map(tab => (
                                            <button
                                                key={tab.key}
                                                onClick={() => setAddPanel(tab.key)}
                                                style={{
                                                    padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                                                    background: addPanel === tab.key ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                                    border: 'none', color: addPanel === tab.key ? '#000' : 'var(--text-secondary)',
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                                                }}
                                            >
                                                {tab.icon} {tab.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {addPanel === 'cosmetic' && inventory.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => addItem('cosmetic', item.id, item.name, '🎨')}
                                                disabled={slots.some(s => s.referenceId === item.id)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    padding: '8px 12px', borderRadius: '6px',
                                                    background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                                    color: slots.some(s => s.referenceId === item.id) ? 'var(--text-muted)' : 'var(--text-primary)',
                                                    cursor: slots.some(s => s.referenceId === item.id) ? 'not-allowed' : 'pointer',
                                                    width: '100%', textAlign: 'left',
                                                }}
                                            >
                                                <span style={{ fontSize: '13px', fontWeight: 600 }}>{item.name}</span>
                                                <span style={{ fontSize: '11px', color: rarityColor[item.rarity], marginLeft: 'auto', textTransform: 'capitalize' }}>{item.rarity}</span>
                                            </button>
                                        ))}
                                        {addPanel === 'achievement' && achievements.map(ach => (
                                            <button
                                                key={ach.id}
                                                onClick={() => addItem('achievement', ach.id, ach.name, ach.icon)}
                                                disabled={slots.some(s => s.referenceId === ach.id)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    padding: '8px 12px', borderRadius: '6px',
                                                    background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                                    color: slots.some(s => s.referenceId === ach.id) ? 'var(--text-muted)' : 'var(--text-primary)',
                                                    cursor: slots.some(s => s.referenceId === ach.id) ? 'not-allowed' : 'pointer',
                                                    width: '100%', textAlign: 'left',
                                                }}
                                            >
                                                <span>{ach.icon}</span>
                                                <span style={{ fontSize: '13px', fontWeight: 600 }}>{ach.name}</span>
                                            </button>
                                        ))}
                                        {addPanel === 'stat' && STAT_OPTIONS.map(stat => (
                                            <button
                                                key={stat.id}
                                                onClick={() => addItem('stat', stat.id, stat.label, stat.icon)}
                                                disabled={slots.some(s => s.referenceId === stat.id)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    padding: '8px 12px', borderRadius: '6px',
                                                    background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                                    color: slots.some(s => s.referenceId === stat.id) ? 'var(--text-muted)' : 'var(--text-primary)',
                                                    cursor: slots.some(s => s.referenceId === stat.id) ? 'not-allowed' : 'pointer',
                                                    width: '100%', textAlign: 'left',
                                                }}
                                            >
                                                <span>{stat.icon}</span>
                                                <span style={{ fontSize: '13px', fontWeight: 600 }}>{stat.label}</span>
                                            </button>
                                        ))}
                                        {addPanel === 'cosmetic' && inventory.length === 0 && (
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px', textAlign: 'center' }}>No cosmetics in inventory</p>
                                        )}
                                        {addPanel === 'achievement' && achievements.length === 0 && (
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px', textAlign: 'center' }}>No achievements earned yet</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--stroke)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Save size={14} /> {saving ? 'Saving...' : 'Save Showcase'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProfileShowcaseEditor;
