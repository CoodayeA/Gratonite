import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Search,
  ChevronDown,
  Trash2,
  X,
  Mail,
  Shield,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';

type Role = 'admin' | 'moderator' | 'support';
type Status = 'active' | 'pending';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: Status;
  joined: string;
  avatar: string;
}

const ROLE_COLORS: Record<Role, { bg: string; text: string; border: string }> = {
  admin: {
    bg: 'rgba(239, 68, 68, 0.12)',
    text: 'var(--error)',
    border: 'rgba(239, 68, 68, 0.3)',
  },
  moderator: {
    bg: 'rgba(168, 85, 247, 0.12)',
    text: 'var(--accent-purple)',
    border: 'rgba(168, 85, 247, 0.3)',
  },
  support: {
    bg: 'rgba(59, 130, 246, 0.12)',
    text: 'var(--accent-blue)',
    border: 'rgba(59, 130, 246, 0.3)',
  },
};

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  moderator: 'Moderator',
  support: 'Support',
};

function RoleBadge({ role }: { role: Role }) {
  const colors = ROLE_COLORS[role];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 10px',
        borderRadius: 'var(--radius-sm)',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Shield size={10} />
      {ROLE_LABELS[role]}
    </span>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const isActive = status === 'active';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 10px',
        borderRadius: 'var(--radius-sm)',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: isActive ? 'rgba(34, 197, 94, 0.12)' : 'rgba(234, 179, 8, 0.12)',
        color: isActive ? 'var(--success)' : 'var(--warning)',
        border: `1px solid ${isActive ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
        fontFamily: 'var(--font-sans)',
      }}
    >
      {isActive ? <CheckCircle size={10} /> : <Clock size={10} />}
      {isActive ? 'Active' : 'Pending'}
    </span>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AdminTeam() {
  useOutletContext();
  const { addToast } = useToast();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [search, setSearch] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('support');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [openRoleDropdown, setOpenRoleDropdown] = useState<string | null>(null);

  // Fetch team members from API
  const loadMembers = useCallback(() => {
    api.adminTeam.list().then(res => {
      const items: any[] = Array.isArray(res) ? res : ((res as any).items ?? []) as any[];
      const roleMap: Record<string, Role> = { admin: 'admin', moderator: 'moderator', support: 'support' };
      setMembers(
        items
          .map((m: any) => ({
            id: m.id ?? m.userId ?? m.email,
            name: m.name ?? m.username ?? m.displayName ?? 'Unknown',
            email: m.email ?? '',
            role: roleMap[m.role] ?? 'support',
            status: (m.status === 'pending' ? 'pending' : 'active') as Status,
            joined: m.joinedAt ?? m.createdAt ?? new Date().toISOString().slice(0, 10),
            avatar: m.avatar ?? (m.name ?? 'U').slice(0, 2).toUpperCase(),
          }))
          .filter((m) => Boolean(m.id)),
      );
    }).catch(() => {
      addToast({ title: 'Failed to load team members', variant: 'error' });
    });
  }, [addToast]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      m.role.includes(search.toLowerCase())
  );

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    api.adminTeam.invite({ email: inviteEmail.trim(), role: inviteRole })
      .then(() => {
        addToast({ title: `Invitation sent to ${inviteEmail.trim()}`, variant: 'success' });
        setInviteEmail('');
        setInviteRole('support');
        setShowInviteForm(false);
        loadMembers();
      })
      .catch(() => {
        addToast({ title: 'Failed to send invitation', variant: 'error' });
      })
      .finally(() => {
        setInviteLoading(false);
      });
  }

  function handleRoleChange(id: string, newRole: Role) {
    const member = members.find((m) => m.id === id);
    if (member?.status === 'pending') {
      addToast({ title: 'Accept invite before changing role', variant: 'info' });
      return;
    }
    api.adminTeam.updateRole(id, newRole)
      .then(() => {
        setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role: newRole } : m)));
        setOpenRoleDropdown(null);
        addToast({ title: `${member?.name}'s role updated to ${ROLE_LABELS[newRole]}`, variant: 'success' });
      })
      .catch(() => {
        addToast({ title: 'Failed to update role', variant: 'error' });
      });
  }

  function handleRemove(id: string) {
    const member = members.find((m) => m.id === id);
    api.adminTeam.remove(id)
      .then(() => {
        setMembers((prev) => prev.filter((m) => m.id !== id));
        setConfirmRemoveId(null);
        addToast({ title: `${member?.name} has been removed from the team`, variant: 'error' });
      })
      .catch(() => {
        addToast({ title: 'Failed to remove team member', variant: 'error' });
      });
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 14px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div
      className="main-content-wrapper"
      style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}
    >
      <div
        className="content-padding"
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '48px 24px',
          width: '100%',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '32px',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '6px',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(168, 85, 247, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-purple)',
                }}
              >
                <Users size={18} />
              </div>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '24px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                Team Management
              </h1>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                color: 'var(--text-muted)',
                margin: 0,
              }}
            >
              Manage roles, permissions, and access for your Gratonite team members.
            </p>
          </div>

          <button
            onClick={() => setShowInviteForm((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              background: showInviteForm ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
              color: showInviteForm ? 'var(--text-secondary)' : '#fff',
              border: showInviteForm ? '1px solid var(--stroke)' : 'none',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {showInviteForm ? <X size={15} /> : <UserPlus size={15} />}
            {showInviteForm ? 'Cancel Invite' : 'Invite Team Member'}
          </button>
        </div>

        {/* Invite Form */}
        {showInviteForm && (
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--stroke)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              marginBottom: '28px',
              boxShadow: 'var(--shadow-panel)',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: '0 0 18px 0',
              }}
            >
              Send Invitation
            </h3>
            <form onSubmit={handleInvite}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 180px auto',
                  gap: '12px',
                  alignItems: 'flex-end',
                }}
              >
                {/* Email */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: '6px',
                      fontFamily: 'var(--font-sans)',
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail
                      size={14}
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      type="email"
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                      style={{ ...inputStyle, paddingLeft: '34px' }}
                    />
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: '6px',
                      fontFamily: 'var(--font-sans)',
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as Role)}
                    style={{
                      ...inputStyle,
                      cursor: 'pointer',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                    }}
                  >
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderator</option>
                    <option value="support">Support</option>
                  </select>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={inviteLoading}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--accent-primary)',
                    color: '#fff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-sans)',
                    cursor: inviteLoading ? 'not-allowed' : 'pointer',
                    opacity: inviteLoading ? 0.7 : 1,
                    whiteSpace: 'nowrap',
                    transition: 'opacity 0.15s',
                    height: '40px',
                  }}
                >
                  {inviteLoading ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search + Stats Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            marginBottom: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '360px' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Search by name, email, or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                ...inputStyle,
                paddingLeft: '34px',
                maxWidth: '100%',
              }}
            />
          </div>

          <span
            style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-sans)',
              whiteSpace: 'nowrap',
            }}
          >
            {filtered.length} of {members.length} members
          </span>
        </div>

        {/* Table */}
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--stroke)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-panel)',
          }}
        >
          {/* Table Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 100px 120px 140px',
              padding: '12px 20px',
              borderBottom: '1px solid var(--border-structural)',
              background: 'var(--bg-elevated)',
            }}
          >
            {['Member', 'Role', 'Status', 'Joined', 'Actions'].map((col) => (
              <span
                key={col}
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-sans)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                {col}
              </span>
            ))}
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div
              style={{
                padding: '48px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
              }}
            >
              No team members match your search.
            </div>
          ) : (
            filtered.map((member, idx) => (
              <div
                key={member.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 100px 120px 140px',
                  padding: '14px 20px',
                  alignItems: 'center',
                  borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-structural)' : 'none',
                  transition: 'background 0.1s',
                  background: 'transparent',
                }}
                className="hover-bg-overlay"
              >
                {/* Member */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${ROLE_COLORS[member.role].bg}, rgba(255,255,255,0.05))`,
                      border: `1px solid ${ROLE_COLORS[member.role].border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: ROLE_COLORS[member.role].text,
                      fontFamily: 'var(--font-sans)',
                      flexShrink: 0,
                    }}
                  >
                    {member.avatar}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-sans)',
                        lineHeight: 1.3,
                      }}
                    >
                      {member.name}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-sans)',
                        lineHeight: 1.3,
                      }}
                    >
                      {member.email}
                    </div>
                  </div>
                </div>

                {/* Role */}
                <div>
                  <RoleBadge role={member.role} />
                </div>

                {/* Status */}
                <div>
                  <StatusBadge status={member.status} />
                </div>

                {/* Joined */}
                <div
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {formatDate(member.joined)}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Role Dropdown */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() =>
                        setOpenRoleDropdown(openRoleDropdown === member.id ? null : member.id)
                      }
                      disabled={member.status === 'pending'}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--stroke)',
                        color: 'var(--text-secondary)',
                        fontSize: '12px',
                        fontWeight: 500,
                        fontFamily: 'var(--font-sans)',
                        cursor: member.status === 'pending' ? 'not-allowed' : 'pointer',
                        opacity: member.status === 'pending' ? 0.55 : 1,
                        transition: 'background 0.12s',
                      }}
                      title={member.status === 'pending' ? 'Role can be changed after invite acceptance' : 'Change role'}
                    >
                      Role
                      <ChevronDown size={12} />
                    </button>

                    {openRoleDropdown === member.id && member.status !== 'pending' && (
                      <>
                        {/* Backdrop */}
                        <div
                          style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 10,
                          }}
                          onClick={() => setOpenRoleDropdown(null)}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            right: 0,
                            zIndex: 20,
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--stroke)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: 'var(--shadow-panel)',
                            minWidth: '140px',
                            overflow: 'hidden',
                          }}
                        >
                          {(['admin', 'moderator', 'support'] as Role[]).map((r) => (
                            <button
                              key={r}
                              onClick={() => handleRoleChange(member.id, r)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                width: '100%',
                                padding: '9px 14px',
                                background: member.role === r ? 'var(--active-overlay)' : 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: '13px',
                                fontFamily: 'var(--font-sans)',
                                color: member.role === r ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontWeight: member.role === r ? 600 : 400,
                                transition: 'background 0.1s',
                              }}
                              className="hover-bg-overlay"
                            >
                              <span
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background: ROLE_COLORS[r].text,
                                  flexShrink: 0,
                                }}
                              />
                              {ROLE_LABELS[r]}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Remove */}
                  {confirmRemoveId === member.id ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => handleRemove(member.id)}
                        style={{
                          padding: '5px 9px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          color: 'var(--error)',
                          fontSize: '11px',
                          fontWeight: 600,
                          fontFamily: 'var(--font-sans)',
                          cursor: 'pointer',
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmRemoveId(null)}
                        style={{
                          padding: '5px 7px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--stroke)',
                          color: 'var(--text-muted)',
                          fontSize: '11px',
                          fontFamily: 'var(--font-sans)',
                          cursor: 'pointer',
                        }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRemoveId(member.id)}
                      title="Remove member"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '30px',
                        height: '30px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'transparent',
                        border: '1px solid transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                      className="hover-remove-btn"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Note */}
        <p
          style={{
            marginTop: '20px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-sans)',
            textAlign: 'center',
          }}
        >
          Changes to team roles take effect immediately. Removed members lose access instantly.
        </p>
      </div>
    </div>
  );
}
