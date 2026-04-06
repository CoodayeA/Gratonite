import { useState, useEffect } from 'react';
import { User, Music, Award, Link2, Server, Users, MapPin, Calendar, Edit2, X } from 'lucide-react';
import { api, API_BASE } from '../lib/api';
import { useToast } from './ui/ToastManager';

interface UserProfileV2Props {
  userId: string;
  onClose: () => void;
  editable?: boolean;
}

interface ProfileData {
  id: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
  bannerHash?: string | null;
  bio?: string | null;
  badges?: Array<{ id: string; name: string; icon: string }>;
  customStatus?: string | null;
  nowPlaying?: { track: string; artist: string; albumArt?: string } | null;
  linkedAccounts?: Array<{ platform: string; username: string }>;
  memberSince?: string;
  mutualServers?: Array<{ id: string; name: string; iconHash?: string }>;
  mutualFriends?: Array<{ id: string; username: string; displayName: string; avatarHash?: string | null }>;
  fameReceived?: number;
  pronouns?: string | null;
  location?: string | null;
}

export function UserProfileV2({ userId, onClose, editable }: UserProfileV2Props) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [activeTab, setActiveTab] = useState<'about' | 'mutual_servers' | 'mutual_friends'>('about');
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editNowPlaying, setEditNowPlaying] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    // Load profile data
    api.users.getProfile(userId).then((data: any) => {
      setProfile({
        id: data.id,
        username: data.username,
        displayName: data.displayName || data.username,
        avatarHash: data.avatarHash,
        bannerHash: data.bannerHash,
        bio: data.bio,
        badges: data.badges || [],
        customStatus: data.customStatus,
        nowPlaying: data.customStatus?.startsWith('Listening to ')
          ? { track: data.customStatus.replace('Listening to ', ''), artist: '' }
          : null,
        linkedAccounts: data.connections || [],
        memberSince: data.createdAt,
        mutualServers: [],
        mutualFriends: [],
        fameReceived: data.fameReceived ?? 0,
        pronouns: data.pronouns,
        location: data.location,
      });
      setEditBio(data.bio || '');
      setEditStatus(data.customStatus || '');
    }).catch(() => {});

    // Load mutual servers/friends
    api.get(`/users/${userId}/mutual-servers`).then((data: any) => {
      if (Array.isArray(data)) {
        setProfile(prev => prev ? { ...prev, mutualServers: data } : prev);
      }
    }).catch(() => {});

    api.get(`/users/${userId}/mutual-friends`).then((data: any) => {
      if (Array.isArray(data)) {
        setProfile(prev => prev ? { ...prev, mutualFriends: data } : prev);
      }
    }).catch(() => {});
  }, [userId]);

  const handleSaveProfile = async () => {
    try {
      await api.users.updateProfile({
        bio: editBio || undefined,
        customStatus: editStatus || undefined,
      });
      setProfile(prev => prev ? {
        ...prev,
        bio: editBio || null,
        customStatus: editStatus || null,
        nowPlaying: editNowPlaying
          ? { track: editNowPlaying, artist: '' }
          : null,
      } : prev);
      setIsEditing(false);
    } catch { addToast({ title: 'Failed to save profile', variant: 'error' }); }
  };

  if (!profile) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }} onClick={onClose}>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading profile...</div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(480px, 95vw)', maxHeight: '85vh',
        background: 'var(--bg-elevated)', borderRadius: '16px',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Banner */}
        <div style={{
          height: '120px', position: 'relative',
          background: profile.bannerHash
            ? `url(${API_BASE}/files/${profile.bannerHash}) center/cover`
            : 'linear-gradient(135deg, var(--accent-primary), var(--accent-hover))',
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: '12px', right: '12px',
            background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff',
            width: '32px', height: '32px', borderRadius: '50%',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Avatar + Name */}
        <div style={{ padding: '0 20px', marginTop: '-40px', position: 'relative' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            border: '4px solid var(--bg-elevated)', overflow: 'hidden',
            background: 'var(--bg-tertiary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {profile.avatarHash ? (
              <img src={`${API_BASE}/files/${profile.avatarHash}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <User size={32} color="var(--text-muted)" />
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: '8px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{profile.displayName}</h2>
                {(profile.badges ?? []).map(badge => (
                  <span key={badge.id} title={badge.name} style={{
                    fontSize: '14px', display: 'inline-flex',
                  }}>{badge.icon}</span>
                ))}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>@{profile.username}</div>
              {profile.pronouns && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{profile.pronouns}</div>
              )}
            </div>
            {editable && (
              <button onClick={() => setIsEditing(true)} style={{
                background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                borderRadius: '8px', padding: '6px 12px', cursor: 'pointer',
                color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                <Edit2 size={12} /> Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Now Playing (Feature 64) */}
        {profile.nowPlaying && (
          <div style={{
            margin: '12px 20px 0', padding: '10px 14px',
            background: 'rgba(30, 215, 96, 0.1)', border: '1px solid rgba(30, 215, 96, 0.2)',
            borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <Music size={16} color="#1ed760" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', color: '#1ed760', fontWeight: 600 }}>Now Playing</div>
              <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.nowPlaying.track}
                {profile.nowPlaying.artist && <span style={{ color: 'var(--text-muted)' }}> by {profile.nowPlaying.artist}</span>}
              </div>
            </div>
          </div>
        )}

        {/* Custom Status */}
        {profile.customStatus && !profile.nowPlaying && (
          <div style={{
            margin: '12px 20px 0', padding: '8px 12px',
            background: 'var(--bg-tertiary)', borderRadius: '8px',
            fontSize: '13px', color: 'var(--text-secondary)',
          }}>
            {profile.customStatus}
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: '0', margin: '16px 20px 0',
          borderBottom: '1px solid var(--stroke)',
        }}>
          {(['about', 'mutual_servers', 'mutual_friends'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px', border: 'none', background: 'none',
                cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              {tab === 'about' ? 'About' : tab === 'mutual_servers' ? `Servers (${profile.mutualServers?.length || 0})` : `Friends (${profile.mutualFriends?.length || 0})`}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px' }}>
          {activeTab === 'about' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Bio */}
              {profile.bio && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>About Me</div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{profile.bio}</p>
                </div>
              )}

              {/* Location */}
              {profile.location && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <MapPin size={14} color="var(--text-muted)" />
                  {profile.location}
                </div>
              )}

              {/* Member Since */}
              {profile.memberSince && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <Calendar size={14} color="var(--text-muted)" />
                  Member since {new Date(profile.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
              )}

              {/* FAME */}
              {(profile.fameReceived ?? 0) > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--warning)' }}>
                  <Award size={14} />
                  {profile.fameReceived} FAME received
                </div>
              )}

              {/* Linked Accounts */}
              {(profile.linkedAccounts ?? []).length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Connections</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {profile.linkedAccounts!.map((acc, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 12px', background: 'var(--bg-tertiary)',
                        borderRadius: '6px', fontSize: '13px',
                      }}>
                        <Link2 size={14} color="var(--text-muted)" />
                        <span style={{ fontWeight: 500 }}>{acc.platform}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{acc.username}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'mutual_servers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(profile.mutualServers ?? []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>No mutual servers</div>
              ) : (
                profile.mutualServers!.map(server => (
                  <div key={server.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', background: 'var(--bg-tertiary)',
                    borderRadius: '8px',
                  }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      background: 'var(--accent-primary)', overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {server.iconHash ? (
                        <img src={`${API_BASE}/files/${server.iconHash}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Server size={14} color="#111" />
                      )}
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{server.name}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'mutual_friends' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(profile.mutualFriends ?? []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>No mutual friends</div>
              ) : (
                profile.mutualFriends!.map(friend => (
                  <div key={friend.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', background: 'var(--bg-tertiary)',
                    borderRadius: '8px',
                  }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: 'var(--bg-secondary)', overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {friend.avatarHash ? (
                        <img src={`${API_BASE}/files/${friend.avatarHash}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Users size={14} color="var(--text-muted)" />
                      )}
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{friend.displayName || friend.username}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Edit Profile Modal */}
        {isEditing && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
          }} onClick={() => setIsEditing(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              width: 'min(400px, 90vw)', background: 'var(--bg-elevated)',
              borderRadius: '12px', padding: '20px', display: 'flex',
              flexDirection: 'column', gap: '12px',
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Edit Profile</h3>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Bio</label>
                <textarea
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  maxLength={500}
                  style={{
                    width: '100%', minHeight: '80px', marginTop: '4px',
                    padding: '8px', background: 'var(--bg-tertiary)',
                    border: '1px solid var(--stroke)', borderRadius: '6px',
                    color: 'var(--text-primary)', fontSize: '13px',
                    resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Custom Status</label>
                <input
                  type="text"
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  maxLength={128}
                  placeholder="What are you up to?"
                  style={{
                    width: '100%', marginTop: '4px', padding: '8px',
                    background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                    borderRadius: '6px', color: 'var(--text-primary)',
                    fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Now Playing (display-only)
                </label>
                <input
                  type="text"
                  value={editNowPlaying}
                  onChange={e => setEditNowPlaying(e.target.value)}
                  maxLength={128}
                  placeholder="Song name - Artist"
                  style={{
                    width: '100%', marginTop: '4px', padding: '8px',
                    background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                    borderRadius: '6px', color: 'var(--text-primary)',
                    fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Set a song to display on your profile as "Now Playing"
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setIsEditing(false)} style={{
                  padding: '8px 16px', background: 'var(--bg-tertiary)',
                  border: '1px solid var(--stroke)', borderRadius: '6px',
                  color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer',
                }}>
                  Cancel
                </button>
                <button onClick={handleSaveProfile} style={{
                  padding: '8px 16px', background: 'var(--accent-primary)',
                  border: 'none', borderRadius: '6px', color: '#000',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                }}>
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
