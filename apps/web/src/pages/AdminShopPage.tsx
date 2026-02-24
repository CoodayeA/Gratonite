import { useEffect, useState, useRef } from 'react';
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

export function AdminShopPage() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<AdminTab>('decorations');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  // Inline edit state
  const [editingField, setEditingField] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  // New item form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState('100');
  const [creating, setCreating] = useState(false);

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
      setItems(data);
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
    <div className="shop-page">
      <header className="shop-hero">
        <div className="shop-eyebrow">Admin</div>
        <h1 className="shop-title">Shop Management</h1>
      </header>

      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onFileSelected} />

      <div className="shop-tabs" role="tablist">
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
            className={`shop-tab ${tab === value ? 'shop-tab-active' : ''}`}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="settings-error shop-error">{error}</div>}

      <section className="shop-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="shop-section-header">{filteredItems.length} items</div>
          <Button variant="primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Cancel' : '+ Add Item'}
          </Button>
        </div>

        {showCreate && (
          <div className="admin-shop-card" style={{ marginBottom: 12 }}>
            <input
              className="admin-inline-input"
              placeholder="Item name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="admin-inline-input"
              placeholder="Description"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <input
              className="admin-inline-input"
              type="number"
              placeholder="Price"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              style={{ width: 80 }}
            />
            <Button loading={creating} onClick={handleCreate} disabled={!newName.trim()}>
              Create
            </Button>
          </div>
        )}

        {loading ? (
          <div className="settings-muted">Loading…</div>
        ) : (
          <div className="admin-shop-grid">
            {filteredItems.map((item) => (
              <div key={item.id} className={`admin-shop-card ${!item.isActive ? 'admin-shop-card-inactive' : ''}`}>
                <div className="admin-shop-card-preview">
                  {item.assetHash ? (
                    <img src={`/api/v1/files/${item.assetHash}`} alt="" />
                  ) : (
                    <div className="admin-shop-no-asset">No asset</div>
                  )}
                </div>

                <div className="admin-shop-card-body">
                  {editingField?.id === item.id && editingField.field === 'name' ? (
                    <input
                      className="admin-inline-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                      autoFocus
                    />
                  ) : (
                    <div
                      className="admin-shop-item-name"
                      onClick={() => startEdit(item.id, 'name', item.name)}
                      title="Click to edit"
                    >
                      {item.name}
                    </div>
                  )}

                  {editingField?.id === item.id && editingField.field === 'price' ? (
                    <input
                      className="admin-inline-input"
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                      autoFocus
                      style={{ width: 80 }}
                    />
                  ) : (
                    <div
                      className="admin-shop-item-price"
                      onClick={() => startEdit(item.id, 'price', String(item.price))}
                      title="Click to edit"
                    >
                      {item.price} G
                    </div>
                  )}
                </div>

                <div className="admin-shop-card-actions">
                  <button
                    type="button"
                    className={`admin-toggle-btn ${item.isFeatured ? 'admin-toggle-active' : ''}`}
                    onClick={() => updateItem(item.id, { isFeatured: !item.isFeatured })}
                    disabled={saving === item.id}
                    title="Toggle featured"
                  >
                    ⭐
                  </button>
                  <button
                    type="button"
                    className="admin-shop-upload-btn"
                    onClick={() => handleUpload(item.id)}
                    disabled={uploading === item.id}
                  >
                    {uploading === item.id ? '…' : 'Upload'}
                  </button>
                  {item.isActive && (
                    <button
                      type="button"
                      className="admin-shop-delete-btn"
                      onClick={() => handleDelete(item.id)}
                      disabled={saving === item.id}
                      title="Deactivate"
                    >
                      ✕
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
