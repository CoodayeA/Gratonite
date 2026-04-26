/**
 * AccountExportModal — Export account data for federation portability.
 */

import { useState } from 'react';
import { Download, X, Check } from 'lucide-react';
import { api } from '../../lib/api';

interface Props {
  onClose: () => void;
}

export default function AccountExportModal({ onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const data = await api.get('/federation/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gratonite-account-export.json';
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch {
      alert('Export failed. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl p-6" style={{ background: 'var(--color-card, #1e1e2e)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-text, #e2e8f0)' }}>Export Account</h2>
          <button aria-label="Close" onClick={onClose} className="p-1 rounded hover:bg-white/10">
            <X size={18} style={{ color: 'var(--color-text-secondary, #94a3b8)' }} />
          </button>
        </div>

        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>
          Download a copy of your profile, settings, and relationships. You can import this on another Gratonite instance.
        </p>

        <p className="text-xs mb-4 p-3 rounded-lg" style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>
          Your export includes your profile, display settings, and friend list. Messages and guild data are not included.
        </p>

        <button
          onClick={handleExport}
          disabled={loading || done}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-white transition-all"
          style={{ background: done ? '#22c55e' : 'var(--color-primary, #6366f1)', opacity: loading ? 0.7 : 1 }}
        >
          {done ? <><Check size={18} /> Downloaded!</> : <><Download size={18} /> {loading ? 'Exporting...' : 'Export Account Data'}</>}
        </button>
      </div>
    </div>
  );
}
