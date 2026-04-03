/**
 * FederationAdmin.tsx — Admin federation Trust & Safety dashboard.
 */

import { useState, useEffect } from 'react';
import { Globe, Server, Activity, Shield, Ban, Wifi, Trash2, Check, X, Users, BadgeCheck, Flag, RefreshCw, ExternalLink, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import ConnectInstanceWizard from '../../components/modals/ConnectInstanceWizard';

type Tab = 'instances' | 'queue' | 'relays' | 'discover' | 'verification' | 'reports' | 'blocks' | 'health';

const TRUST_COLORS: Record<string, string> = {
  verified: '#10b981',
  manually_trusted: '#3b82f6',
  auto_discovered: '#6b7280',
};
const TRUST_LABELS: Record<string, string> = {
  verified: 'Verified',
  manually_trusted: 'Trusted',
  auto_discovered: 'New',
};
const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  suspended: '#f59e0b',
  blocked: '#ef4444',
};

const Card = ({ children, style, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div style={{ background: 'var(--bg-secondary, #1a1a2e)', borderRadius: '12px', border: '1px solid var(--stroke, #2a2a3e)', padding: '16px', ...style }} {...props}>{children}</div>
);

const Badge = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: `${color}18`, color, whiteSpace: 'nowrap' }}>{children}</span>
);

const SmallBtn = ({ onClick, color = 'var(--text-secondary)', title, children }: { onClick: () => void; color?: string; title: string; children: React.ReactNode }) => (
  <button onClick={onClick} title={title} style={{ padding: '6px 12px', borderRadius: '8px', background: 'var(--bg-tertiary, #252540)', border: '1px solid var(--stroke, #2a2a3e)', cursor: 'pointer', color, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, transition: 'all 0.15s' }}>
    {children}
  </button>
);

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
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => { loadStats(); loadTab(tab); }, [tab]);

  const loadStats = async () => { try { setStats(await api.get('/federation/admin/stats')); } catch {} };
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
    } catch {}
    setLoading(false);
  };

  const handleUpdateInstance = async (id: string, updates: any) => { await api.patch(`/federation/admin/instances/${id}`, updates); loadTab('instances'); };
  const handleDeleteBlock = async (id: string) => { await api.delete(`/federation/admin/blocks/${id}`); loadTab('blocks'); };
  const handleApproveGuild = async (id: string, approved: boolean) => { await api.patch(`/federation/admin/discover/${id}`, { isApproved: approved }); loadTab('discover'); };

  const tabs: { key: Tab; label: string; icon: typeof Globe; count?: number }[] = [
    { key: 'instances', label: 'Instances', icon: Server, count: instances.length },
    { key: 'verification', label: 'Verification', icon: BadgeCheck, count: verificationRequests.filter(r => r.status === 'pending').length },
    { key: 'reports', label: 'Reports', icon: Flag, count: reports.filter(r => r.status === 'pending').length },
    { key: 'discover', label: 'Remote Guilds', icon: Globe, count: remoteGuilds.length },
    { key: 'queue', label: 'Activity', icon: Activity },
    { key: 'relays', label: 'Relays', icon: Wifi },
    { key: 'blocks', label: 'Blocks', icon: Ban, count: blocks.length },
    { key: 'health', label: 'Health', icon: Shield },
  ];

  const timeAgo = (iso: string | null) => {
    if (!iso) return 'never';
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 60000) return 'just now';
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
    if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
    return `${Math.floor(ms / 86400000)}d ago`;
  };

  return (
    <>
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
      {/* Header */}
      <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid var(--stroke, #2a2a3e)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, fontFamily: 'var(--font-display)' }}>Trust & Safety</h1>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Federation management & instance moderation</p>
            </div>
          </div>
          <button onClick={() => { loadStats(); loadTab(tab); }} style={{ padding: '8px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }} title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Stats bar */}
        {stats && (
          <div style={{ display: 'flex', gap: '24px', marginTop: '16px' }}>
            {[
              { label: 'Instances', value: stats.instances?.total ?? 0, sub: `${stats.instances?.active ?? 0} active`, color: '#6366f1' },
              { label: 'Pending', value: stats.activities?.pending ?? 0, sub: 'activities', color: '#f59e0b' },
              { label: 'Remote Users', value: stats.remoteUsers ?? 0, sub: 'shadow users', color: '#3b82f6' },
              { label: 'Remote Guilds', value: stats.remoteGuilds ?? 0, sub: 'in network', color: '#10b981' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />
                <div>
                  <span style={{ fontSize: '16px', fontWeight: 700 }}>{s.value}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>{s.label}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--stroke, #2a2a3e)', padding: '0 28px', gap: '4px', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '12px 16px', fontSize: '13px', fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? 'var(--accent-primary, #6366f1)' : 'var(--text-muted)',
              background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid var(--accent-primary, #6366f1)' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >
            <t.icon size={15} />
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '10px', background: t.key === 'reports' ? 'rgba(239,68,68,0.15)' : 'var(--bg-tertiary)', color: t.key === 'reports' ? '#ef4444' : 'var(--text-muted)' }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} style={{ margin: '0 auto 12px', opacity: 0.4, animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: '13px' }}>Loading...</p>
          </div>
        )}

        {/* ── Instances ── */}
        {tab === 'instances' && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {instances.map((inst: any) => {
              let hostname = inst.baseUrl;
              try { hostname = new URL(inst.baseUrl).hostname; } catch {}
              return (
                <Card key={inst.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: STATUS_COLORS[inst.status] || '#6b7280', flexShrink: 0 }} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{hostname}</span>
                        <Badge color={TRUST_COLORS[inst.trustLevel] || '#6b7280'}>{TRUST_LABELS[inst.trustLevel] || inst.trustLevel}</Badge>
                        <Badge color={STATUS_COLORS[inst.status] || '#6b7280'}>{inst.status}</Badge>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '12px' }}>
                        <span>v{inst.softwareVersion || '?'}</span>
                        <span>Score: {inst.trustScore}/100</span>
                        <span>Last seen: {timeAgo(inst.lastSeenAt)}</span>
                        {inst.federatedMemberCount > 0 && <span style={{ color: 'var(--text-secondary)' }}>{inst.federatedMemberCount} remote member{inst.federatedMemberCount !== 1 ? 's' : ''}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {inst.status === 'active' && inst.trustLevel !== 'verified' && (
                      <SmallBtn onClick={() => handleUpdateInstance(inst.id, { trustLevel: 'verified' })} color="#10b981" title="Verify">
                        <BadgeCheck size={14} /> Verify
                      </SmallBtn>
                    )}
                    {inst.status === 'active' && (
                      <SmallBtn onClick={() => handleUpdateInstance(inst.id, { status: 'suspended' })} color="#f59e0b" title="Suspend">
                        <X size={14} /> Suspend
                      </SmallBtn>
                    )}
                    {inst.status !== 'blocked' ? (
                      <SmallBtn onClick={() => handleUpdateInstance(inst.id, { status: 'blocked' })} color="#ef4444" title="Block">
                        <Ban size={14} />
                      </SmallBtn>
                    ) : (
                      <SmallBtn onClick={() => handleUpdateInstance(inst.id, { status: 'active' })} color="#10b981" title="Unblock">
                        <Check size={14} /> Unblock
                      </SmallBtn>
                    )}
                  </div>
                </Card>
              );
            })}
            {instances.length === 0 && <EmptyState icon={Server} text="No connected instances" />}
          </div>
        )}

        {/* ── Verification Requests ── */}
        {tab === 'verification' && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {verificationRequests.map((r: any) => (
              <Card key={r.id} style={{ borderLeft: `3px solid ${r.status === 'pending' ? '#f59e0b' : r.status === 'approved' ? '#10b981' : '#ef4444'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.instanceBaseUrl}</span>
                    <Badge color={TRUST_COLORS[r.instanceTrustLevel] || '#6b7280'}>{TRUST_LABELS[r.instanceTrustLevel] || r.instanceTrustLevel}</Badge>
                  </div>
                  <Badge color={r.status === 'pending' ? '#f59e0b' : r.status === 'approved' ? '#10b981' : '#ef4444'}>
                    {r.status.toUpperCase()}
                  </Badge>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '8px' }}>{r.description}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Contact: <strong>{r.contactEmail}</strong> · Trust Score: {r.instanceTrustScore}/100 · Submitted {timeAgo(r.createdAt)}
                </p>
                {r.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <SmallBtn onClick={async () => { await api.patch(`/federation/admin/verification-requests/${r.id}`, { status: 'approved' }); loadTab('verification'); }} color="#10b981" title="Approve">
                      <Check size={14} /> Approve — Promote to Verified
                    </SmallBtn>
                    <SmallBtn onClick={async () => { const notes = prompt('Rejection reason (visible to instance owner):'); if (notes !== null) { await api.patch(`/federation/admin/verification-requests/${r.id}`, { status: 'rejected', reviewNotes: notes }); loadTab('verification'); } }} color="#ef4444" title="Reject">
                      <X size={14} /> Reject
                    </SmallBtn>
                  </div>
                )}
                {r.reviewNotes && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px', padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '6px', fontStyle: 'italic' }}>Review notes: {r.reviewNotes}</p>}
              </Card>
            ))}
            {verificationRequests.length === 0 && <EmptyState icon={BadgeCheck} text="No verification requests" />}
          </div>
        )}

        {/* ── Abuse Reports ── */}
        {tab === 'reports' && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 4px', lineHeight: 1.45 }}>
              Cross-instance issues: coordinate with the remote instance admin when possible; use <strong>Blocks</strong> for repeat abuse from a domain.
            </p>
            {reports.map((r: any) => (
              <Card key={r.id} style={{ borderLeft: `3px solid ${r.status === 'pending' ? '#ef4444' : r.status === 'escalated' ? '#8b5cf6' : '#6b7280'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.instanceBaseUrl}</span>
                    <Badge color="#ef4444">{r.reason}</Badge>
                    <Badge color={r.status === 'pending' ? '#f59e0b' : r.status === 'escalated' ? '#8b5cf6' : '#6b7280'}>{r.status}</Badge>
                  </div>
                  {r.details && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{r.details}</p>}
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Reported by <strong>@{r.reporterUsername}</strong> · {timeAgo(r.createdAt)}
                  </p>
                </div>
                {r.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <SmallBtn onClick={async () => { await api.post(`/federation/admin/reports/${r.id}/escalate`, {}); loadTab('reports'); }} color="#8b5cf6" title="Escalate to remote instance admin">
                      <ExternalLink size={14} /> Escalate
                    </SmallBtn>
                    <SmallBtn onClick={async () => { await api.patch(`/federation/admin/reports/${r.id}`, { status: 'reviewed' }); loadTab('reports'); }} color="#10b981" title="Mark reviewed">
                      <Check size={14} />
                    </SmallBtn>
                    <SmallBtn onClick={async () => { await api.patch(`/federation/admin/reports/${r.id}`, { status: 'dismissed' }); loadTab('reports'); }} title="Dismiss">
                      <X size={14} />
                    </SmallBtn>
                  </div>
                )}
              </Card>
            ))}
            {reports.length === 0 && <EmptyState icon={Flag} text="No abuse reports" />}
          </div>
        )}

        {/* ── Remote Guilds ── */}
        {tab === 'discover' && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowWizard(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: 'var(--brand, #5865f2)', border: 'none', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                <Plus size={14} /> Connect Instance
              </button>
            </div>
            {remoteGuilds.map((g: any) => {
              let hostname = g.instanceBaseUrl;
              try { hostname = new URL(g.instanceBaseUrl).hostname; } catch {}
              return (
                <Card key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {g.iconUrl ? (
                      <img src={g.iconUrl} alt="" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', color: 'var(--text-muted)' }}>
                        {g.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{g.name}</span>
                        <Badge color={g.isApproved ? '#10b981' : '#6b7280'}>{g.isApproved ? 'Approved' : 'Pending'}</Badge>
                        <Badge color={TRUST_COLORS[g.instanceTrustLevel] || '#6b7280'}>{TRUST_LABELS[g.instanceTrustLevel] || g.instanceTrustLevel}</Badge>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {g.memberCount} members · {hostname} · {g.category || 'no category'}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {!g.isApproved ? (
                      <SmallBtn onClick={() => handleApproveGuild(g.id, true)} color="#10b981" title="Approve for Discover">
                        <Check size={14} /> Approve
                      </SmallBtn>
                    ) : (
                      <SmallBtn onClick={() => handleApproveGuild(g.id, false)} color="#f59e0b" title="Remove from Discover">
                        <X size={14} /> Revoke
                      </SmallBtn>
                    )}
                  </div>
                </Card>
              );
            })}
            {remoteGuilds.length === 0 && <EmptyState icon={Globe} text="No remote guilds" />}
          </div>
        )}

        {/* ── Activity Queue ── */}
        {tab === 'queue' && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {queue.map((act: any) => (
              <Card key={act.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Badge color={act.status === 'delivered' ? '#10b981' : act.status === 'dead' ? '#ef4444' : act.status === 'pending' ? '#f59e0b' : '#3b82f6'}>
                      {act.status}
                    </Badge>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{act.activityType}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{act.direction}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{timeAgo(act.createdAt)}</span>
                </div>
                {act.error && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '6px' }}>{act.error}</p>}
              </Card>
            ))}
            {queue.length === 0 && <EmptyState icon={Activity} text="Activity queue is empty" />}
          </div>
        )}

        {/* ── Relays ── */}
        {tab === 'relays' && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {relays.map((relay: any) => (
              <Card key={relay.domain} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{relay.domain}</span>
                    <Badge color={relay.reputationScore >= 70 ? '#10b981' : relay.reputationScore >= 40 ? '#f59e0b' : '#ef4444'}>
                      Score: {relay.reputationScore}
                    </Badge>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {relay.connectedInstances} instances · {relay.meshPeers} mesh peers · v{relay.softwareVersion || '?'} · {relay.latencyMs}ms · {relay.uptimePercent}% uptime
                  </p>
                </div>
              </Card>
            ))}
            {relays.length === 0 && <EmptyState icon={Wifi} text="No relays registered" />}
          </div>
        )}

        {/* ── Blocks ── */}
        {tab === 'blocks' && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {blocks.map((block: any) => (
              <Card key={block.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{block.blockedDomain}</span>
                  {block.reason && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{block.reason}</p>}
                  {block.expiresAt && <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Expires: {new Date(block.expiresAt).toLocaleDateString()}</p>}
                </div>
                <SmallBtn onClick={() => handleDeleteBlock(block.id)} color="#ef4444" title="Remove block">
                  <Trash2 size={14} />
                </SmallBtn>
              </Card>
            ))}
            {blocks.length === 0 && <EmptyState icon={Ban} text="No active blocks" />}
          </div>
        )}

        {/* ── Health ── */}
        {tab === 'health' && !loading && stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            {[
              { icon: Server, label: 'Instances', value: stats.instances?.total ?? 0, sub: `${stats.instances?.active ?? 0} active`, gradient: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))' },
              { icon: Activity, label: 'Pending Activities', value: stats.activities?.pending ?? 0, sub: 'in queue', gradient: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(249,115,22,0.15))' },
              { icon: Users, label: 'Remote Users', value: stats.remoteUsers ?? 0, sub: 'shadow accounts', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(6,182,212,0.15))' },
              { icon: Globe, label: 'Remote Guilds', value: stats.remoteGuilds ?? 0, sub: 'in network', gradient: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(52,211,153,0.15))' },
            ].map(s => (
              <Card key={s.label} style={{ background: s.gradient }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--text-muted)' }}>
                  <s.icon size={18} /> <span style={{ fontWeight: 500, fontSize: '13px' }}>{s.label}</span>
                </div>
                <p style={{ fontSize: '32px', fontWeight: 800, fontFamily: 'var(--font-display)', margin: 0 }}>{s.value}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.sub}</p>
              </Card>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>

    {showWizard && (
      <ConnectInstanceWizard
        onClose={() => setShowWizard(false)}
        onConnected={() => { setShowWizard(false); setTab('instances'); loadTab('instances' as Tab); }}
      />
    )}
    </>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Globe; text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
      <Icon size={36} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
      <p style={{ fontSize: '14px' }}>{text}</p>
    </div>
  );
}
