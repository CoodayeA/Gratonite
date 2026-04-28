import React, { useState, useEffect } from 'react';
import { api, API_BASE, getAccessToken } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

type NotifLevel = 'all' | 'mentions' | 'nothing';

type Profile = { id: string; label: string; desc: string; level: NotifLevel; muted: boolean };
const PROFILES: Profile[] = [
    { id: 'all-alerts', label: 'All Alerts', desc: 'Mentions + DMs', level: 'all', muted: false },
    { id: 'focus-mode', label: 'Focus Mode', desc: 'DMs only', level: 'mentions', muted: false },
    { id: 'silent', label: 'Silent', desc: 'No notifications', level: 'nothing', muted: true },
];
interface MuteDuration { label: string; minutes: number | null; }
const MUTE_DURATIONS: MuteDuration[] = [
  { label: '15 minutes', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: '8 hours', minutes: 480 },
  { label: '24 hours', minutes: 1440 },
  { label: 'Until I turn it back on', minutes: null },
];

interface Props {
  type: 'guild' | 'channel';
  id: string;
  name: string;
  onClose: () => void;
}

export function NotificationPrefsModal({ type, id, name, onClose }: Props) {
  const { addToast } = useToast();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  const settingKey = `notif:${type}:${id}`;
  const [level, setLevel] = useState<NotifLevel>('all');
  const [muted, setMuted] = useState(false);
  const activePreset = PROFILES.find(p => p.level === level && p.muted === muted);
  const [muteDuration, setMuteDuration] = useState<number | null>(60);
  const [saving, setSaving] = useState(false);
  const [effectiveSummary, setEffectiveSummary] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const load = async () => {
      try {
        if (type === 'channel') {
          const pref = await api.channels.getNotificationPrefs(id);
          const explicitLevel = pref.level === 'none' ? 'nothing' : pref.level;
          const effectiveLevel = pref.effective?.effectiveLevel ?? 'all';
          setLevel((explicitLevel === 'default' ? effectiveLevel : explicitLevel) as NotifLevel);
          const activeMute = Boolean(
            pref.mutedUntil && new Date(pref.mutedUntil) > new Date(),
          ) || Boolean(pref.effective?.muted);
          setMuted(activeMute);
          setEffectiveSummary(pref.effective
            ? `Effective now: ${pref.effective.effectiveLevel === 'all' ? 'All messages' : pref.effective.effectiveLevel === 'mentions' ? 'Mentions and direct replies' : 'Nothing'} via ${pref.effective.sourceLabel}.`
            : null);
          return;
        }

        const data = await fetch(`${API_BASE}/users/@me/settings/notif?key=${encodeURIComponent(settingKey)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json());

        if (data.value) {
          setLevel(data.value.level || 'all');
          if (data.value.mutedUntil && new Date(data.value.mutedUntil) > new Date()) {
            setMuted(true);
          }
        }
        setEffectiveSummary(null);
      } catch {
        addToast({ title: 'Failed to load notification preferences', variant: 'error' });
      }
    };

    load();
  }, [addToast, id, settingKey, type]);

  async function save() {
    setSaving(true);
    const token = getAccessToken();
    const mutedUntil = muted
      ? (muteDuration ? new Date(Date.now() + muteDuration * 60000).toISOString() : '9999-12-31T00:00:00Z')
      : null;
    await fetch(`${API_BASE}/users/@me/settings/notif`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ key: settingKey, value: { level, mutedUntil } }),
    });
    // Also persist to channel_notification_prefs table for channel-level settings
    if (type === 'channel') {
      try {
        const apiLevel = level === 'nothing' ? 'none' : level === 'mentions' ? 'mentions' : level === 'all' ? 'all' : 'default';
        await api.channels.setNotificationPrefs(id, { level: apiLevel as any, mutedUntil });
      } catch { /* non-critical */ }
    }
    setSaving(false);
    onClose();
  }

  return (
    <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Notification preferences" className="modal-content notif-prefs-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Notification Settings</h3>
          <span className="modal-subtitle">{name}</span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="notif-section" style={{ marginBottom: '16px' }}>
            <div className="notif-section-title">Quick Profiles</div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              {PROFILES.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setLevel(p.level); setMuted(p.muted); }}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    borderRadius: '8px',
                    border: `2px solid ${activePreset?.id === p.id ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                    background: activePreset?.id === p.id ? 'rgba(82, 109, 245, 0.15)' : 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'center' as const,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{p.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{p.desc}</div>
                  {activePreset?.id === p.id && (
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '4px' }}>ACTIVE</div>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="notif-section">
            <div className="notif-section-title">Notifications</div>
            {effectiveSummary && (
              <div style={{ marginBottom: '10px', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.45 }}>
                {effectiveSummary}
              </div>
            )}
            {(['all', 'mentions', 'nothing'] as NotifLevel[]).map(l => (
              <label key={l} className="notif-radio">
                <input type="radio" name="level" value={l} checked={level === l} onChange={() => setLevel(l)} />
                <span>{l === 'all' ? 'All Messages' : l === 'mentions' ? 'Only @Mentions' : 'Nothing'}</span>
              </label>
            ))}
          </div>
          <div className="notif-section">
            <label className="notif-section-title">
              <input type="checkbox" checked={muted} onChange={e => setMuted(e.target.checked)} />
              <span> Mute {type === 'guild' ? 'Server' : 'Channel'}</span>
            </label>
            {muted && (
              <select value={muteDuration ?? ''} onChange={e => setMuteDuration(e.target.value ? Number(e.target.value) : null)} className="notif-duration-select">
                {MUTE_DURATIONS.map(d => <option key={d.label} value={d.minutes ?? ''}>{d.label}</option>)}
              </select>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
