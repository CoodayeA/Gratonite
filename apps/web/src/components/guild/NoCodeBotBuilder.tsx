/**
 * NoCodeBotBuilder — Item 100: Visual auto-response, welcome message, role reaction builder
 * No-code tool for server admins to create simple bot behaviors.
 */
import { useState } from 'react';
import { Plus, Trash2, Save, Zap, MessageSquare, UserPlus, Shield } from 'lucide-react';

interface AutoResponse {
  id: string;
  trigger: string;
  triggerType: 'exact' | 'contains' | 'regex';
  response: string;
  channelId?: string;
  enabled: boolean;
}

interface WelcomeConfig {
  enabled: boolean;
  message: string;
  channelId?: string;
  assignRoles: string[];
}

interface Props {
  guildId: string;
  channels: Array<{ id: string; name: string }>;
  roles: Array<{ id: string; name: string }>;
  onSave: (config: { autoResponses: AutoResponse[]; welcome: WelcomeConfig }) => void;
}

export const NoCodeBotBuilder = ({ guildId, channels, roles, onSave }: Props) => {
  const [tab, setTab] = useState<'responses' | 'welcome' | 'reactions'>('responses');
  const [responses, setResponses] = useState<AutoResponse[]>([]);
  const [welcome, setWelcome] = useState<WelcomeConfig>({ enabled: false, message: 'Welcome to the server, {user}!', assignRoles: [] });

  const addResponse = () => {
    setResponses(prev => [...prev, {
      id: crypto.randomUUID(),
      trigger: '',
      triggerType: 'contains',
      response: '',
      enabled: true,
    }]);
  };

  const updateResponse = (id: string, updates: Partial<AutoResponse>) => {
    setResponses(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const removeResponse = (id: string) => {
    setResponses(prev => prev.filter(r => r.id !== id));
  };

  const inputStyle = {
    padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-primary)',
    border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px',
    width: '100%', boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        {[
          { key: 'responses' as const, icon: <MessageSquare size={14} />, label: 'Auto-Responses' },
          { key: 'welcome' as const, icon: <UserPlus size={14} />, label: 'Welcome' },
          { key: 'reactions' as const, icon: <Shield size={14} />, label: 'Role Reactions' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
            borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600,
            background: tab === t.key ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
            color: tab === t.key ? '#000' : 'var(--text-secondary)', cursor: 'pointer',
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {tab === 'responses' && (
        <div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Set up automatic replies when messages match triggers. No coding required.
          </p>

          {responses.map(r => (
            <div key={r.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <select value={r.triggerType} onChange={e => updateResponse(r.id, { triggerType: e.target.value as any })}
                  style={{ ...inputStyle, width: '120px' }}>
                  <option value="contains">Contains</option>
                  <option value="exact">Exact</option>
                  <option value="regex">Regex</option>
                </select>
                <input type="text" value={r.trigger} onChange={e => updateResponse(r.id, { trigger: e.target.value })}
                  placeholder="Trigger text..." style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => removeResponse(r.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                  <Trash2 size={16} />
                </button>
              </div>
              <textarea value={r.response} onChange={e => updateResponse(r.id, { response: e.target.value })}
                placeholder="Response message... (use {user} for username)" rows={2}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
          ))}

          <button onClick={addResponse} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px',
            borderRadius: '8px', border: '1px dashed var(--stroke)', background: 'transparent',
            color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', width: '100%',
            justifyContent: 'center',
          }}><Plus size={14} /> Add Auto-Response</button>
        </div>
      )}

      {tab === 'welcome' && (
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', cursor: 'pointer' }}>
            <input type="checkbox" checked={welcome.enabled} onChange={e => setWelcome({ ...welcome, enabled: e.target.checked })}
              style={{ accentColor: 'var(--accent-primary)' }} />
            <span style={{ fontWeight: 600 }}>Enable Welcome Messages</span>
          </label>

          <div style={{ opacity: welcome.enabled ? 1 : 0.5 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Welcome Message
            </label>
            <textarea value={welcome.message} onChange={e => setWelcome({ ...welcome, message: e.target.value })}
              placeholder="Welcome {user} to {server}!" rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', marginBottom: '12px' }} />

            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Welcome Channel
            </label>
            <select value={welcome.channelId || ''} onChange={e => setWelcome({ ...welcome, channelId: e.target.value || undefined })}
              style={{ ...inputStyle, marginBottom: '12px' }}>
              <option value="">Select channel...</option>
              {channels.map(ch => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
            </select>

            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Auto-Assign Roles
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {roles.map(role => (
                <button key={role.id} onClick={() => {
                  setWelcome(w => ({
                    ...w,
                    assignRoles: w.assignRoles.includes(role.id) ? w.assignRoles.filter(id => id !== role.id) : [...w.assignRoles, role.id],
                  }));
                }} style={{
                  padding: '4px 10px', borderRadius: '999px', fontSize: '12px', cursor: 'pointer',
                  background: welcome.assignRoles.includes(role.id) ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: welcome.assignRoles.includes(role.id) ? '#000' : 'var(--text-secondary)',
                  border: '1px solid var(--stroke)',
                }}>{role.name}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'reactions' && (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <Zap size={32} style={{ opacity: 0.5, marginBottom: '8px' }} />
          <p style={{ fontSize: '14px' }}>Role reactions are configured via the Reaction Roles tab.</p>
          <p style={{ fontSize: '12px', marginTop: '4px' }}>Go to Server Settings &gt; Reaction Roles to set up role assignment on reactions.</p>
        </div>
      )}

      <button onClick={() => onSave({ autoResponses: responses, welcome })} style={{
        padding: '10px 24px', borderRadius: '8px', background: 'var(--accent-primary)',
        border: 'none', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: '14px',
        display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start',
      }}><Save size={14} /> Save Configuration</button>
    </div>
  );
};

export default NoCodeBotBuilder;
