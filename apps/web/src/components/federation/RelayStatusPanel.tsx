/**
 * RelayStatusPanel — Shows relay connection status, latency, and reputation.
 */

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Shield, Clock, Activity } from 'lucide-react';
import { api } from '../../lib/api';

interface RelayStatus {
  enabled: boolean;
  connected: boolean;
  relayDomain: string | null;
}

interface RelayNode {
  domain: string;
  reputationScore: number;
  latencyMs: number;
  uptimePercent: number;
  connectedInstances: number;
  turnSupported: boolean;
}

export default function RelayStatusPanel() {
  const [status, setStatus] = useState<RelayStatus | null>(null);
  const [relays, setRelays] = useState<RelayNode[]>([]);

  useEffect(() => {
    loadStatus();
    loadRelays();
  }, []);

  const loadStatus = async () => {
    try {
      const wk = await fetch('/.well-known/gratonite').then(r => r.json());
      setStatus(wk.relay || { enabled: false, connected: false, relayDomain: null });
    } catch { /* ignore */ }
  };

  const loadRelays = async () => {
    try {
      const data = await api.get('/relays');
      setRelays(data as RelayNode[]);
    } catch { /* ignore */ }
  };

  if (!status) return null;

  return (
    <div className="space-y-3">
      {/* Connection status */}
      <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--color-background, #0f0f1a)' }}>
        {status.connected ? (
          <Wifi size={20} className="text-green-400" />
        ) : (
          <WifiOff size={20} style={{ color: 'var(--color-text-secondary, #94a3b8)' }} />
        )}
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text, #e2e8f0)' }}>
            {status.connected ? 'Connected to relay' : status.enabled ? 'Relay disconnected' : 'Relay disabled'}
          </p>
          {status.relayDomain && (
            <p className="text-xs" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>
              {status.relayDomain}
            </p>
          )}
        </div>
      </div>

      {/* Relay list */}
      {relays.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>
            Available Relays
          </p>
          {relays.slice(0, 5).map(relay => (
            <div key={relay.domain} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--color-background, #0f0f1a)' }}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${relay.reputationScore >= 70 ? 'bg-green-400' : relay.reputationScore >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`} />
                <span className="text-sm" style={{ color: 'var(--color-text, #e2e8f0)' }}>{relay.domain}</span>
              </div>
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>
                <span className="flex items-center gap-1"><Shield size={12} />{relay.reputationScore}</span>
                <span className="flex items-center gap-1"><Clock size={12} />{relay.latencyMs}ms</span>
                <span className="flex items-center gap-1"><Activity size={12} />{relay.connectedInstances}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
