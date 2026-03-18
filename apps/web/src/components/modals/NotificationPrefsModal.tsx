import React, { useState, useEffect } from 'react';
import { api, API_BASE } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

type NotifLevel = 'all' | 'mentions' | 'nothing';
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
  const [muteDuration, setMuteDuration] = useState<number | null>(60);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('gratonite_access_token');
    if (!token) return;
    fetch(`${API_BASE}/users/@me/settings/notif?key=${encodeURIComponent(settingKey)}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(data => {
      if (data.value) {
        setLevel(data.value.level || 'all');
        if (data.value.mutedUntil && new Date(data.value.mutedUntil) > new Date()) {
          setMuted(true);
        }
      }
    }).catch(() => { addToast({ title: 'Failed to load notification preferences', variant: 'error' }); });
  }, [settingKey]);

  async function save() {
    setSaving(true);
    const token = localStorage.getItem('gratonite_access_token');
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
      <div role="dialog" aria-modal="true" className="modal-content notif-prefs-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Notification Settings</h3>
          <span className="modal-subtitle">{name}</span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="notif-section">
            <label className="notif-section-title">Notifications</label>
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
