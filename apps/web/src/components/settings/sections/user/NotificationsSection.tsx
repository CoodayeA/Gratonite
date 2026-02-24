import { useCallback, useEffect, useState } from 'react';
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
    <section className="settings-section">
      <h2 className="settings-shell-section-heading">Notifications</h2>
      <div className="settings-card">
        <h3 className="settings-subsection-title">Sound Alerts</h3>
        <div className="settings-field">
          <div className="settings-field-label">Enable sounds</div>
          <div className="settings-field-control">
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={soundPrefs.enabled}
                onChange={(event) =>
                  handleUpdateSoundPrefs((current) => ({ ...current, enabled: event.target.checked }))
                }
              />
              <span className="settings-toggle-indicator" />
            </label>
            <span className="settings-range-value">{soundPrefs.enabled ? 'On' : 'Off'}</span>
          </div>
        </div>
        <div className="settings-field">
          <div className="settings-field-label">Volume</div>
          <div className="settings-field-control settings-field-row">
            <input
              className="settings-range"
              type="range"
              min={0}
              max={100}
              step={1}
              value={soundPrefs.volume}
              onChange={(event) =>
                handleUpdateSoundPrefs((current) => ({ ...current, volume: Number(event.target.value) }))
              }
            />
            <span className="settings-range-value">{soundPrefs.volume}%</span>
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
          <div className="settings-field" key={key}>
            <div className="settings-field-label">{label}</div>
            <div className="settings-field-control settings-field-row settings-field-row-wrap">
              <label className="settings-toggle">
                <input
                  type="checkbox"
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
        <p className="settings-muted">
          Sound alerts apply in the web app. Per-device settings are stored locally in your browser.
        </p>
      </div>
      <div className="settings-card">
        <h3 className="settings-subsection-title">Voice Soundboard</h3>
        <div className="settings-field">
          <div className="settings-field-label">Hear soundboard clips</div>
          <div className="settings-field-control">
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={soundboardPrefs.enabled}
                onChange={(event) =>
                  handleUpdateSoundboardPrefs((current) => ({ ...current, enabled: event.target.checked }))
                }
              />
              <span className="settings-toggle-indicator" />
            </label>
            <span className="settings-range-value">{soundboardPrefs.enabled ? 'On' : 'Off'}</span>
          </div>
        </div>
        <div className="settings-field">
          <div className="settings-field-label">Soundboard volume</div>
          <div className="settings-field-control settings-field-row">
            <input
              className="settings-range"
              type="range"
              min={0}
              max={100}
              step={1}
              value={soundboardPrefs.volume}
              onChange={(event) =>
                handleUpdateSoundboardPrefs((current) => ({ ...current, volume: Number(event.target.value) }))
              }
            />
            <span className="settings-range-value">{soundboardPrefs.volume}%</span>
          </div>
        </div>
        <div className="settings-field">
          <div className="settings-field-label">Entrance sounds</div>
          <div className="settings-field-control">
            <label className="settings-toggle">
              <input
                type="checkbox"
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
            <span className="settings-range-value">
              {soundboardPrefs.entranceEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
        <p className="settings-muted">
          Choose entrance sounds from the Soundboard panel while connected to a server voice channel.
        </p>
      </div>
      <div className="settings-card">
        <h3 className="settings-subsection-title">Do Not Disturb Schedule</h3>
        {dndError && <div className="settings-error">{dndError}</div>}
        <div className="settings-field">
          <div className="settings-field-label">Do Not Disturb</div>
          <div className="settings-field-control">
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={dndEnabled}
                onChange={(event) => setDndEnabled(event.target.checked)}
              />
              <span className="settings-toggle-indicator" />
            </label>
          </div>
        </div>
        <div className="settings-field">
          <div className="settings-field-label">Schedule</div>
          <div className="settings-field-control settings-field-row">
            <Input
              type="time"
              value={dndStart}
              onChange={(event) => setDndStart(event.target.value)}
            />
            <span className="settings-field-separator">to</span>
            <Input
              type="time"
              value={dndEnd}
              onChange={(event) => setDndEnd(event.target.value)}
            />
          </div>
        </div>
        <div className="settings-field">
          <div className="settings-field-label">Timezone</div>
          <div className="settings-field-control">
            <Input
              type="text"
              value={dndTimezone}
              onChange={(event) => setDndTimezone(event.target.value)}
              placeholder="UTC"
            />
          </div>
        </div>
        <div className="settings-field">
          <div className="settings-field-label">Days</div>
          <div className="settings-field-control settings-days">
            {DAYS.map((day) => (
              <button
                key={day.label}
                className={`settings-day ${dndDays & (1 << day.bit) ? 'settings-day-active' : ''}`}
                onClick={() => toggleDay(day.bit)}
                type="button"
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-footer">
          <Button onClick={handleSaveDnd} loading={savingDnd}>
            Save Schedule
          </Button>
        </div>
      </div>
    </section>
  );
}
