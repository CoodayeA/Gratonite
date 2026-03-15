/**
 * FederationAdmin.tsx — Admin federation dashboard.
 *
 * Panels: Instances, Activity Queue, Relays, Remote Guilds, Blocking, Health.
 */

import { useState, useEffect } from 'react';
import { Globe, Server, Activity, Shield, Ban, Wifi, RefreshCw, Trash2, Check, X, Clock, Users, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import FederationBadge from '../../components/federation/FederationBadge';

type Tab = 'instances' | 'queue' | 'relays' | 'discover' | 'blocks' | 'health';

export default function FederationAdmin() {
  const [tab, setTab] = useState<Tab>('instances');
  const [stats, setStats] = useState<any>(null);
  const [instances, setInstances] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [relays, setRelays] = useState<any[]>([]);
  const [remoteGuilds, setRemoteGuilds] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
    loadTab(tab);
  }, [tab]);

  const loadStats = async () => {
    try {
      setStats(await api.get('/federation/admin/stats'));
    } catch { /* not admin */ }
  };

  const loadTab = async (t: Tab) => {
    setLoading(true);
    try {
      switch (t) {
        case 'instances': setInstances(await api.get('/federation/admin/instances') as any[]); break;
        case 'queue': setQueue(await api.get('/federation/admin/queue') as any[]); break;
        case 'relays': setRelays(await api.get('/relays') as any[]); break;
        case 'discover': setRemoteGuilds(await api.get('/federation/admin/discover') as any[]); break;
        case 'blocks': setBlocks(await api.get('/federation/admin/blocks') as any[]); break;
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const tabs: { key: Tab; label: string; icon: typeof Globe }[] = [
    { key: 'instances', label: 'Instances', icon: Server },
    { key: 'queue', label: 'Activity Queue', icon: Activity },
    { key: 'relays', label: 'Relays', icon: Wifi },
    { key: 'discover', label: 'Remote Guilds', icon: Globe },
    { key: 'blocks', label: 'Blocks', icon: Ban },
    { key: 'health', label: 'Health', icon: Shield },
  ];

  const handleUpdateInstance = async (id: string, updates: any) => {
    await api.patch(`/federation/admin/instances/${id}`, updates);
    loadTab('instances');
  };

  const handleDeleteBlock = async (id: string) => {
    await api.delete(`/federation/admin/blocks/${id}`);
    loadTab('blocks');
  };

  const handleApproveGuild = async (id: string, approved: boolean) => {
    await api.patch(`/federation/admin/discover/${id}`, { isApproved: approved });
    loadTab('discover');
  };

  return (
    <div className="h-full flex flex-col" style={{ color: 'var(--color-text, #e2e8f0)' }}>
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--color-border, #2e2e3e)' }}>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Globe size={24} /> Federation Dashboard
        </h1>
        {stats && (
          <div className="flex gap-4 mt-2 text-sm" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>
            <span>{stats.instances?.total ?? 0} instances ({stats.instances?.active ?? 0} active)</span>
            <span>{stats.activities?.pending ?? 0} pending activities</span>
            <span>{stats.remoteUsers ?? 0} remote users</span>
            <span>{stats.remoteGuilds ?? 0} remote guilds</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto" style={{ borderColor: 'var(--color-border, #2e2e3e)' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all ${tab === t.key ? 'border-b-2' : ''}`}
            style={{ color: tab === t.key ? 'var(--color-primary, #6366f1)' : 'var(--color-text-secondary, #94a3b8)', borderColor: 'var(--color-primary, #6366f1)' }}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && <div className="text-center py-8" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>Loading...</div>}

        {/* Instances */}
        {tab === 'instances' && !loading && (
          <div className="space-y-2">
            {instances.map((inst: any) => (
              <div key={inst.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--color-card, #1e1e2e)' }}>
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${inst.status === 'active' ? 'bg-green-400' : inst.status === 'blocked' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                  <div>
                    <p className="font-medium">{new URL(inst.baseUrl).hostname}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <FederationBadge domain={new URL(inst.baseUrl).hostname} trustLevel={inst.trustLevel} size="sm" />
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>
                        v{inst.softwareVersion || '?'} · Last seen {inst.lastSeenAt ? new Date(inst.lastSeenAt).toLocaleDateString() : 'never'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {inst.status !== 'blocked' && (
                    <button onClick={() => handleUpdateInstance(inst.id, { status: 'blocked' })} className="p-2 rounded-lg hover:bg-red-500/20" title="Block">
                      <Ban size={14} className="text-red-400" />
                    </button>
                  )}
                  {inst.status === 'blocked' && (
                    <button onClick={() => handleUpdateInstance(inst.id, { status: 'active' })} className="p-2 rounded-lg hover:bg-green-500/20" title="Unblock">
                      <Check size={14} className="text-green-400" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {instances.length === 0 && <p className="text-center py-8" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>No connected instances</p>}
          </div>
        )}

        {/* Activity Queue */}
        {tab === 'queue' && !loading && (
          <div className="space-y-2">
            {queue.map((act: any) => (
              <div key={act.id} className="p-3 rounded-lg" style={{ background: 'var(--color-card, #1e1e2e)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${act.status === 'delivered' ? 'bg-green-500/20 text-green-400' : act.status === 'dead' ? 'bg-red-500/20 text-red-400' : act.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {act.status}
                    </span>
                    <span className="text-sm font-medium">{act.activityType}</span>
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>
                      {act.direction}
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>
                    {new Date(act.createdAt).toLocaleString()}
                  </span>
                </div>
                {act.error && <p className="text-xs mt-1 text-red-400">{act.error}</p>}
              </div>
            ))}
            {queue.length === 0 && <p className="text-center py-8" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>Queue is empty</p>}
          </div>
        )}

        {/* Relays */}
        {tab === 'relays' && !loading && (
          <div className="space-y-2">
            {relays.map((relay: any) => (
              <div key={relay.domain} className="p-4 rounded-lg" style={{ background: 'var(--color-card, #1e1e2e)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{relay.domain}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>
                      {relay.connectedInstances} instances · {relay.meshPeers} mesh peers · v{relay.softwareVersion || '?'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <Shield size={14} />
                      <span className={`font-bold ${relay.reputationScore >= 70 ? 'text-green-400' : relay.reputationScore >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {relay.reputationScore}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>
                      {relay.latencyMs}ms · {relay.uptimePercent}% uptime
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {relays.length === 0 && <p className="text-center py-8" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>No relays registered</p>}
          </div>
        )}

        {/* Remote Guilds */}
        {tab === 'discover' && !loading && (
          <div className="space-y-2">
            {remoteGuilds.map((g: any) => (
              <div key={g.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--color-card, #1e1e2e)' }}>
                <div>
                  <p className="font-medium">{g.name}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>
                    {g.memberCount} members · {new URL(g.instanceBaseUrl).hostname}
                    {g.isApproved ? ' · Approved' : ' · Pending'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!g.isApproved && (
                    <button onClick={() => handleApproveGuild(g.id, true)} className="p-2 rounded-lg hover:bg-green-500/20" title="Approve">
                      <Check size={14} className="text-green-400" />
                    </button>
                  )}
                  {g.isApproved && (
                    <button onClick={() => handleApproveGuild(g.id, false)} className="p-2 rounded-lg hover:bg-yellow-500/20" title="Unapprove">
                      <X size={14} className="text-yellow-400" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {remoteGuilds.length === 0 && <p className="text-center py-8" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>No remote guilds</p>}
          </div>
        )}

        {/* Blocks */}
        {tab === 'blocks' && !loading && (
          <div className="space-y-2">
            {blocks.map((block: any) => (
              <div key={block.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--color-card, #1e1e2e)' }}>
                <div>
                  <p className="font-medium">{block.blockedDomain}</p>
                  {block.reason && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>{block.reason}</p>}
                  {block.expiresAt && <p className="text-xs" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>Expires: {new Date(block.expiresAt).toLocaleDateString()}</p>}
                </div>
                <button onClick={() => handleDeleteBlock(block.id)} className="p-2 rounded-lg hover:bg-red-500/20" title="Remove block">
                  <Trash2 size={14} className="text-red-400" />
                </button>
              </div>
            ))}
            {blocks.length === 0 && <p className="text-center py-8" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>No active blocks</p>}
          </div>
        )}

        {/* Health */}
        {tab === 'health' && !loading && stats && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg" style={{ background: 'var(--color-card, #1e1e2e)' }}>
              <div className="flex items-center gap-2 mb-2"><Server size={18} /> <span className="font-medium">Instances</span></div>
              <p className="text-3xl font-bold">{stats.instances?.total ?? 0}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>{stats.instances?.active ?? 0} active</p>
            </div>
            <div className="p-4 rounded-lg" style={{ background: 'var(--color-card, #1e1e2e)' }}>
              <div className="flex items-center gap-2 mb-2"><Activity size={18} /> <span className="font-medium">Pending</span></div>
              <p className="text-3xl font-bold">{stats.activities?.pending ?? 0}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>activities in queue</p>
            </div>
            <div className="p-4 rounded-lg" style={{ background: 'var(--color-card, #1e1e2e)' }}>
              <div className="flex items-center gap-2 mb-2"><Users size={18} /> <span className="font-medium">Remote Users</span></div>
              <p className="text-3xl font-bold">{stats.remoteUsers ?? 0}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>shadow users</p>
            </div>
            <div className="p-4 rounded-lg" style={{ background: 'var(--color-card, #1e1e2e)' }}>
              <div className="flex items-center gap-2 mb-2"><Globe size={18} /> <span className="font-medium">Remote Guilds</span></div>
              <p className="text-3xl font-bold">{stats.remoteGuilds ?? 0}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary, #94a3b8)' }}>in Discover</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
