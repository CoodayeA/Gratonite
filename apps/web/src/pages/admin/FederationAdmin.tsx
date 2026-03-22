/**
 * FederationAdmin.tsx — Admin federation dashboard.
 *
 * Panels: Instances, Activity Queue, Relays, Remote Guilds, Blocking, Health.
 */

import { useState, useEffect } from 'react';
import { Globe, Server, Activity, Shield, Ban, Wifi, RefreshCw, Trash2, Check, X, Clock, Users, AlertTriangle, BadgeCheck, Flag } from 'lucide-react';
import { api } from '../../lib/api';
import FederationBadge from '../../components/federation/FederationBadge';

type Tab = 'instances' | 'queue' | 'relays' | 'discover' | 'verification' | 'reports' | 'blocks' | 'health';

export default function FederationAdmin() {
  const [tab, setTab] = useState<Tab>('instances');
  const [stats, setStats] = useState<any>(null);
  const [instances, setInstances] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [relays, setRelays] = useState<any[]>([]);
  const [remoteGuilds, setRemoteGuilds] = useState<any[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
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
        case 'verification': setVerificationRequests(await api.get('/federation/admin/verification-requests') as any[]); break;
        case 'reports': setReports(await api.get('/federation/admin/reports') as any[]); break;
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
    { key: 'verification', label: 'Verification', icon: BadgeCheck },
    { key: 'reports', label: 'Reports', icon: Flag },
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

        {/* Verification Requests */}
        {tab === 'verification' && !loading && (
          <div className="space-y-2">
            {verificationRequests.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                <BadgeCheck size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <p>No verification requests</p>
              </div>
            )}
            {verificationRequests.map((r: any) => (
              <div key={r.id} className="p-4 rounded-lg" style={{ background: 'var(--color-card, #1e1e2e)', borderLeft: `3px solid ${r.status === 'pending' ? '#f59e0b' : r.status === 'approved' ? '#10b981' : '#ef4444'}` }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium" style={{ fontSize: '14px' }}>{r.instanceBaseUrl}</span>
                    <span style={{ fontSize: '11px', marginLeft: '8px', padding: '2px 6px', borderRadius: '4px', background: r.instanceTrustLevel === 'verified' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)', color: r.instanceTrustLevel === 'verified' ? '#10b981' : '#3b82f6' }}>
                      {r.instanceTrustLevel}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, background: r.status === 'pending' ? 'rgba(245,158,11,0.15)' : r.status === 'approved' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: r.status === 'pending' ? '#f59e0b' : r.status === 'approved' ? '#10b981' : '#ef4444' }}>
                    {r.status.toUpperCase()}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{r.description}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Contact: {r.contactEmail} — Score: {r.instanceTrustScore}/100</p>
                {r.status === 'pending' && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={async () => { await api.patch(`/federation/admin/verification-requests/${r.id}`, { status: 'approved' }); loadTab('verification'); }}
                      style={{ padding: '6px 16px', borderRadius: '6px', background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                    >
                      <Check size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> Approve
                    </button>
                    <button
                      onClick={async () => {
                        const notes = prompt('Rejection reason (visible to instance owner):');
                        if (notes !== null) { await api.patch(`/federation/admin/verification-requests/${r.id}`, { status: 'rejected', reviewNotes: notes }); loadTab('verification'); }
                      }}
                      style={{ padding: '6px 16px', borderRadius: '6px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--stroke)', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                    >
                      <X size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> Reject
                    </button>
                  </div>
                )}
                {r.reviewNotes && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>Notes: {r.reviewNotes}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Abuse Reports */}
        {tab === 'reports' && !loading && (
          <div className="space-y-2">
            {reports.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                <Flag size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <p>No abuse reports</p>
              </div>
            )}
            {reports.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--color-card, #1e1e2e)', borderLeft: `3px solid ${r.status === 'pending' ? '#ef4444' : '#6b7280'}` }}>
                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium" style={{ fontSize: '13px' }}>{r.instanceBaseUrl}</span>
                    <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 600 }}>{r.reason}</span>
                  </div>
                  {r.details && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{r.details}</p>}
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Reported by @{r.reporterUsername} — {new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
                {r.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={async () => { await api.patch(`/federation/admin/reports/${r.id}`, { status: 'reviewed' }); loadTab('reports'); }}
                      title="Mark as reviewed"
                      style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', cursor: 'pointer', color: 'var(--text-secondary)' }}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={async () => { await api.patch(`/federation/admin/reports/${r.id}`, { status: 'dismissed' }); loadTab('reports'); }}
                      title="Dismiss"
                      style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
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
