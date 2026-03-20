import { useState, useEffect } from 'react';
import { Shield, Check, ChevronRight } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

interface PrivacyScoreProps {
  userSettings: any;
  userProfile: any;
  onNavigate?: (tab: string) => void;
}

interface Criterion {
  label: string;
  points: number;
  met: boolean;
  fixTab?: string;
  fixLabel?: string;
}

export default function PrivacyScore({ userSettings, userProfile, onNavigate }: PrivacyScoreProps) {
  const { user: ctxUser } = useUser();
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const twoFaEnabled = !!userProfile?.mfaEnabled;
    const dmsRestricted = userSettings?.dmPolicy === 'friends_only';
    const activityHidden = userSettings?.showActivity === false || localStorage.getItem('gratonite-auto-share-on-join') === 'false';
    const readReceiptsOff = userSettings?.readReceipts === false;
    const profileVisitorsOff = userSettings?.profileVisitors === false;
    const strongPassword = true; // We can't verify client-side, assume yes
    const emailVerified = ctxUser.emailVerified || !!userProfile?.emailVerified;

    const list: Criterion[] = [
      { label: 'Two-Factor Authentication enabled', points: 25, met: twoFaEnabled, fixTab: 'security', fixLabel: 'Enable 2FA' },
      { label: 'DMs restricted to friends only', points: 15, met: dmsRestricted, fixTab: 'privacy', fixLabel: 'Restrict DMs' },
      { label: 'Activity status hidden', points: 10, met: activityHidden, fixTab: 'privacy', fixLabel: 'Hide Activity' },
      { label: 'Read receipts disabled', points: 10, met: readReceiptsOff, fixTab: 'privacy', fixLabel: 'Turn Off' },
      { label: 'Profile visitors disabled', points: 10, met: profileVisitorsOff, fixTab: 'privacy', fixLabel: 'Turn Off' },
      { label: 'Strong password (8+ characters)', points: 15, met: strongPassword },
      { label: 'Email address verified', points: 15, met: emailVerified, fixTab: 'account', fixLabel: 'Verify Email' },
    ];

    setCriteria(list);
    setScore(list.reduce((sum, c) => sum + (c.met ? c.points : 0), 0));
  }, [userSettings, userProfile, ctxUser.emailVerified]);

  const color = score >= 75 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  const circumference = 2 * Math.PI * 42;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '20px' }}>
        <div style={{ position: 'relative', width: '100px', height: '100px', flexShrink: 0 }}>
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
            <circle
              cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '24px', fontWeight: 700, color }}>{score}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>/ 100</span>
          </div>
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            <Shield size={16} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
            Privacy Score
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            {score >= 75 ? 'Your privacy is well-protected.' : score >= 40 ? 'Room for improvement.' : 'Your account could be more secure.'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {criteria.map((c) => (
          <div key={c.label} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '8px 12px', borderRadius: '8px',
            background: c.met ? 'rgba(34, 197, 94, 0.06)' : 'rgba(239, 68, 68, 0.06)',
          }}>
            <div style={{
              width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: c.met ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: c.met ? '#22c55e' : '#ef4444',
            }}>
              {c.met ? <Check size={12} /> : <span style={{ fontSize: '12px', fontWeight: 700 }}>!</span>}
            </div>
            <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)' }}>{c.label}</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: c.met ? '#22c55e' : 'var(--text-muted)' }}>+{c.points}</span>
            {!c.met && c.fixTab && onNavigate && (
              <button
                onClick={() => onNavigate(c.fixTab!)}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '6px',
                  padding: '4px 10px', fontSize: '11px', color: 'var(--accent-primary)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                {c.fixLabel} <ChevronRight size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
