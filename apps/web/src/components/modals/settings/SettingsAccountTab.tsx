import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useUser } from '../../../contexts/UserContext';
import { api, API_BASE } from '../../../lib/api';
import type { SettingsTabProps, UserProfileLike } from './types';

interface Props extends SettingsTabProps {
  userProfile?: UserProfileLike;
  setUserProfile?: (fn: (prev: UserProfileLike) => UserProfileLike) => void;
  onNavigateToProfile: () => void;
  onNavigateToSecurity: () => void;
}

const SettingsAccountTab = ({ addToast, userProfile, setUserProfile, onNavigateToProfile, onNavigateToSecurity }: Props) => {
  const { user: ctxUser, updateUser } = useUser();

  const [editingField, setEditingField] = useState<'displayName' | 'username' | 'email' | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [tempEditValue, setTempEditValue] = useState('');

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  useEffect(() => {
    if (ctxUser.id) {
      setEditDisplayName(prev => prev || ctxUser.name);
      setEditUsername(prev => prev || ctxUser.handle);
      setEditEmail(prev => prev || ctxUser.email);
    }
  }, [ctxUser.id, ctxUser.name, ctxUser.handle, ctxUser.email]);

  const persistedAvatarUrl = ctxUser.avatarHash ? `${API_BASE}/files/${ctxUser.avatarHash}` : null;
  const avatarStyle = persistedAvatarUrl ? `url(${persistedAvatarUrl})` : (userProfile?.avatarStyle || 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))');

  return (
    <>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px' }}>My Account</h2>

      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', padding: '24px', border: '1px solid var(--stroke)', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: avatarStyle, backgroundSize: 'cover', backgroundPosition: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold'
          }}>
            {avatarStyle.includes('gradient') ? (editDisplayName?.[0]?.toUpperCase() || '?') : ''}
          </div>
          <button onClick={onNavigateToProfile} className="settings-ghost-btn">Edit User Profile</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Display Name */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>DISPLAY NAME</div>
                {editingField !== 'displayName' && <div style={{ fontSize: '15px' }}>{editDisplayName}</div>}
              </div>
              {editingField !== 'displayName' && (
                <button onClick={() => { setEditingField('displayName'); setTempEditValue(editDisplayName); }} className="settings-ghost-btn">Edit</button>
              )}
            </div>
            {editingField === 'displayName' && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input aria-label="Display name" type="text" value={tempEditValue} onChange={e => setTempEditValue(e.target.value)} autoFocus style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                <button onClick={() => { api.users.updateAccountBasics({ displayName: tempEditValue }).then(() => { setEditDisplayName(tempEditValue); updateUser({ name: tempEditValue }); if (setUserProfile) setUserProfile((prev: UserProfileLike) => ({ ...prev, name: tempEditValue })); setEditingField(null); addToast({ title: 'Display name updated', variant: 'success' }); }).catch(() => addToast({ title: 'Failed to update display name. Try again.', variant: 'error' })); }} className="settings-primary-btn">Save</button>
                <button onClick={() => setEditingField(null)} className="settings-ghost-btn">Cancel</button>
              </div>
            )}
          </div>

          {/* Username */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>USERNAME</div>
                {editingField !== 'username' && <div style={{ fontSize: '15px' }}>{editUsername}</div>}
              </div>
              {editingField !== 'username' && (
                <button onClick={() => { setEditingField('username'); setTempEditValue(editUsername); }} className="settings-ghost-btn">Edit</button>
              )}
            </div>
            {editingField === 'username' && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input aria-label="Username" type="text" value={tempEditValue} onChange={e => setTempEditValue(e.target.value)} autoFocus style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                <button onClick={() => { api.users.updateAccountBasics({ username: tempEditValue }).then(() => { setEditUsername(tempEditValue); updateUser({ handle: tempEditValue }); setEditingField(null); addToast({ title: 'Username updated', variant: 'success' }); }).catch((e: unknown) => addToast({ title: 'Failed to update username. Try again.', description: (e as Record<string, string>)?.message || undefined, variant: 'error' })); }} className="settings-primary-btn">Save</button>
                <button onClick={() => setEditingField(null)} className="settings-ghost-btn">Cancel</button>
              </div>
            )}
          </div>

          {/* Email */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>EMAIL</div>
                {editingField !== 'email' && <div style={{ fontSize: '15px' }}>{editEmail}</div>}
              </div>
              {editingField !== 'email' && (
                <button onClick={() => { setEditingField('email'); setTempEditValue(editEmail); }} className="settings-ghost-btn">Edit</button>
              )}
            </div>
            {editingField === 'email' && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input aria-label="Email" type="email" value={tempEditValue} onChange={e => setTempEditValue(e.target.value)} autoFocus style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                <button onClick={() => { api.users.updateAccountBasics({ email: tempEditValue }).then(() => { setEditEmail(tempEditValue); updateUser({ email: tempEditValue.toLowerCase(), emailVerified: false }); setEditingField(null); addToast({ title: 'Email updated', description: 'Please re-verify this address if required.', variant: 'success' }); }).catch((e: unknown) => addToast({ title: 'Failed to update email. Try again.', description: (e as Record<string, string>)?.message || undefined, variant: 'error' })); }} className="settings-primary-btn">Save</button>
                <button onClick={() => setEditingField(null)} className="settings-ghost-btn">Cancel</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Password & Authentication</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '48px', alignItems: 'flex-start' }}>
        {!showPasswordForm ? (
          <button onClick={() => setShowPasswordForm(true)} className="settings-primary-btn">Change Password</button>
        ) : (
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '20px', border: '1px solid var(--stroke)' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Change Password</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label htmlFor="settings-current-password" style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>CURRENT PASSWORD</label>
                <div style={{ position: 'relative' }}>
                  <input id="settings-current-password" type={showCurrentPw ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" style={{ width: '100%', padding: '8px 36px 8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  <button aria-label={showCurrentPw ? 'Hide current password' : 'Show current password'} onClick={() => setShowCurrentPw(!showCurrentPw)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>{showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              <div>
                <label htmlFor="settings-new-password" style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>NEW PASSWORD</label>
                <div style={{ position: 'relative' }}>
                  <input id="settings-new-password" type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" style={{ width: '100%', padding: '8px 36px 8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  <button aria-label={showNewPw ? 'Hide new password' : 'Show new password'} onClick={() => setShowNewPw(!showNewPw)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>{showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              <div>
                <label htmlFor="settings-confirm-password" style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>CONFIRM NEW PASSWORD</label>
                <input id="settings-confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" aria-invalid={!!(confirmPassword && confirmPassword !== newPassword)} aria-describedby={confirmPassword && confirmPassword !== newPassword ? 'settings-confirm-password-error' : undefined} style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-primary)', border: `1px solid ${confirmPassword && confirmPassword !== newPassword ? 'var(--error)' : 'var(--stroke)'}`, borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                {confirmPassword && confirmPassword !== newPassword && <div id="settings-confirm-password-error" role="alert" style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px' }}>Passwords do not match</div>}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  onClick={() => {
                    if (currentPassword && newPassword && newPassword === confirmPassword) {
                      api.users.changePassword(currentPassword, newPassword).then(() => {
                        setShowPasswordForm(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
                        addToast({ title: 'Password changed', variant: 'success' });
                      }).catch((e: unknown) => addToast({ title: 'Failed to change password. Try again.', description: (e as Record<string, string>)?.message || undefined, variant: 'error' }));
                    }
                  }}
                  disabled={!currentPassword || !newPassword || newPassword !== confirmPassword}
                  style={{ background: currentPassword && newPassword && newPassword === confirmPassword ? 'var(--accent-primary)' : 'var(--bg-elevated)', border: 'none', padding: '8px 20px', borderRadius: 'var(--radius-sm)', color: currentPassword && newPassword && newPassword === confirmPassword ? '#000' : 'var(--text-muted)', cursor: currentPassword && newPassword && newPassword === confirmPassword ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '13px' }}
                >Save</button>
                <button onClick={() => { setShowPasswordForm(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', padding: '8px 20px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        <button className="settings-ghost-btn" onClick={onNavigateToSecurity}>Enable Two-Factor Auth</button>
      </div>

      <div style={{ paddingLeft: '16px', borderLeft: '4px solid var(--error)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--error)', marginBottom: '8px' }}>Danger Zone</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Permanently delete your account and all data.</p>
        {!showDeleteConfirm ? (
          <button onClick={() => setShowDeleteConfirm(true)} className="settings-danger-btn">Delete Account</button>
        ) : (
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--error)', borderRadius: 'var(--radius-md)', padding: '20px', marginTop: '8px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--error)', marginBottom: '8px' }}>Are you absolutely sure?</div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>This action cannot be undone. This will permanently delete your account, messages, and remove all your data from our servers.</p>
            <label htmlFor="settings-delete-password" style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Enter your password</label>
            <input id="settings-delete-password" type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} placeholder="Password" style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' }} />
            <label htmlFor="settings-delete-confirm" style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Type DELETE to confirm</label>
            <input id="settings-delete-confirm" type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="DELETE" style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  if (deleteConfirmText === 'DELETE' && deletePassword) {
                    api.users.deleteAccount(deletePassword).then(() => {
                      setShowDeleteConfirm(false); setDeleteConfirmText('');
                      addToast({ title: 'Account deleted', description: 'Your account has been scheduled for deletion.', variant: 'success' });
                      window.location.href = '/login';
                    }).catch((e: unknown) => addToast({ title: 'Failed to delete account. Try again.', description: (e as Record<string, string>)?.message || undefined, variant: 'error' }));
                  }
                }}
                disabled={deleteConfirmText !== 'DELETE' || !deletePassword}
                style={{ background: deleteConfirmText === 'DELETE' && deletePassword ? 'var(--error)' : 'var(--bg-elevated)', border: 'none', padding: '8px 20px', borderRadius: 'var(--radius-sm)', color: deleteConfirmText === 'DELETE' && deletePassword ? 'white' : 'var(--text-muted)', cursor: deleteConfirmText === 'DELETE' && deletePassword ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '13px' }}
              >Delete My Account</button>
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); setDeletePassword(''); }} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '8px 20px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SettingsAccountTab;
