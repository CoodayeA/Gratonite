/**
 * SettingsFederationTab — Federation settings panel in user settings modal.
 */

import { useState, useEffect } from 'react';
import { Globe, Download, Upload, Shield, Link2, Ban, Wifi } from 'lucide-react';
import { api, API_BASE } from '../../../lib/api';
import AccountExportModal from '../../federation/AccountExportModal';
import AccountImportModal from '../../federation/AccountImportModal';
import RelayStatusPanel from '../../federation/RelayStatusPanel';
import FederationBadge from '../../federation/FederationBadge';

interface FederationInfo {
  domain: string;
  enabled: boolean;
  relayEnabled: boolean;
  relayConnected: boolean;
  relayDomain: string | null;
}

export function SettingsFederationTab() {
  const [info, setInfo] = useState<FederationInfo | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [instances, setInstances] = useState<any[]>([]);

  useEffect(() => {
    loadFederationInfo();
    loadInstances();
  }, []);

  const loadFederationInfo = async () => {
    try {
      const wk = await fetch('/.well-known/gratonite').then(r => r.json()).catch(() => null);
      if (wk) {
        setInfo({
          domain: wk.domain,
          enabled: true,
          relayEnabled: wk.relay?.enabled ?? false,
          relayConnected: wk.relay?.connected ?? false,
          relayDomain: wk.relay?.relayDomain ?? null,
        });
      } else {
        setInfo({ domain: window.location.hostname, enabled: false, relayEnabled: false, relayConnected: false, relayDomain: null });
      }
    } catch {
      setInfo({ domain: window.location.hostname, enabled: false, relayEnabled: false, relayConnected: false, relayDomain: null });
    }
  };

  const loadInstances = async () => {
    try {
      const data = await api.get('/federation/admin/instances');
      setInstances((data as any[]).slice(0, 10));
    } catch { /* not admin or federation disabled */ }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--color-text, #e2e8f0)' }}>
          <Globe size={20} /> Federation
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>
          Connect with other Gratonite instances across the network.
        </p>
      </div>

      {/* Federation Status */}
      <div className="p-4 rounded-xl" style={{ background: 'var(--color-background, #0f0f1a)' }}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${info?.enabled ? 'bg-green-400' : 'bg-gray-500'}`} />
          <span className="font-medium" style={{ color: 'var(--color-text, #e2e8f0)' }}>
            Federation {info?.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        {info?.domain && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>Your address:</span>
            <FederationBadge domain={info.domain} trustLevel="verified" size="md" />
          </div>
        )}
      </div>

      {/* Relay Status */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--color-text, #e2e8f0)' }}>
          <Wifi size={16} /> Relay Network
        </h3>
        <RelayStatusPanel />
      </div>

      {/* Connected Instances */}
      {instances.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--color-text, #e2e8f0)' }}>
            <Link2 size={16} /> Connected Instances
          </h3>
          <div className="space-y-1">
            {instances.map((inst: any) => (
              <div key={inst.id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--color-background, #0f0f1a)' }}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${inst.status === 'active' ? 'bg-green-400' : inst.status === 'blocked' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                  <span className="text-sm" style={{ color: 'var(--color-text, #e2e8f0)' }}>
                    {new URL(inst.baseUrl).hostname}
                  </span>
                  <FederationBadge domain={new URL(inst.baseUrl).hostname} trustLevel={inst.trustLevel} size="sm" />
                </div>
                <span className="text-xs" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>
                  {inst.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Account Portability */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--color-text, #e2e8f0)' }}>
          <Shield size={16} /> Account Portability
        </h3>
        <div className="flex gap-3">
          <button
            onClick={() => setShowExport(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all hover:brightness-110"
            style={{ background: 'var(--color-primary-alpha, rgba(99,102,241,0.15))', color: 'var(--color-primary, #6366f1)' }}
          >
            <Download size={16} /> Export Account
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all hover:brightness-110"
            style={{ background: 'var(--color-primary-alpha, rgba(99,102,241,0.15))', color: 'var(--color-primary, #6366f1)' }}
          >
            <Upload size={16} /> Import Account
          </button>
        </div>
      </div>

      {/* Modals */}
      {showExport && <AccountExportModal onClose={() => setShowExport(false)} />}
      {showImport && <AccountImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
}
