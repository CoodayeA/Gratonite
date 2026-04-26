/**
 * AccountImportModal — Import account data from another Gratonite instance.
 */

import { useState, useRef } from 'react';
import { Upload, X, Check, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';

interface Props {
  onClose: () => void;
}

export default function AccountImportModal({ onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError('');

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        setPreview(data);
      } catch {
        setError('Invalid file format');
      }
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!preview) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/federation/import', {
        data: preview.data || preview,
        signature: preview.signature || '',
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'Import failed');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl p-6" style={{ background: 'var(--color-card, #1e1e2e)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-text, #e2e8f0)' }}>Import Account</h2>
          <button aria-label="Close" onClick={onClose} className="p-1 rounded hover:bg-white/10">
            <X size={18} style={{ color: 'var(--color-text-secondary, #94a3b8)' }} />
          </button>
        </div>

        <input ref={inputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />

        {!file ? (
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-2 transition-all hover:border-white/30"
            style={{ borderColor: 'var(--color-border, #2e2e3e)', color: 'var(--color-text-secondary, #94a3b8)' }}
          >
            <Upload size={32} />
            <span className="text-sm font-medium">Choose export file</span>
            <span className="text-xs">JSON file from another instance</span>
          </button>
        ) : preview ? (
          <div className="space-y-3">
            <div className="p-3 rounded-lg" style={{ background: 'var(--color-background, #0f0f1a)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text, #e2e8f0)' }}>
                {preview.data?.profile?.username || preview.profile?.username || 'Unknown user'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>
                From: {preview.data?.sourceInstance || preview.sourceInstance || 'Unknown'}
              </p>
              {(preview.data?.relationships || preview.relationships) && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>
                  {(preview.data?.relationships || preview.relationships)?.length || 0} relationships
                </p>
              )}
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg text-xs" style={{ background: 'rgba(234,179,8,0.1)', color: '#facc15' }}>
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              This will update your profile with the imported data. Existing data won't be deleted.
            </div>

            <button
              onClick={handleImport}
              disabled={loading || done}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-white"
              style={{ background: done ? '#22c55e' : 'var(--color-primary, #6366f1)', opacity: loading ? 0.7 : 1 }}
            >
              {done ? <><Check size={18} /> Imported!</> : loading ? 'Importing...' : <><Upload size={18} /> Import</>}
            </button>
          </div>
        ) : null}

        {error && (
          <p className="text-sm mt-3 text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
