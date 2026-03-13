import { useState, useEffect } from 'react';
import { Download, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';

interface ExportRecord {
  id: string;
  status: string;
  downloadUrl: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function DataExport() {
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const fetchExports = async () => {
    try {
      const data = await api.users.getDataExports();
      setExports(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchExports(); }, []);

  const requestExport = async () => {
    setRequesting(true);
    try {
      await api.users.requestDataExport();
      await fetchExports();
    } catch { /* ignore */ }
    setRequesting(false);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={14} color="#f59e0b" />;
      case 'processing': return <RefreshCw size={14} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />;
      case 'ready': return <CheckCircle size={14} color="#22c55e" />;
      default: return <AlertCircle size={14} color="#ef4444" />;
    }
  };

  return (
    <div style={{ maxWidth: '500px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
        Data Export
      </h3>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
        Request a copy of all your personal data. Exports are available for download for 7 days.
      </p>

      <button
        onClick={requestExport}
        disabled={requesting}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 18px', borderRadius: '8px', border: 'none',
          background: 'var(--accent-primary)', color: 'white',
          cursor: requesting ? 'not-allowed' : 'pointer',
          fontSize: '13px', fontWeight: 600, opacity: requesting ? 0.7 : 1,
          marginBottom: '20px',
        }}
      >
        <Download size={16} />
        {requesting ? 'Requesting...' : 'Request Data Export'}
      </button>

      {loading ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading...</p>
      ) : exports.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No exports yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>Previous Exports</h4>
          {exports.map(exp => (
            <div key={exp.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 14px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              {statusIcon(exp.status)}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {exp.status.charAt(0).toUpperCase() + exp.status.slice(1)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {new Date(exp.createdAt).toLocaleDateString()}
                  {exp.expiresAt && ` — Expires ${new Date(exp.expiresAt).toLocaleDateString()}`}
                </div>
              </div>
              {exp.status === 'ready' && exp.downloadUrl && (
                <a
                  href={exp.downloadUrl}
                  download
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '4px 10px', borderRadius: '6px',
                    background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e',
                    textDecoration: 'none', fontSize: '12px', fontWeight: 600,
                  }}
                >
                  <Download size={12} /> Download
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
