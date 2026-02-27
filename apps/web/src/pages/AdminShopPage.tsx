import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/lib/utils';

type AdminTab = 'decorations' | 'effects' | 'nameplates' | 'soundboard';

interface ShopItem {
  id: string;
  name: string;
  description: string | null;
  type: string;
  category: string;
  price: number;
  assetHash: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
}

const TAB_TO_TYPE: Record<AdminTab, string> = {
  decorations: 'avatar_decoration',
  effects: 'profile_effect',
  nameplates: 'nameplate',
  soundboard: 'soundboard_sound',
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  shopPage: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: 20,
    display: 'grid',
    alignContent: 'start',
    gap: 14,
  } as React.CSSProperties,

  hero: {
    display: 'grid',
    gap: 8,
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    borderRadius: 'var(--radius-xl)',
    padding: 16,
    background: `radial-gradient(circle at 88% 8%, rgba(138, 123, 255, 0.08), transparent 38%),
      radial-gradient(circle at 15% 10%, rgba(121, 223, 255, 0.07), transparent 32%),
      rgba(10, 16, 28, 0.58)`,
  } as React.CSSProperties,

  eyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-faint)',
  } as React.CSSProperties,

  shopTitle: {
    margin: 0,
    fontSize: 22,
    lineHeight: 1.15,
  } as React.CSSProperties,

  tabs: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
  } as React.CSSProperties,

  tab: {
    padding: '8px 18px',
    borderRadius: 'var(--radius-md)',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted, #8e9ab8)',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  } as React.CSSProperties,

  tabActive: {
    background: 'var(--surface-raised, rgba(255, 255, 255, 0.08))',
    color: 'var(--text, #e4e9f5)',
    fontWeight: 600,
  } as React.CSSProperties,

  settingsError: {
    color: 'var(--danger)',
    fontSize: 13,
    margin: '0 0 4px',
  } as React.CSSProperties,

  section: {
    display: 'grid',
    gap: 10,
  } as React.CSSProperties,

  sectionHeader: {
    fontSize: '0.85rem',
    fontWeight: 700,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  } as React.CSSProperties,

  settingsMuted: {
    color: 'var(--text-muted)',
    fontSize: 14,
  } as React.CSSProperties,

  adminGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 12,
  } as React.CSSProperties,

  adminCard: {
    background: 'var(--bg-elevated)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--stroke)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'border-color 0.15s',
  } as React.CSSProperties,

  adminCardInactive: {
    opacity: 0.45,
  } as React.CSSProperties,

  adminCardPreview: {
    width: '100%',
    aspectRatio: '1',
    background: 'var(--bg-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  } as React.CSSProperties,

  adminCardPreviewImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  } as React.CSSProperties,

  noAsset: {
    fontSize: 12,
    color: 'var(--text-muted)',
  } as React.CSSProperties,

  cardBody: {
    padding: '10px 12px 4px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  } as React.CSSProperties,

  itemName: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    padding: '2px 4px',
    margin: '-2px -4px',
  } as React.CSSProperties,

  itemPrice: {
    fontSize: 13,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    padding: '2px 4px',
    margin: '-2px -4px',
  } as React.CSSProperties,

  cardActions: {
    padding: '8px 12px 10px',
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  } as React.CSSProperties,

  inlineInput: {
    background: 'var(--bg-soft)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    fontSize: 13,
    padding: '4px 8px',
    outline: 'none',
    width: '100%',
  } as React.CSSProperties,

  toggleBtn: {
    background: 'var(--bg-soft)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--stroke)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: 14,
    opacity: 0.4,
    transition: 'opacity 0.15s',
  } as React.CSSProperties,

  toggleActive: {
    opacity: 1,
    borderColor: 'var(--accent)',
    background: 'rgba(124, 58, 237, 0.12)',
  } as React.CSSProperties,

  uploadBtn: {
    background: 'var(--bg-soft)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    fontSize: 12,
    padding: '4px 10px',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  } as React.CSSProperties,

  deleteBtn: {
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    fontSize: 14,
    padding: '4px 8px',
    cursor: 'pointer',
    marginLeft: 'auto',
    transition: 'color 0.15s, background 0.15s',
  } as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminShopPage() {
  const user = useAuthStore((st) => st.user);
  const [tab, setTab] = useState<AdminTab>('decorations');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const [editingField, setEditingField] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState('100');
  const [creating, setCreating] = useState(false);

  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [hoveredPrice, setHoveredPrice] = useState<string | null>(null);
  const [hoveredToggle, setHoveredToggle] = useState<string | null>(null);
  const [hoveredUpload, setHoveredUpload] = useState<string | null>(null);
  const [hoveredDelete, setHoveredDelete] = useState<string | null>(null);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadItemIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/shop/items', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load items');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = items.filter((i) => i.type === TAB_TO_TYPE[tab]);

  async function updateItem(id: string, updates: Record<string, unknown>) {
    setSaving(id);
    setError('');
    try {
      const res = await fetch(`/api/v1/admin/shop/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || err.code || 'Update failed');
      }
      const updated = await res.json();
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  async function handleUpload(id: string) {
    uploadItemIdRef.current = id;
    fileInputRef.current?.click();
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = uploadItemIdRef.current;
    if (!file || !id) return;
    e.target.value = '';

    setUploading(id);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/v1/admin/shop/items/${id}/asset`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const { assetHash } = await res.json();
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, assetHash } : item)));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(null);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/v1/admin/shop/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim() || null,
          type: TAB_TO_TYPE[tab],
          category: tab === 'soundboard' ? 'soundboard' : `${tab}`,
          price: parseInt(newPrice) || 100,
        }),
      });
      if (!res.ok) throw new Error('Create failed');
      const created = await res.json();
      setItems((prev) => [...prev, created]);
      setNewName('');
      setNewDesc('');
      setNewPrice('100');
      setShowCreate(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(id);
    try {
      await fetch(`/api/v1/admin/shop/items/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isActive: false } : item)));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  function startEdit(id: string, field: string, value: string) {
    setEditingField({ id, field });
    setEditValue(value);
  }

  function commitEdit() {
    if (!editingField) return;
    const { id, field } = editingField;
    const value = field === 'price' ? parseInt(editValue) || 0 : editValue;
    updateItem(id, { [field]: value });
    setEditingField(null);
  }

  if (!user) return null;

  return (
    <div style={s.shopPage}>
      <header style={s.hero}>
        <div style={s.eyebrow}>Admin</div>
        <h1 style={s.shopTitle}>Shop Management</h1>
      </header>

      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onFileSelected} />

      <div style={s.tabs} role="tablist">
        {([
          ['decorations', 'Decorations'],
          ['effects', 'Effects'],
          ['nameplates', 'Nameplates'],
          ['soundboard', 'Soundboard'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            style={{
              ...s.tab,
              ...(tab === value ? s.tabActive : {}),
              ...(hoveredTab === value && tab !== value
                ? { background: 'var(--surface-raised, rgba(255, 255, 255, 0.06))', color: 'var(--text, #e4e9f5)' }
                : {}),
            }}
            onClick={() => setTab(value)}
            onMouseEnter={() => setHoveredTab(value)}
            onMouseLeave={() => setHoveredTab(null)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div style={s.settingsError}>{error}</div>}

      <section style={s.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={s.sectionHeader}>{filteredItems.length} items</div>
          <Button variant="primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Cancel' : '+ Add Item'}
          </Button>
        </div>

        {showCreate && (
          <div style={{ ...s.adminCard, marginBottom: 12, padding: 10, gap: 8 }}>
            <input
              style={s.inlineInput}
              placeholder="Item name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              style={s.inlineInput}
              placeholder="Description"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <input
              style={{ ...s.inlineInput, width: 80 }}
              type="number"
              placeholder="Price"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
            />
            <Button loading={creating} onClick={handleCreate} disabled={!newName.trim()}>
              Create
            </Button>
          </div>
        )}

        {loading ? (
          <div style={s.settingsMuted}>Loading...</div>
        ) : (
          <div style={s.adminGrid}>
            {filteredItems.map((item) => (
              <div
                key={item.id}
                style={{
                  ...s.adminCard,
                  ...(!item.isActive ? s.adminCardInactive : {}),
                  ...(hoveredCard === item.id ? { borderColor: 'var(--accent)' } : {}),
                }}
                onMouseEnter={() => setHoveredCard(item.id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div style={s.adminCardPreview}>
                  {item.assetHash ? (
                    <img src={`/api/v1/files/${item.assetHash}`} alt="" style={s.adminCardPreviewImg} />
                  ) : (
                    <div style={s.noAsset}>No asset</div>
                  )}
                </div>

                <div style={s.cardBody}>
                  {editingField?.id === item.id && editingField.field === 'name' ? (
                    <input
                      style={s.inlineInput}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                      autoFocus
                    />
                  ) : (
                    <div
                      style={{
                        ...s.itemName,
                        ...(hoveredName === item.id ? { background: 'var(--bg-soft)' } : {}),
                      }}
                      onClick={() => startEdit(item.id, 'name', item.name)}
                      onMouseEnter={() => setHoveredName(item.id)}
                      onMouseLeave={() => setHoveredName(null)}
                      title="Click to edit"
                    >
                      {item.name}
                    </div>
                  )}

                  {editingField?.id === item.id && editingField.field === 'price' ? (
                    <input
                      style={{ ...s.inlineInput, width: 80 }}
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                      autoFocus
                    />
                  ) : (
                    <div
                      style={{
                        ...s.itemPrice,
                        ...(hoveredPrice === item.id ? { background: 'var(--bg-soft)' } : {}),
                      }}
                      onClick={() => startEdit(item.id, 'price', String(item.price))}
                      onMouseEnter={() => setHoveredPrice(item.id)}
                      onMouseLeave={() => setHoveredPrice(null)}
                      title="Click to edit"
                    >
                      {item.price} G
                    </div>
                  )}
                </div>

                <div style={s.cardActions}>
                  <button
                    type="button"
                    style={{
                      ...s.toggleBtn,
                      ...(item.isFeatured ? s.toggleActive : {}),
                      ...(hoveredToggle === item.id ? { opacity: 0.7 } : {}),
                    }}
                    onClick={() => updateItem(item.id, { isFeatured: !item.isFeatured })}
                    onMouseEnter={() => setHoveredToggle(item.id)}
                    onMouseLeave={() => setHoveredToggle(null)}
                    disabled={saving === item.id}
                    title="Toggle featured"
                  >
                    {'\u2B50'}
                  </button>
                  <button
                    type="button"
                    style={{
                      ...s.uploadBtn,
                      ...(hoveredUpload === item.id ? { background: 'var(--accent)', color: '#fff' } : {}),
                    }}
                    onClick={() => handleUpload(item.id)}
                    onMouseEnter={() => setHoveredUpload(item.id)}
                    onMouseLeave={() => setHoveredUpload(null)}
                    disabled={uploading === item.id}
                  >
                    {uploading === item.id ? '\u2026' : 'Upload'}
                  </button>
                  {item.isActive && (
                    <button
                      type="button"
                      style={{
                        ...s.deleteBtn,
                        ...(hoveredDelete === item.id
                          ? { color: 'var(--danger, #f23f43)', background: 'rgba(242, 63, 67, 0.1)' }
                          : {}),
                      }}
                      onClick={() => handleDelete(item.id)}
                      onMouseEnter={() => setHoveredDelete(item.id)}
                      onMouseLeave={() => setHoveredDelete(null)}
                      disabled={saving === item.id}
                      title="Deactivate"
                    >
                      {'\u2715'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
