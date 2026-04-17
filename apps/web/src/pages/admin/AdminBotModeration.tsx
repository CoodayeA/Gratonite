import React, { useState, useEffect } from 'react';
import { Bot, CheckCircle2, XCircle, Clock, Eye, Search, Filter, Shield, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';

type BotStatus = 'pending' | 'approved' | 'rejected';

interface BotListing {
  id: string;
  name: string;
  developer: string;
  description: string;
  category: string;
  submittedAt: string;
  status: BotStatus;
  avatarColor: string;
}

type TabFilter = 'all' | BotStatus;

const CATEGORY_COLORS: Record<string, string> = {
  'Developer Tools': 'var(--accent-purple)',
  'Customer Support': 'var(--accent-blue)',
  'Data & Analytics': 'var(--success)',
  'Productivity': '#f59e0b',
  'Security': 'var(--error)',
  'Marketing': '#a855f7',
};

export default function AdminBotModeration() {
  const { addToast } = useToast();
  const [bots, setBots] = useState<BotListing[]>([]);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Fetch bot listings from API, fall back to empty list
  useEffect(() => {
    api.adminBotStore.list({ limit: 200 }).then((res: any) => {
      const raw: any[] = Array.isArray(res) ? res : res?.items ?? [];
      const statusMap: Record<string, BotStatus> = { pending: 'pending', approved: 'approved', rejected: 'rejected', verified: 'approved', delisted: 'rejected' };
      setBots(raw.filter((b: any) => Boolean(b.id ?? b.applicationId ?? b.name)).map((b: any) => ({
        id: b.id ?? b.applicationId ?? String(b.name),
        name: b.name ?? 'Unknown Bot',
        developer: b.developerName ?? b.creatorName ?? 'Unknown',
        description: b.description ?? '',
        category: b.category ?? 'General',
        submittedAt: b.createdAt ?? new Date().toISOString().slice(0, 10),
        status: statusMap[b.status] ?? 'pending',
        avatarColor: b.avatarColor ?? '#6366f1',
      })));
    }).catch(() => {
      addToast({ title: 'Failed to load bot listings', variant: 'error' });
    });
  }, []);

  const counts = {
    all: bots.length,
    pending: bots.filter(b => b.status === 'pending').length,
    approved: bots.filter(b => b.status === 'approved').length,
    rejected: bots.filter(b => b.status === 'rejected').length,
  };

  const filtered = bots.filter(bot => {
    const matchesTab = activeTab === 'all' || bot.status === activeTab;
    const matchesSearch = bot.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleApprove = (id: string) => {
    const bot = bots.find(b => b.id === id);
    setBots(prev => prev.map(b => b.id === id ? { ...b, status: 'approved' } : b));
    api.adminBotStore.toggleVerified(id).catch(() => { addToast({ title: 'Failed to approve bot on server', variant: 'error' }); });
    addToast({
      title: 'Bot Approved',
      description: `${bot?.name} is now live in the Bot Store.`,
      variant: 'success',
    });
  };

  const handleRejectConfirm = (id: string) => {
    if (!rejectReason.trim()) {
      addToast({
        title: 'Reason Required',
        description: 'Please provide a reason for rejection.',
        variant: 'error',
      });
      return;
    }
    const bot = bots.find(b => b.id === id);
    setBots(prev => prev.map(b => b.id === id ? { ...b, status: 'rejected' } : b));
    api.adminBotStore.forceDelist(id).catch(() => { addToast({ title: 'Failed to reject bot on server', variant: 'error' }); });
    addToast({
      title: 'Bot Rejected',
      description: `${bot?.name} has been rejected. Developer will be notified.`,
      variant: 'info',
    });
    setRejectingId(null);
    setRejectReason('');
  };

  const handleViewDetails = (name: string) => {
    addToast({
      title: 'Details Panel',
      description: `Opening full review for "${name}"...`,
      variant: 'info',
    });
  };

  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  const statCards = [
    { label: 'Total Submissions', value: counts.all, icon: Shield, color: 'var(--accent-blue)' },
    { label: 'Pending Review', value: counts.pending, icon: Clock, color: 'var(--warning)' },
    { label: 'Approved', value: counts.approved, icon: CheckCircle2, color: 'var(--success)' },
    { label: 'Rejected', value: counts.rejected, icon: XCircle, color: 'var(--error)' },
  ];

  const getStatusBadge = (status: BotStatus) => {
    const map: Record<BotStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
      pending: {
        label: 'Pending',
        color: 'var(--warning)',
        bg: 'rgba(245,158,11,0.12)',
        icon: <Clock size={12} />,
      },
      approved: {
        label: 'Approved',
        color: 'var(--success)',
        bg: 'rgba(16,185,129,0.12)',
        icon: <CheckCircle2 size={12} />,
      },
      rejected: {
        label: 'Rejected',
        color: 'var(--error)',
        bg: 'rgba(239,68,68,0.12)',
        icon: <XCircle size={12} />,
      },
    };
    const s = map[status];
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 600,
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.color}33`,
      }}>
        {s.icon}
        {s.label}
      </span>
    );
  };

  const getTabCount = (key: TabFilter) => counts[key];

  return (
    <div className="main-content-wrapper" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px', width: '100%' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ marginBottom: '14px', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Need live reports, guild mod queue, or appeal context while you review bots?
            </div>
            <Link to="/admin/moderation-workspace" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontSize: '13px', fontWeight: 700 }}>
              Open moderation workspace
            </Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Shield size={20} color="#fff" />
            </div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
              margin: 0,
            }}>
              Bot Store Moderation
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0, paddingLeft: '52px' }}>
            Review and approve bot store listings
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid-mobile-2" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}>
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--stroke)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: 'var(--shadow-panel)',
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                background: `${color}1a`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color,
              }}>
                <Icon size={18} />
              </div>
              <div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {value}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar: Search + Tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}>
          {/* Tab Filters */}
          <div style={{
            display: 'flex',
            gap: '4px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--stroke)',
            borderRadius: 'var(--radius-md)',
            padding: '4px',
          }}>
            {tabs.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                    background: isActive ? 'var(--bg-elevated)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: isActive ? 'var(--shadow-panel)' : 'none',
                  }}
                >
                  {tab.label}
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '999px',
                    background: isActive ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    color: isActive ? '#fff' : 'var(--text-muted)',
                    minWidth: '18px',
                    textAlign: 'center',
                  }}>
                    {getTabCount(tab.key)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search size={15} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }} />
            <input
              type="text"
              placeholder="Search bots..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--stroke)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              className="focus-border-accent"
            />
          </div>
        </div>

        {/* Bot List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '60px 24px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--stroke)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--text-muted)',
            }}>
              <Filter size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: '15px' }}>No bot listings match your filter.</p>
            </div>
          )}

          {filtered.map(bot => {
            const isRejecting = rejectingId === bot.id;
            const catColor = CATEGORY_COLORS[bot.category] ?? 'var(--text-muted)';

            return (
              <div key={bot.id} style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--stroke)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px',
                boxShadow: 'var(--shadow-panel)',
                transition: 'border-color 0.15s ease',
              }}
                className="hover-border-accent-subtle"
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  {/* Avatar */}
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius-md)',
                    background: bot.avatarColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: `0 4px 12px ${bot.avatarColor}44`,
                  }}>
                    <Bot size={24} color="#fff" />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-display)',
                      }}>
                        {bot.name}
                      </span>
                      {/* Category badge */}
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background: `${catColor}18`,
                        color: catColor,
                        border: `1px solid ${catColor}33`,
                      }}>
                        {bot.category}
                      </span>
                      {getStatusBadge(bot.status)}
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      by <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{bot.developer}</span>
                      <span style={{ marginLeft: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} />
                        Submitted {bot.submittedAt}
                      </span>
                    </div>

                    <p style={{
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      margin: 0,
                      lineHeight: '1.6',
                    }}>
                      {bot.description}
                    </p>

                    {/* Reject reason input */}
                    {isRejecting && (
                      <div style={{
                        marginTop: '14px',
                        padding: '14px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--error)44',
                        borderRadius: 'var(--radius-md)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                          <AlertTriangle size={14} color="var(--warning)" />
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Rejection Reason
                          </span>
                        </div>
                        <textarea
                          autoFocus
                          placeholder="Explain why this bot is being rejected (required)..."
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--stroke)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-primary)',
                            fontSize: '13px',
                            resize: 'vertical',
                            outline: 'none',
                            boxSizing: 'border-box',
                            fontFamily: 'inherit',
                          }}
                          className="focus-border-error"
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                          <button
                            onClick={() => handleRejectConfirm(bot.id)}
                            style={{
                              padding: '7px 16px',
                              background: 'var(--error)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 600,
                              fontSize: '13px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <XCircle size={14} />
                            Confirm Rejection
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setRejectReason(''); }}
                            style={{
                              padding: '7px 14px',
                              background: 'var(--bg-elevated)',
                              color: 'var(--text-secondary)',
                              border: '1px solid var(--stroke)',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 500,
                              fontSize: '13px',
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, alignItems: 'flex-end' }}>
                    <button
                      onClick={() => handleViewDetails(bot.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 12px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--stroke)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-secondary)',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                      className="hover-bg-elevated-text-primary"
                    >
                      <Eye size={13} />
                      View Details
                    </button>

                    {bot.status === 'pending' && !isRejecting && (
                      <>
                        <button
                          onClick={() => handleApprove(bot.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 12px',
                            background: 'rgba(16,185,129,0.12)',
                            border: '1px solid rgba(16,185,129,0.35)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--success)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                          className="hover-approve-btn"
                        >
                          <CheckCircle2 size={13} />
                          Approve
                        </button>
                        <button
                          onClick={() => { setRejectingId(bot.id); setRejectReason(''); }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 12px',
                            background: 'rgba(239,68,68,0.10)',
                            border: '1px solid rgba(239,68,68,0.35)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--error)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                          className="hover-reject-btn"
                        >
                          <XCircle size={13} />
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
