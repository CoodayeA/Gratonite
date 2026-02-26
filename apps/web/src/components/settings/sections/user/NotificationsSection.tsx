import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import {
  DEFAULT_NOTIFICATION_SOUND_PREFS,
  readNotificationSoundPrefs,
  subscribeNotificationSoundPrefs,
  updateNotificationSoundPrefs,
  type NotificationSoundPrefs,
} from '@/lib/notificationSoundPrefs';
import { previewSoundDirect, stopSound, type SoundName } from '@/lib/audio';
import {
  DEFAULT_SOUNDBOARD_PREFS,
  readSoundboardPrefs,
  subscribeSoundboardPrefs,
  updateSoundboardPrefs,
  type SoundboardPrefs,
} from '@/lib/soundboardPrefs';

const DAYS = [
  { label: 'Sun', bit: 0 },
  { label: 'Mon', bit: 1 },
  { label: 'Tue', bit: 2 },
  { label: 'Wed', bit: 3 },
  { label: 'Thu', bit: 4 },
  { label: 'Fri', bit: 5 },
  { label: 'Sat', bit: 6 },
];

const styles = {
  section: {
    maxWidth: 720,
  } as React.CSSProperties,
  card: {
    background: 'var(--bg-float)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-lg)',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  } as React.CSSProperties,
  subsectionTitle: {
    margin: '0 0 12px',
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text)',
  } as React.CSSProperties,
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  } as React.CSSProperties,
  fieldLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--text-faint)',
  } as React.CSSProperties,
  fieldControl: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  } as React.CSSProperties,
  fieldRowWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  } as React.CSSProperties,
  toggle: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  } as React.CSSProperties,
  toggleInput: {
    display: 'none',
  } as React.CSSProperties,
  range: {
    flex: 1,
  } as React.CSSProperties,
  rangeValue: {
    fontSize: 12,
    color: 'var(--text-muted)',
    minWidth: 48,
  } as React.CSSProperties,
  muted: {
    color: 'var(--text-muted)',
    fontSize: 14,
  } as React.CSSProperties,
  fieldSeparator: {
    fontSize: 12,
    color: 'var(--text-faint)',
  } as React.CSSProperties,
  days: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  } as React.CSSProperties,
  day: {
    background: 'var(--bg-float)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-pill)',
    padding: '4px 10px',
    fontSize: 12,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'background 0.12s ease, color 0.12s ease, border-color 0.12s ease',
  } as React.CSSProperties,
  dayActive: {
    background: 'rgba(212, 175, 55, 0.18)',
    border: '1px solid rgba(212, 175, 55, 0.45)',
    borderRadius: 'var(--radius-pill)',
    padding: '4px 10px',
    fontSize: 12,
    color: 'var(--text)',
    cursor: 'pointer',
    transition: 'background 0.12s ease, color 0.12s ease, border-color 0.12s ease',
  } as React.CSSProperties,
  error: {
    padding: '10px 14px',
    background: 'var(--danger-bg)',
    border: '1px solid rgba(255, 107, 107, 0.25)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--danger)',
    fontSize: 13,
  } as React.CSSProperties,
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
  } as React.CSSProperties,
};

export function NotificationsSection() {
  const [soundPrefs, setSoundPrefs] = useState<NotificationSoundPrefs>(DEFAULT_NOTIFICATION_SOUND_PREFS);
  const [soundboardPrefs, setSoundboardPrefs] = useState<SoundboardPrefs>(DEFAULT_SOUNDBOARD_PREFS);
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndStart, setDndStart] = useState('22:00');
  const [dndEnd, setDndEnd] = useState('08:00');
  const [dndTimezone, setDndTimezone] = useState('UTC');
  const [dndDays, setDndDays] = useState(0b1111111);
  const [savingDnd, setSavingDnd] = useState(false);
  const [dndError, setDndError] = useState('');

  useEffect(() => {
    setSoundPrefs(readNotificationSoundPrefs());
    return subscribeNotificationSoundPrefs(setSoundPrefs);
  }, []);

  useEffect(() => {
    setSoundboardPrefs(readSoundboardPrefs());
    return subscribeSoundboardPrefs(setSoundboardPrefs);
  }, []);

  useEffect(() => {
    api.users
      .getDndSchedule()
      .then((schedule) => {
        setDndEnabled(schedule.enabled);
        setDndStart(schedule.startTime ?? '22:00');
        setDndEnd(schedule.endTime ?? '08:00');
        setDndTimezone(schedule.timezone ?? 'UTC');
        setDndDays(schedule.daysOfWeek ?? 0b1111111);
      })
      .catch(() => undefined);
  }, []);

  const handleUpdateSoundPrefs = useCallback(
    (updater: (current: NotificationSoundPrefs) => NotificationSoundPrefs) => {
      setSoundPrefs(updateNotificationSoundPrefs(updater));
    },
    [],
  );

  const handleUpdateSoundboardPrefs = useCallback(
    (updater: (current: SoundboardPrefs) => SoundboardPrefs) => {
      setSoundboardPrefs(updateSoundboardPrefs(updater));
    },
    [],
  );

  const previewSound = useCallback((name: SoundName) => {
    previewSoundDirect(name);
    if (name === 'ringtone' || name === 'outgoing-ring') {
      window.setTimeout(() => stopSound(name), 1200);
    }
  }, []);

  const toggleDay = useCallback((bit: number) => {
    setDndDays((prev) => prev ^ (1 << bit));
  }, []);

  async function handleSaveDnd() {
    setSavingDnd(true);
    setDndError('');
    try {
      await api.users.updateDndSchedule({
        enabled: dndEnabled,
        startTime: dndStart,
        endTime: dndEnd,
        timezone: dndTimezone,
        daysOfWeek: dndDays,
      });
    } catch (err) {
      setDndError(getErrorMessage(err));
    } finally {
      setSavingDnd(false);
    }
  }

  return (
    <section style={styles.section}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        paddingBottom: 16,
        borderBottom: '1px solid var(--stroke)',
        marginBottom: 8,
      }}>
        <h2 style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text)',
          margin: 0,
          fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
        }}>
          Notifications
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Configure sound alerts, soundboard preferences, and your Do Not Disturb schedule.
        </p>
      </div>
      <div style={styles.card}>
        <h3 style={styles.subsectionTitle}>Sound Alerts</h3>
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Enable sounds</div>
          <div style={styles.fieldControl}>
            <label style={styles.toggle}>
              <input
                type="checkbox"
                style={styles.toggleInput}
                checked={soundPrefs.enabled}
                onChange={(event) =>
                  handleUpdateSoundPrefs((current) => ({ ...current, enabled: event.target.checked }))
                }
              />
              <span className="settings-toggle-indicator" />
            </label>
            <span style={styles.rangeValue}>{soundPrefs.enabled ? 'On' : 'Off'}</span>
          </div>
        </div>
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Volume</div>
          <div style={styles.fieldRow}>
            <input
              style={styles.range}
              type="range"
              min={0}
              max={100}
              step={1}
              value={soundPrefs.volume}
              onChange={(event) =>
                handleUpdateSoundPrefs((current) => ({ ...current, volume: Number(event.target.value) }))
              }
            />
            <span style={styles.rangeValue}>{soundPrefs.volume}%</span>
          </div>
        </div>
        {(
          [
            ['message', 'Channel Messages', 'message'],
            ['dm', 'Direct Messages', 'dm'],
            ['mention', 'Mentions', 'mention'],
            ['ringtone', 'Incoming Call Ringtone', 'ringtone'],
            ['outgoing-ring', 'Outgoing Call Ring', 'outgoing-ring'],
            ['call-connect', 'Call Connect', 'call-connect'],
            ['call-end', 'Call End', 'call-end'],
          ] as Array<[SoundName, string, SoundName]>
        ).map(([key, label, previewName]) => (
          <div style={styles.field} key={key}>
            <div style={styles.fieldLabel}>{label}</div>
            <div style={styles.fieldRowWrap}>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  style={styles.toggleInput}
                  checked={soundPrefs.sounds[key]}
                  onChange={(event) =>
                    handleUpdateSoundPrefs((current) => ({
                      ...current,
                      sounds: { ...current.sounds, [key]: event.target.checked },
                    }))
                  }
                />
                <span className="settings-toggle-indicator" />
              </label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => previewSound(previewName)}
              >
                Preview
              </Button>
            </div>
          </div>
        ))}
        <p style={styles.muted}>
          Sound alerts apply in the web app. Per-device settings are stored locally in your browser.
        </p>
      </div>
      <div style={styles.card}>
        <h3 style={styles.subsectionTitle}>Voice Soundboard</h3>
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Hear soundboard clips</div>
          <div style={styles.fieldControl}>
            <label style={styles.toggle}>
              <input
                type="checkbox"
                style={styles.toggleInput}
                checked={soundboardPrefs.enabled}
                onChange={(event) =>
                  handleUpdateSoundboardPrefs((current) => ({ ...current, enabled: event.target.checked }))
                }
              />
              <span className="settings-toggle-indicator" />
            </label>
            <span style={styles.rangeValue}>{soundboardPrefs.enabled ? 'On' : 'Off'}</span>
          </div>
        </div>
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Soundboard volume</div>
          <div style={styles.fieldRow}>
            <input
              style={styles.range}
              type="range"
              min={0}
              max={100}
              step={1}
              value={soundboardPrefs.volume}
              onChange={(event) =>
                handleUpdateSoundboardPrefs((current) => ({ ...current, volume: Number(event.target.value) }))
              }
            />
            <span style={styles.rangeValue}>{soundboardPrefs.volume}%</span>
          </div>
        </div>
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Entrance sounds</div>
          <div style={styles.fieldControl}>
            <label style={styles.toggle}>
              <input
                type="checkbox"
                style={styles.toggleInput}
                checked={soundboardPrefs.entranceEnabled}
                onChange={(event) =>
                  handleUpdateSoundboardPrefs((current) => ({
                    ...current,
                    entranceEnabled: event.target.checked,
                  }))
                }
              />
              <span className="settings-toggle-indicator" />
            </label>
            <span style={styles.rangeValue}>
              {soundboardPrefs.entranceEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
        <p style={styles.muted}>
          Choose entrance sounds from the Soundboard panel while connected to a server voice channel.
        </p>
      </div>
      <div style={styles.card}>
        <h3 style={styles.subsectionTitle}>Do Not Disturb Schedule</h3>
        {dndError && <div style={styles.error}>{dndError}</div>}
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Do Not Disturb</div>
          <div style={styles.fieldControl}>
            <label style={styles.toggle}>
              <input
                type="checkbox"
                style={styles.toggleInput}
                checked={dndEnabled}
                onChange={(event) => setDndEnabled(event.target.checked)}
              />
              <span className="settings-toggle-indicator" />
            </label>
          </div>
        </div>
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Schedule</div>
          <div style={styles.fieldRow}>
            <Input
              type="time"
              value={dndStart}
              onChange={(event) => setDndStart(event.target.value)}
            />
            <span style={styles.fieldSeparator}>to</span>
            <Input
              type="time"
              value={dndEnd}
              onChange={(event) => setDndEnd(event.target.value)}
            />
          </div>
        </div>
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Timezone</div>
          <div style={styles.fieldControl}>
            <Input
              type="text"
              value={dndTimezone}
              onChange={(event) => setDndTimezone(event.target.value)}
              placeholder="UTC"
            />
          </div>
        </div>
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Days</div>
          <div style={styles.days}>
            {DAYS.map((day) => (
              <button
                key={day.label}
                style={dndDays & (1 << day.bit) ? styles.dayActive : styles.day}
                onClick={() => toggleDay(day.bit)}
                type="button"
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
        <div style={styles.footer}>
          <Button onClick={handleSaveDnd} loading={savingDnd}>
            Save Schedule
          </Button>
        </div>
      </div>
    </section>
  );
}
