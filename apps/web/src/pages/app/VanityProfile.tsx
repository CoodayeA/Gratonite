/**
 * VanityProfile — Item 110: Public profile page at gratonite.chat/u/username
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { User, Calendar, Loader } from 'lucide-react';
import { api, API_BASE } from '../../lib/api';

const VanityProfile = () => {
  const { vanityUrl } = useParams<{ vanityUrl: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!vanityUrl) return;
    api.vanityProfile.lookup(vanityUrl)
      .then(setProfile)
      .catch(() => setError('User not found'))
      .finally(() => setLoading(false));
  }, [vanityUrl]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <Loader size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
        <User size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
        <h2 style={{ fontSize: '24px', fontWeight: 600 }}>User Not Found</h2>
        <p style={{ fontSize: '14px', marginTop: '8px' }}>The profile "{vanityUrl}" does not exist.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-primary)', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '480px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--stroke)', background: 'var(--bg-secondary)' }}>
        {/* Banner */}
        <div style={{ height: '120px', background: 'linear-gradient(135deg, var(--accent-primary), rgba(0,0,0,0.3))' }} />

        {/* Profile */}
        <div style={{ padding: '0 24px 24px', position: 'relative' }}>
          <div style={{
            width: '96px', height: '96px', borderRadius: '50%', border: '4px solid var(--bg-secondary)',
            background: 'var(--bg-tertiary)', marginTop: '-48px', marginBottom: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {profile.avatarHash ? (
              <img src={`${API_BASE}/files/${profile.avatarHash}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '36px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                {(profile.displayName || profile.username || '?')[0].toUpperCase()}
              </span>
            )}
          </div>

          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            {profile.displayName || profile.username}
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '16px' }}>@{profile.username}</p>

          {profile.bio && (
            <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: '8px', marginBottom: '16px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{profile.bio}</p>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <Calendar size={14} />
            <span>Joined {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Unknown'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VanityProfile;
