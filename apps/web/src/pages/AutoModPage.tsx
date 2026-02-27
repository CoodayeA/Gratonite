import { useEffect, useState, CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { shouldEnableUiV2Tokens } from '@/theme/initTheme';

interface AutoModRule {
  id: string;
  guildId: string;
  name: string;
  enabled: boolean;
  triggerType: 'keyword' | 'spam' | 'mention_spam' | 'keyword_preset';
  triggerConfig: Record<string, unknown>;
  actions: Array<{
    type: 'block' | 'alert' | 'timeout';
    duration?: number;
  }>;
  exemptChannels: string[];
  exemptRoles: string[];
  createdAt: string;
}

const s = {
  page: {
    padding: 24,
    color: '#e8e4e0',
    minHeight: '100%',
    background: '#2c2c3e',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 64,
    color: '#a8a4b8',
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #4a4660',
    borderTopColor: '#d4af37',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    color: '#e8e4e0',
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: 14,
    color: '#a8a4b8',
  },
  createBtn: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    background: '#d4af37',
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    background: 'rgba(232, 90, 110, 0.1)',
    border: '1px solid rgba(232, 90, 110, 0.3)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 16px',
    marginBottom: 16,
    color: '#e85a6e',
  },
  rules: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: 48,
    color: '#6e6a80',
    textAlign: 'center',
  },
  emptyTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#a8a4b8',
  },
  emptyText: {
    margin: 0,
    fontSize: 14,
  },
  ruleCard: {
    background: '#25243a',
    borderRadius: 'var(--radius-md)',
    padding: 16,
  },
  ruleCardDisabled: {
    background: '#25243a',
    borderRadius: 'var(--radius-md)',
    padding: 16,
    opacity: 0.6,
  },
  ruleHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  toggleSwitch: {
    position: 'relative',
    display: 'inline-block',
    width: 40,
    height: 22,
    flexShrink: 0,
  },
  toggleInput: {
    opacity: 0,
    width: 0,
    height: 0,
    position: 'absolute',
  },
  toggleSliderOff: {
    position: 'absolute',
    cursor: 'pointer',
    inset: 0,
    background: '#4a4660',
    borderRadius: 'var(--radius-xl)',
    transition: 'background 0.2s',
  },
  toggleSliderOn: {
    position: 'absolute',
    cursor: 'pointer',
    inset: 0,
    background: '#d4af37',
    borderRadius: 'var(--radius-xl)',
    transition: 'background 0.2s',
  },
  toggleKnobOff: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 16,
    height: 16,
    background: '#e8e4e0',
    borderRadius: '50%',
    transition: 'transform 0.2s',
  },
  toggleKnobOn: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 16,
    height: 16,
    background: '#1a1a2e',
    borderRadius: '50%',
    transition: 'transform 0.2s',
    transform: 'translateX(18px)',
  },
  ruleInfo: {
    flex: 1,
    minWidth: 0,
  },
  ruleName: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: '#e8e4e0',
  },
  ruleTrigger: {
    fontSize: 12,
    color: '#a8a4b8',
    fontWeight: 500,
    marginTop: 2,
    display: 'block',
  },
  ruleActions: {
    display: 'flex',
    gap: 8,
    flexShrink: 0,
  },
  editBtn: {
    padding: '6px 14px',
    border: '1px solid #4a4660',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: '#a8a4b8',
    fontSize: 12,
    cursor: 'pointer',
  },
  deleteBtn: {
    padding: '6px 14px',
    border: '1px solid rgba(232, 90, 110, 0.3)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: '#e85a6e',
    fontSize: 12,
    cursor: 'pointer',
  },
  ruleDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    paddingTop: 12,
    borderTop: '1px solid #4a4660',
  },
  detail: {
    display: 'flex',
    gap: 8,
    fontSize: 13,
  },
  detailLabel: {
    color: '#6e6a80',
    fontWeight: 500,
    flexShrink: 0,
  },
  detailValue: {
    color: '#a8a4b8',
  },
  infoBox: {
    background: '#25243a',
    borderRadius: 'var(--radius-md)',
    padding: 16,
    marginTop: 24,
    borderLeft: '3px solid #d4af37',
  },
  infoTitle: {
    margin: '0 0 8px 0',
    fontSize: 14,
    fontWeight: 600,
    color: '#e8e4e0',
  },
  infoList: {
    margin: 0,
    paddingLeft: 20,
    fontSize: 13,
    color: '#a8a4b8',
    lineHeight: 1.8,
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalDialog: {
    background: '#353348',
    borderRadius: 'var(--radius-lg)',
    padding: 24,
    width: 480,
    maxWidth: '90vw',
    position: 'relative',
  },
  modalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    border: 'none',
    background: 'transparent',
    color: '#a8a4b8',
    fontSize: 20,
    cursor: 'pointer',
    lineHeight: 1,
  },
  modalTitle: {
    margin: '0 0 20px 0',
    fontSize: 18,
    fontWeight: 600,
    color: '#e8e4e0',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: '#a8a4b8',
  },
  formInput: {
    padding: '10px 12px',
    border: '1px solid #4a4660',
    borderRadius: 'var(--radius-sm)',
    background: '#25243a',
    color: '#e8e4e0',
    fontSize: 14,
    outline: 'none',
  },
  formSelect: {
    padding: '10px 12px',
    border: '1px solid #4a4660',
    borderRadius: 'var(--radius-sm)',
    background: '#25243a',
    color: '#e8e4e0',
    fontSize: 14,
    outline: 'none',
  },
  actionsSelect: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    color: '#e8e4e0',
    cursor: 'pointer',
  },
  formActions: {
    display: 'flex',
    gap: 8,
    marginTop: 8,
  },
  saveBtn: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    background: '#d4af37',
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '10px 20px',
    border: '1px solid #4a4660',
    borderRadius: 'var(--radius-md)',
    background: 'transparent',
    color: '#a8a4b8',
    fontSize: 14,
    cursor: 'pointer',
  },
};

export function AutoModPage() {
  const { guildId } = useParams();
  const uiV2TokensEnabled = shouldEnableUiV2Tokens();
  const [rules, setRules] = useState<AutoModRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<AutoModRule | null>(null);

  useEffect(() => {
    async function fetchRules() {
      if (!guildId) return;
      try {
        const res = await fetch(`/api/v1/guilds/${guildId}/automod/rules`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to fetch rules');
        const data = await res.json();
        setRules(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchRules();
  }, [guildId]);

  const handleToggle = async (ruleId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/v1/guilds/${guildId}/automod/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to update rule');
      setRules(rules.map(r => r.id === ruleId ? { ...r, enabled } : r));
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      const res = await fetch(`/api/v1/guilds/${guildId}/automod/rules/${ruleId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete rule');
      setRules(rules.filter(r => r.id !== ruleId));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const getTriggerLabel = (type: string) => {
    switch (type) {
      case 'keyword': return 'Keywords';
      case 'spam': return 'Spam Detection';
      case 'mention_spam': return 'Mention Spam';
      case 'keyword_preset': return 'Keyword Preset';
      default: return type;
    }
  };

  const getActionLabel = (actions: AutoModRule['actions']) => {
    return actions.map(a => {
      switch (a.type) {
        case 'block': return 'Block Message';
        case 'alert': return 'Send Alert';
        case 'timeout': return `Timeout ${a.duration}m`;
        default: return a.type;
      }
    }).join(', ');
  };

  if (loading) {
    return (
      <div style={s.page}>
        <div style={s.loading}>
          <div style={s.spinner} />
          <p>Loading AutoMod rules...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>AutoMod</h1>
          <p style={s.subtitle}>Automated moderation rules for your server</p>
        </div>
        <button style={s.createBtn}>Create Rule</button>
      </div>

      {error && <div style={s.error}><p style={{ margin: 0 }}>{error}</p></div>}

      <div style={s.rules}>
        {rules.length === 0 ? (
          <div style={s.empty}>
            <h3 style={s.emptyTitle}>No AutoMod rules</h3>
            <p style={s.emptyText}>Create rules to automatically moderate your server</p>
            <button style={s.createBtn}>Create First Rule</button>
          </div>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} style={rule.enabled ? s.ruleCard : s.ruleCardDisabled}>
              <div style={s.ruleHeader}>
                <div style={s.toggleSwitch}>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => handleToggle(rule.id, e.target.checked)}
                    style={s.toggleInput}
                  />
                  <span
                    style={rule.enabled ? s.toggleSliderOn : s.toggleSliderOff}
                    onClick={() => handleToggle(rule.id, !rule.enabled)}
                  >
                    <span style={rule.enabled ? s.toggleKnobOn : s.toggleKnobOff} />
                  </span>
                </div>
                <div style={s.ruleInfo}>
                  <h3 style={s.ruleName}>{rule.name}</h3>
                  <span style={s.ruleTrigger}>{getTriggerLabel(rule.triggerType)}</span>
                </div>
                <div style={s.ruleActions}>
                  <button
                    style={s.editBtn}
                    onClick={() => setEditingRule(rule)}
                  >
                    Edit
                  </button>
                  <button
                    style={s.deleteBtn}
                    onClick={() => handleDelete(rule.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div style={s.ruleDetails}>
                <div style={s.detail}>
                  <span style={s.detailLabel}>Actions:</span>
                  <span style={s.detailValue}>{getActionLabel(rule.actions)}</span>
                </div>
                {rule.exemptChannels.length > 0 && (
                  <div style={s.detail}>
                    <span style={s.detailLabel}>Exempt channels:</span>
                    <span style={s.detailValue}>{rule.exemptChannels.length} channels</span>
                  </div>
                )}
                {rule.exemptRoles.length > 0 && (
                  <div style={s.detail}>
                    <span style={s.detailLabel}>Exempt roles:</span>
                    <span style={s.detailValue}>{rule.exemptRoles.length} roles</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={s.infoBox}>
        <h4 style={s.infoTitle}>Tips</h4>
        <ul style={s.infoList}>
          <li>Maximum 6 rules per trigger type per server</li>
          <li>Rules are evaluated in order - place most specific rules first</li>
          <li>Use keyword presets for profanity, sexual content, and slurs</li>
          <li>Exempt your mods and admins from rules to avoid false positives</li>
        </ul>
      </div>

      {editingRule && (
        <div style={s.modalOverlay} onClick={() => setEditingRule(null)}>
          <div style={s.modalDialog} onClick={(e) => e.stopPropagation()}>
            <button style={s.modalClose} onClick={() => setEditingRule(null)}>x</button>
            <h2 style={s.modalTitle}>Edit Rule: {editingRule.name}</h2>
            <div style={s.form}>
              <div style={s.formGroup}>
                <label style={s.formLabel}>Rule Name</label>
                <input type="text" defaultValue={editingRule.name} style={s.formInput} />
              </div>
              <div style={s.formGroup}>
                <label style={s.formLabel}>Trigger Type</label>
                <select defaultValue={editingRule.triggerType} style={s.formSelect}>
                  <option value="keyword">Keywords</option>
                  <option value="spam">Spam Detection</option>
                  <option value="mention_spam">Mention Spam</option>
                  <option value="keyword_preset">Keyword Preset</option>
                </select>
              </div>
              <div style={s.formGroup}>
                <label style={s.formLabel}>Actions</label>
                <div style={s.actionsSelect}>
                  <label style={s.checkboxLabel}><input type="checkbox" defaultChecked /> Block Message</label>
                  <label style={s.checkboxLabel}><input type="checkbox" defaultChecked /> Send Alert</label>
                  <label style={s.checkboxLabel}><input type="checkbox" /> Timeout</label>
                </div>
              </div>
              <div style={s.formActions}>
                <button style={s.saveBtn}>Save Changes</button>
                <button style={s.cancelBtn} onClick={() => setEditingRule(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
