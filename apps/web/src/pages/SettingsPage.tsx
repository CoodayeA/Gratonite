import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useMessagesStore } from '@/stores/messages.store';
import { useMembersStore } from '@/stores/members.store';
import { useUnreadStore } from '@/stores/unread.store';
import { api, setAccessToken } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

type SettingsSection = 'account' | 'appearance' | 'notifications' | 'logout';

const DAYS = [
  { label: 'Sun', bit: 0 },
  { label: 'Mon', bit: 1 },
  { label: 'Tue', bit: 2 },
  { label: 'Wed', bit: 3 },
  { label: 'Thu', bit: 4 },
  { label: 'Fri', bit: 5 },
  { label: 'Sat', bit: 6 },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const openModal = useUiStore((s) => s.openModal);

  const [section, setSection] = useState<SettingsSection>('account');
  const [profile, setProfile] = useState<{ displayName: string; avatarHash: string | null; bannerHash: string | null } | null>(null);
  const [fontScale, setFontScale] = useState(1);
  const [messageDisplay, setMessageDisplay] = useState('cozy');
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndStart, setDndStart] = useState('22:00');
  const [dndEnd, setDndEnd] = useState('08:00');
  const [dndTimezone, setDndTimezone] = useState('UTC');
  const [dndDays, setDndDays] = useState(0b1111111);
  const [savingDnd, setSavingDnd] = useState(false);
  const [dndError, setDndError] = useState('');

  const bannerStyle = useMemo(() => {
    if (!profile?.bannerHash) return undefined;
    return { backgroundImage: `url(/api/v1/files/${profile.bannerHash})` };
  }, [profile?.bannerHash]);

  useEffect(() => {
    api.users.getMe()
      .then((me) => {
        setProfile({
          displayName: me.profile.displayName,
          avatarHash: me.profile.avatarHash,
          bannerHash: me.profile.bannerHash,
        });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    api.users.getDndSchedule()
      .then((schedule) => {
        setDndEnabled(schedule.enabled);
        setDndStart(schedule.startTime ?? '22:00');
        setDndEnd(schedule.endTime ?? '08:00');
        setDndTimezone(schedule.timezone ?? 'UTC');
        setDndDays(schedule.daysOfWeek ?? 0b1111111);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      api.users.updateSettings({ fontScale, messageDisplay, theme: 'dark' }).catch(() => undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [fontScale, messageDisplay]);

  const toggleDay = useCallback((bit: number) => {
    setDndDays((prev) => prev ^ (1 << bit));
  }, []);

  const handleClose = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

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

  async function handleLogout() {
    try {
      await api.auth.logout();
    } catch {
      // Best-effort
    }
    setAccessToken(null);
    logout();
    useGuildsStore.getState().clear();
    useChannelsStore.getState().clear();
    useMessagesStore.getState().clear();
    useMembersStore.getState().clear();
    useUnreadStore.getState().clear();
    queryClient.clear();
    navigate('/login', { replace: true });
  }

  if (!user) return null;

  return (
    <div className="settings-page">
      <aside className="settings-sidebar">
        <div className="settings-sidebar-title">User Settings</div>
        <nav className="settings-nav">
          <button
            className={`settings-nav-item ${section === 'account' ? 'settings-nav-item-active' : ''}`}
            onClick={() => setSection('account')}
          >
            My Account
          </button>
          <button
            className={`settings-nav-item ${section === 'appearance' ? 'settings-nav-item-active' : ''}`}
            onClick={() => setSection('appearance')}
          >
            Appearance
          </button>
          <button
            className={`settings-nav-item ${section === 'notifications' ? 'settings-nav-item-active' : ''}`}
            onClick={() => setSection('notifications')}
          >
            Notifications
          </button>
          <button
            className={`settings-nav-item ${section === 'logout' ? 'settings-nav-item-active' : ''}`}
            onClick={() => setSection('logout')}
          >
            Log Out
          </button>
        </nav>
      </aside>
      <div className="settings-content">
        <button className="settings-close" onClick={handleClose} aria-label="Close">
          &times;
        </button>

        {section === 'account' && (
          <section className="settings-section">
            <h2 className="settings-section-title">My Account</h2>
            <div className="settings-profile-card">
              <div className="settings-profile-banner" style={bannerStyle} />
              <div className="settings-profile-body">
                <Avatar
                  name={profile?.displayName ?? user.displayName}
                  hash={profile?.avatarHash ?? user.avatarHash}
                  userId={user.id}
                  size={64}
                  className="settings-profile-avatar"
                />
                <div className="settings-profile-info">
                  <div className="settings-profile-name">{profile?.displayName ?? user.displayName}</div>
                  <div className="settings-profile-username">@{user.username}</div>
                </div>
                <Button variant="ghost" onClick={() => openModal('edit-profile')}>Edit Profile</Button>
              </div>
            </div>

            <div className="settings-field-grid">
              <div className="settings-field">
                <div className="settings-field-label">Email</div>
                <div className="settings-field-value">{user.email}</div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Display Name</div>
                <div className="settings-field-value">{profile?.displayName ?? user.displayName}</div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">User ID</div>
                <div className="settings-field-value">{user.id}</div>
              </div>
            </div>
          </section>
        )}

        {section === 'appearance' && (
          <section className="settings-section">
            <h2 className="settings-section-title">Appearance</h2>
            <div className="settings-card">
              <div className="settings-field">
                <div className="settings-field-label">Theme</div>
                <div className="settings-field-value">Dark (default)</div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Message Density</div>
                <div className="settings-field-control">
                  <select
                    className="settings-select"
                    value={messageDisplay}
                    onChange={(event) => setMessageDisplay(event.target.value)}
                  >
                    <option value="cozy">Cozy</option>
                    <option value="compact">Compact</option>
                  </select>
                </div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Font Scale</div>
                <div className="settings-field-control">
                  <input
                    className="settings-range"
                    type="range"
                    min="0.8"
                    max="1.4"
                    step="0.05"
                    value={fontScale}
                    onChange={(event) => setFontScale(Number(event.target.value))}
                  />
                  <span className="settings-range-value">{fontScale.toFixed(2)}x</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {section === 'notifications' && (
          <section className="settings-section">
            <h2 className="settings-section-title">Notifications</h2>
            <div className="settings-card">
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
                <Button onClick={handleSaveDnd} loading={savingDnd}>Save Schedule</Button>
              </div>
            </div>
          </section>
        )}

        {section === 'logout' && (
          <section className="settings-section">
            <h2 className="settings-section-title">Log Out</h2>
            <div className="settings-card">
              <p className="settings-muted">You will be signed out of this device.</p>
              <Button variant="danger" onClick={handleLogout}>Log Out</Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
