import { useState, useCallback, useRef } from 'react';
import { Check, Volume2, VolumeX } from 'lucide-react';
import { isSoundMuted, setSoundMuted, getSoundVolume, setSoundVolume, getSoundPack, setSoundPack, playSound } from '../../../utils/SoundManager';
import { api } from '../../../lib/api';
import type { SettingsTabProps } from './types';

interface Props extends SettingsTabProps {}

const SettingsSoundTab = ({ addToast }: Props) => {
  const [soundMutedState, setSoundMutedState] = useState(isSoundMuted());
  const [soundVolume, setSoundVolumeState] = useState(getSoundVolume());
  const [soundPack, setSoundPackState] = useState(getSoundPack());
  const [noiseSuppressionEnabled, setNoiseSuppressionEnabledState] = useState(
    () => localStorage.getItem('noiseSuppression') === 'true',
  );
  const [ambientMode, setAmbientMode] = useState<string>(
    () => localStorage.getItem('gratonite_ambient_mode') ?? 'off'
  );
  const [ambientVolume, setAmbientVolume] = useState<number>(
    () => parseFloat(localStorage.getItem('gratonite_ambient_volume') ?? '0.5')
  );
  const [notificationVolume, setNotificationVolume] = useState<number>(
    () => {
      const raw = parseFloat(localStorage.getItem('gratonite_notification_volume') ?? '0.7');
      return raw > 1 ? raw / 100 : raw;
    }
  );
  const [emailMentions, setEmailMentions] = useState(false);
  const [emailDms, setEmailDms] = useState(false);
  const [emailFrequency, setEmailFrequency] = useState<'instant' | 'daily' | 'never'>('never');

  // Debounced settings save
  const settingsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSettingsToApi = useCallback((data: Record<string, unknown>) => {
    if (settingsSaveTimerRef.current) clearTimeout(settingsSaveTimerRef.current);
    settingsSaveTimerRef.current = setTimeout(() => {
      api.users.updateSettings(data).catch(() => {});
    }, 500);
  }, []);

  // Load email notification settings
  useState(() => {
    api.users.getSettings().then((settings: Record<string, unknown>) => {
      const emailNotifs = settings?.emailNotifications as Record<string, unknown> | undefined;
      if (emailNotifs) {
        setEmailMentions((emailNotifs.mentions as boolean) ?? false);
        setEmailDms((emailNotifs.dms as boolean) ?? false);
        setEmailFrequency((emailNotifs.frequency as 'instant' | 'daily' | 'never') ?? 'never');
      }
    }).catch(() => {});
  });

  return (
    <>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Sound</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Configure UI sounds, notifications, and ambient audio.</p>

      <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Volume Controls</h3>
      <div style={{ background: 'var(--bg-tertiary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--stroke)', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Mute All Sounds</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Silence all UI sounds and notifications.</div>
          </div>
          <div
            onClick={() => { const next = !soundMutedState; setSoundMutedState(next); setSoundMuted(next); }}
            style={{ width: '40px', height: '24px', background: soundMutedState ? 'var(--bg-elevated)' : 'var(--success)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.2s', flexShrink: 0, border: soundMutedState ? '1px solid var(--stroke)' : 'none' }}
          >
            <div style={{ position: 'absolute', height: '16px', width: '16px', left: soundMutedState ? '20px' : '4px', bottom: '4px', backgroundColor: 'white', transition: '.4s', borderRadius: '50%' }}></div>
          </div>
        </div>

        {/* Ambient Volume */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Ambient Volume</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>Controls background ambient sounds (lo-fi, nature, space).</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <VolumeX size={16} color="var(--text-muted)" />
            <input type="range" min="0" max="1" step="0.05" value={ambientVolume} onChange={(e) => {
              const v = parseFloat(e.target.value);
              setAmbientVolume(v);
              localStorage.setItem('gratonite_ambient_volume', String(v));
              window.dispatchEvent(new StorageEvent('storage', { key: 'gratonite_ambient_volume', newValue: String(v) }));
            }} style={{ flex: 1, accentColor: '#8b5cf6', height: '4px', cursor: 'pointer' }} disabled={soundMutedState} />
            <Volume2 size={16} color="var(--text-muted)" />
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', minWidth: '32px', textAlign: 'right' }}>{Math.round(ambientVolume * 100)}%</span>
          </div>
        </div>

        {/* Notification Volume */}
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Notification Volume</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>Controls message, mention, and join/leave sounds.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <VolumeX size={16} color="var(--text-muted)" />
            <input type="range" min="0" max="1" step="0.05" value={notificationVolume} onChange={(e) => {
              const v = parseFloat(e.target.value);
              setNotificationVolume(v);
              localStorage.setItem('gratonite_notification_volume', String(v));
              window.dispatchEvent(new StorageEvent('storage', { key: 'gratonite_notification_volume', newValue: String(v) }));
              setSoundVolumeState(v); setSoundVolume(v);
              saveSettingsToApi({ soundVolume: Math.round(v * 100) });
            }} style={{ flex: 1, accentColor: 'var(--accent-primary)', height: '4px', cursor: 'pointer' }} disabled={soundMutedState} />
            <Volume2 size={16} color="var(--text-muted)" />
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', minWidth: '32px', textAlign: 'right' }}>{Math.round(notificationVolume * 100)}%</span>
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Sound Pack</h3>
      <div className="grid-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '32px' }}>
        {[
          { id: 'default', label: 'Default', desc: 'Clean modern tones', icon: '🎵' },
          { id: 'soft', label: 'Soft', desc: 'Gentle, quiet sounds', icon: '🌿' },
          { id: 'retro', label: 'Retro', desc: '8-bit chiptune vibes', icon: '👾' },
        ].map(pack => {
          const isSelected = soundPack === pack.id;
          return (
            <div key={pack.id} onClick={() => { setSoundPackState(pack.id); setSoundPack(pack.id); if (!soundMutedState) playSound('notification'); }} style={{ background: isSelected ? 'rgba(82, 109, 245, 0.1)' : 'var(--bg-tertiary)', border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--stroke)'}`, borderRadius: '12px', padding: '20px 16px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', position: 'relative' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>{pack.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px', color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{pack.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{pack.desc}</div>
              {isSelected && <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--accent-primary)', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={11} color="#000" /></div>}
            </div>
          );
        })}
      </div>

      <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Ambient Sound</h3>
      <div className="grid-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
        {[
          { id: 'off', label: 'Off', desc: 'No ambient audio', color: 'var(--text-muted)' },
          { id: 'lofi', label: 'Lo-fi', desc: 'Warm chord pad', color: '#8b5cf6' },
          { id: 'nature', label: 'Nature', desc: 'Wind & birdsong', color: '#10b981' },
          { id: 'space', label: 'Space', desc: 'Deep space drone', color: '#526df5' },
        ].map(amb => {
          const isSelected = ambientMode === amb.id;
          return (
            <div key={amb.id} onClick={() => { setAmbientMode(amb.id); localStorage.setItem('gratonite_ambient_mode', amb.id); window.dispatchEvent(new CustomEvent('ambient-mode-change', { detail: amb.id })); }} style={{ background: isSelected ? `${amb.color}15` : 'var(--bg-tertiary)', border: `2px solid ${isSelected ? amb.color : 'var(--stroke)'}`, borderRadius: '12px', padding: '16px 10px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', position: 'relative' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isSelected ? `${amb.color}25` : 'var(--bg-elevated)', border: `1.5px solid ${isSelected ? amb.color : 'var(--stroke)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', color: amb.color, fontSize: '14px' }}>
                {amb.id === 'off' ? '\u2715' : amb.id === 'lofi' ? '\u266A' : amb.id === 'nature' ? '\uD83C\uDF43' : '\u2726'}
              </div>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '2px', color: isSelected ? amb.color : 'var(--text-primary)' }}>{amb.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{amb.desc}</div>
              {isSelected && amb.id !== 'off' && <div style={{ position: 'absolute', top: 6, right: 6, background: amb.color, borderRadius: '50%', width: '8px', height: '8px', boxShadow: `0 0 8px ${amb.color}80` }}></div>}
            </div>
          );
        })}
      </div>

      <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Sound Events</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[
          { label: 'Message Sent', desc: 'Play a sound when you send a message', key: 'messageSend' },
          { label: 'Notification', desc: 'Play a sound when you receive a notification', key: 'notification' },
          { label: 'Mention', desc: 'Alert sound when someone mentions you', key: 'mention' },
          { label: 'User Join/Leave', desc: 'Sounds for users entering or leaving voice channels', key: 'join' },
        ].map(ev => (
          <div key={ev.key} style={{ background: 'var(--bg-tertiary)', padding: '14px 16px', borderRadius: '8px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{ev.label}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{ev.desc}</div>
            </div>
            <button onClick={() => { if (!soundMutedState) playSound(ev.key as any); }} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', padding: '6px 12px', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
              Preview \u25B6
            </button>
          </div>
        ))}
      </div>

      <div style={{ height: '1px', background: 'var(--stroke)', margin: '32px 0' }} />

      <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Voice Processing</h3>
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--stroke)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Noise Suppression</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>Filters background noise from your microphone using Web Audio processing.</div>
          </div>
          <div
            onClick={() => { const next = !noiseSuppressionEnabled; setNoiseSuppressionEnabledState(next); try { localStorage.setItem('noiseSuppression', String(next)); } catch {} }}
            style={{ width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer', flexShrink: 0, background: noiseSuppressionEnabled ? 'var(--accent-primary)' : 'var(--bg-elevated)', border: `1px solid ${noiseSuppressionEnabled ? 'transparent' : 'var(--stroke)'}`, position: 'relative', transition: 'background 0.2s ease' }}
          >
            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: noiseSuppressionEnabled ? '22px' : '2px', transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
          </div>
        </div>
      </div>

      {/* Email Notifications */}
      <div style={{ height: '1px', background: 'var(--stroke)', margin: '24px 0' }} />
      <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Email Notifications</h3>
      <div style={{ background: 'var(--bg-tertiary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={emailMentions} onChange={e => {
            setEmailMentions(e.target.checked);
            api.users.updateSettings({ emailNotifications: { mentions: e.target.checked, dms: emailDms, frequency: emailFrequency } }).catch(() => {});
          }} style={{ accentColor: 'var(--accent-primary)' }} />
          Email when mentioned while offline
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={emailDms} onChange={e => {
            setEmailDms(e.target.checked);
            api.users.updateSettings({ emailNotifications: { mentions: emailMentions, dms: e.target.checked, frequency: emailFrequency } }).catch(() => {});
          }} style={{ accentColor: 'var(--accent-primary)' }} />
          Email for DMs while offline
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
          <span>Frequency:</span>
          <select value={emailFrequency} onChange={e => {
            const val = e.target.value as 'instant' | 'daily' | 'never';
            setEmailFrequency(val);
            api.users.updateSettings({ emailNotifications: { mentions: emailMentions, dms: emailDms, frequency: val } }).catch(() => {});
          }} style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}>
            <option value="instant">Instant</option>
            <option value="daily">Daily Digest</option>
            <option value="never">Never</option>
          </select>
        </div>
      </div>
    </>
  );
};

export default SettingsSoundTab;
