import { useState, useRef } from 'react';
import { api } from '@/lib/api';

export type CosmeticType = 'avatar_decoration' | 'effect' | 'nameplate' | 'soundboard';

export interface CosmeticFormData {
  name: string;
  description: string;
  type: CosmeticType;
  previewImageUrl: string;
  assetUrl: string;
  price: number;
}

interface CosmeticFormProps {
  mode: 'create' | 'edit';
  initial?: Partial<CosmeticFormData> & { id?: string };
  onSave: (data: CosmeticFormData & { isPublished: boolean }) => Promise<void>;
  onCancel: () => void;
}

const TYPES: { value: CosmeticType; label: string }[] = [
  { value: 'avatar_decoration', label: 'Avatar Decoration' },
  { value: 'effect', label: 'Effect' },
  { value: 'nameplate', label: 'Nameplate' },
  { value: 'soundboard', label: 'Soundboard' },
];

const s = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#1e1e2e',
    border: '1px solid #3a3650',
    borderRadius: 12,
    padding: 28,
    width: 520,
    maxHeight: '90vh',
    overflowY: 'auto' as const,
    color: '#e8e4e0',
  },
  title: { margin: '0 0 20px', fontSize: 20, fontWeight: 700 },
  field: { marginBottom: 16 },
  label: { display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: '#a8a4b8', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  input: {
    width: '100%',
    padding: '10px 12px',
    background: '#12121f',
    border: '1px solid #3a3650',
    borderRadius: 8,
    color: '#e8e4e0',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    background: '#12121f',
    border: '1px solid #3a3650',
    borderRadius: 8,
    color: '#e8e4e0',
    fontSize: 14,
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: 80,
    boxSizing: 'border-box' as const,
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    background: '#12121f',
    border: '1px solid #3a3650',
    borderRadius: 8,
    color: '#e8e4e0',
    fontSize: 14,
    outline: 'none',
    cursor: 'pointer',
  },
  dropzone: {
    border: '2px dashed #3a3650',
    borderRadius: 8,
    padding: '20px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    fontSize: 13,
    color: '#a8a4b8',
    background: '#12121f',
    transition: 'border-color 0.2s',
  },
  preview: {
    width: '100%',
    maxHeight: 120,
    objectFit: 'contain' as const,
    borderRadius: 6,
    marginTop: 8,
    background: '#12121f',
  },
  row: { display: 'flex', gap: 12 },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 },
  btn: {
    padding: '10px 20px',
    borderRadius: 8,
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnPrimary: { background: '#d4af37', color: '#1a1a2e' },
  btnSecondary: { background: '#3a3650', color: '#e8e4e0' },
  btnDanger: { background: '#e53e3e', color: '#fff' },
  error: { color: '#fc8181', fontSize: 13, marginTop: 8 },
  uploading: { color: '#a8a4b8', fontSize: 13, marginTop: 4 },
};

export function CosmeticForm({ mode, initial, onSave, onCancel }: CosmeticFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type, setType] = useState<CosmeticType>(initial?.type ?? 'avatar_decoration');
  const [previewImageUrl, setPreviewImageUrl] = useState(initial?.previewImageUrl ?? '');
  const [assetUrl, setAssetUrl] = useState(initial?.assetUrl ?? '');
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [uploadingPreview, setUploadingPreview] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const previewRef = useRef<HTMLInputElement>(null);
  const assetRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(file: File, field: 'preview' | 'asset') {
    const setter = field === 'preview' ? setUploadingPreview : setUploadingAsset;
    setter(true);
    try {
      const fd = new FormData();
      fd.append(field === 'preview' ? 'preview_image' : 'asset_image', file);
      const result = await api.cosmetics.upload(fd);
      if (field === 'preview' && result.preview_image_url) setPreviewImageUrl(result.preview_image_url);
      if (field === 'asset' && result.asset_url) setAssetUrl(result.asset_url);
    } catch {
      setError(`Failed to upload ${field} image`);
    } finally {
      setter(false);
    }
  }

  async function handleSubmit(publish: boolean) {
    if (!name.trim()) { setError('Name is required'); return; }
    if (!type) { setError('Type is required'); return; }
    if (publish && !previewImageUrl) { setError('Preview image is required to publish'); return; }
    if (publish && !assetUrl) { setError('Asset file is required to publish'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ name: name.trim(), description, type, previewImageUrl, assetUrl, price, isPublished: publish });
    } catch (e: any) {
      setError(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={s.modal}>
        <h2 style={s.title}>{mode === 'create' ? 'Create Cosmetic' : 'Edit Cosmetic'}</h2>

        <div style={s.field}>
          <label style={s.label}>Name *</label>
          <input style={s.input} value={name} onChange={e => setName(e.target.value)} maxLength={100} placeholder="Cosmetic name" />
        </div>

        <div style={s.field}>
          <label style={s.label}>Type *</label>
          <select style={s.select} value={type} onChange={e => setType(e.target.value as CosmeticType)}>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div style={s.field}>
          <label style={s.label}>Description</label>
          <textarea style={s.textarea} value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} placeholder="Describe your cosmetic..." />
        </div>

        <div style={s.row}>
          <div style={{ ...s.field, flex: 1 }}>
            <label style={s.label}>Preview Image</label>
            <div
              style={s.dropzone}
              onClick={() => previewRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f, 'preview'); }}
            >
              {uploadingPreview ? 'Uploading...' : previewImageUrl ? '✓ Uploaded — click to replace' : 'Drop or click to upload preview'}
            </div>
            {previewImageUrl && <img src={previewImageUrl} alt="preview" style={s.preview} />}
            <input ref={previewRef} type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'preview'); }} />
          </div>

          <div style={{ ...s.field, flex: 1 }}>
            <label style={s.label}>Asset File</label>
            <div
              style={s.dropzone}
              onClick={() => assetRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f, 'asset'); }}
            >
              {uploadingAsset ? 'Uploading...' : assetUrl ? '✓ Uploaded — click to replace' : 'Drop or click to upload asset'}
            </div>
            <input ref={assetRef} type="file" accept="image/png,audio/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'asset'); }} />
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>Price (Gratonites)</label>
          <input style={s.input} type="number" min={0} value={price} onChange={e => setPrice(Number(e.target.value))} placeholder="0 = free" />
        </div>

        {error && <div style={s.error}>{error}</div>}

        <div style={s.actions}>
          <button style={{ ...s.btn, ...s.btnSecondary }} onClick={onCancel} disabled={saving}>Cancel</button>
          <button style={{ ...s.btn, ...s.btnSecondary }} onClick={() => handleSubmit(false)} disabled={saving || uploadingPreview || uploadingAsset}>
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => handleSubmit(true)} disabled={saving || uploadingPreview || uploadingAsset}>
            {saving ? 'Publishing...' : 'Save & Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}
