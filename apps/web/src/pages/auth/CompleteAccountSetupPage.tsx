import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, ApiRequestError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/lib/utils';

const INTEREST_OPTIONS = [
  'Gaming',
  'Music',
  'Tech',
  'Art',
  'Sports',
  'Reading',
  'Fitness',
] as const;

/* ---------- styles ---------- */

const S = {
  wrapper: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 28,
    alignItems: 'center' as const,
    width: '100%',
    maxWidth: 600,
    margin: '0 auto',
  },

  stepRow: {
    display: 'flex' as const,
    gap: 8,
    justifyContent: 'center' as const,
    width: '100%',
  },
  stepBar: {
    width: 80,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'var(--stroke)',
  } as React.CSSProperties,
  stepBarActive: {
    backgroundColor: 'var(--accent)',
  } as React.CSSProperties,

  headingGroup: {
    textAlign: 'center' as const,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 6,
  },
  heading: {
    fontSize: 24,
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  },
  subheading: {
    fontSize: 14,
    color: 'var(--text-muted)',
    margin: 0,
  },

  authForm: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 16,
  } as React.CSSProperties,
  authHeading: {
    fontSize: 20,
    fontWeight: 700,
    textAlign: 'center' as const,
  } as React.CSSProperties,
  authSubheading: {
    fontSize: 14,
    color: 'var(--text-muted)',
    textAlign: 'center' as const,
    marginBottom: 4,
  } as React.CSSProperties,
  authButtonLink: {
    textDecoration: 'none' as const,
  } as React.CSSProperties,
  authSubmit: {
    marginTop: 8,
    width: '100%',
  } as React.CSSProperties,
  authError: {
    padding: '10px 14px',
    background: 'var(--danger-bg)',
    border: '1px solid rgba(255, 107, 107, 0.25)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--danger)',
    fontSize: 13,
  } as React.CSSProperties,

  avatarSection: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: '50%',
    backgroundColor: 'var(--bg-input)',
    border: '2px solid var(--border-gold)',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    cursor: 'pointer' as const,
    overflow: 'hidden' as const,
    padding: 0,
    transition: 'border-color 0.2s',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    borderRadius: '50%',
  },
  avatarLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--accent)',
  },
  hiddenInput: {
    display: 'none' as const,
  },

  form: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 28,
    width: '100%',
  },
  fieldsGroup: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 14,
  },

  inputGroup: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 6,
  } as React.CSSProperties,
  inputLabel: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  inputHint: {
    fontSize: 12,
    color: 'var(--text-faint)',
  } as React.CSSProperties,

  textarea: {
    width: '100%',
    minHeight: 72,
    padding: '10px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    fontSize: 14,
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    outline: 'none' as const,
    boxSizing: 'border-box' as const,
  },

  interestsSection: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 10,
  },
  interestsLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-muted)',
  },
  interestsGrid: {
    display: 'flex' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  interestPill: {
    padding: '6px 16px',
    borderRadius: 'var(--radius-xl)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer' as const,
    transition: 'all 0.15s ease',
    lineHeight: '1.4',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  interestPillSelected: {
    backgroundColor: 'var(--accent)',
    color: 'var(--text-on-gold)',
    border: '1px solid var(--accent)',
  } as React.CSSProperties,
  interestPillUnselected: {
    backgroundColor: 'transparent',
    color: 'var(--text)',
    border: '1px solid var(--stroke)',
  } as React.CSSProperties,

  submitButton: {
    width: '100%',
    height: 48,
    borderRadius: 'var(--radius-sm)',
    fontSize: 15,
    fontWeight: 600,
    backgroundColor: 'var(--accent)',
    color: 'var(--text-on-gold)',
    border: 'none',
    cursor: 'pointer',
  },

  skipLink: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-faint)',
    textDecoration: 'none' as const,
  },
};

export function CompleteAccountSetupPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [username, setUsername] = useState(user?.username ?? '');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const usernameTimer = useRef<ReturnType<typeof setTimeout>>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUsernameAvailable(null);
    if (!username || username.length < 2) return;
    if (user?.username?.toLowerCase() === username.toLowerCase()) {
      setUsernameAvailable(true);
      return;
    }

    clearTimeout(usernameTimer.current);
    usernameTimer.current = setTimeout(async () => {
      setUsernameChecking(true);
      try {
        const res = await api.auth.checkUsername(username);
        setUsernameAvailable(res.available);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setUsernameChecking(false);
      }
    }, 400);

    return () => clearTimeout(usernameTimer.current);
  }, [username, user?.username]);

  function getUsernameHint() {
    if (usernameChecking) return 'Checking availability...';
    if (usernameAvailable === true) return 'Username is available';
    if (usernameAvailable === false) return 'Username is already taken';
    return 'Use letters, numbers, period, underscore, or dash';
  }

  function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatarPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  function toggleInterest(interest: string) {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (usernameAvailable === false) {
      setError('Please choose a different username.');
      return;
    }

    setLoading(true);
    try {
      const fallbackDisplayName = displayName || username;
      const res = await api.users.updateAccountBasics({
        username,
        displayName: fallbackDisplayName,
      });

      updateUser({
        username: res.user.username,
        displayName: res.profile?.displayName ?? fallbackDisplayName,
      });

      // Upload avatar if selected
      if (avatarFile) {
        try {
          await api.users.uploadAvatar(avatarFile);
        } catch {
          // Avatar upload failed silently — don't block setup completion
        }
      }

      // Update profile with bio if provided
      if (bio.trim()) {
        try {
          await api.users.updateProfile({ bio: bio.trim() });
        } catch {
          // Bio update failed silently — don't block setup completion
        }
      }

      // Store interests in user settings if any selected
      if (selectedInterests.length > 0) {
        try {
          await api.users.updateSettings({ interests: selectedInterests });
        } catch {
          // Settings update failed silently — don't block setup completion
        }
      }

      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError && err.details) {
        setFieldErrors(err.details);
      }
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <div style={S.authForm}>
        <h2 style={S.authHeading}>Sign in required</h2>
        <p style={S.authSubheading}>Please sign in to complete account setup.</p>
        <Link to="/login" style={S.authButtonLink}>
          <Button style={S.authSubmit}>Go to Login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div style={S.wrapper}>
      {/* Step indicator */}
      <div style={S.stepRow}>
        <div style={{ ...S.stepBar, ...S.stepBarActive }} />
        <div style={{ ...S.stepBar, ...S.stepBarActive }} />
        <div style={S.stepBar} />
      </div>

      {/* Heading */}
      <div style={S.headingGroup}>
        <h2 style={S.heading}>Complete Your Profile</h2>
        <p style={S.subheading}>Let others know who you are</p>
      </div>

      {error && <div style={S.authError}>{error}</div>}

      {/* Avatar upload */}
      <div style={S.avatarSection}>
        <button
          type="button"
          onClick={handleAvatarClick}
          style={S.avatarCircle}
          aria-label="Upload avatar"
        >
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt="Avatar preview"
              style={S.avatarImage}
            />
          ) : (
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-faint)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          )}
        </button>
        <span style={S.avatarLabel}>Upload Avatar</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={S.hiddenInput}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

      {/* Form fields */}
      <form onSubmit={handleSubmit} style={S.form}>
        <div style={S.fieldsGroup}>
          <Input
            label="Display Name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How should we call you?"
            error={fieldErrors['displayName']?.[0]}
          />

          <Input
            label="Username"
            type="text"
            value={username}
            onChange={(e) =>
              setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))
            }
            error={
              usernameAvailable === false
                ? 'Username is already taken'
                : fieldErrors['username']?.[0]
            }
            hint={getUsernameHint()}
            required
            autoComplete="username"
          />

          {/* Bio textarea */}
          <div style={S.inputGroup}>
            <label style={S.inputLabel} htmlFor="setup-bio">
              Bio(optional)
            </label>
            <textarea
              id="setup-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us more about yourself..."
              rows={3}
              maxLength={256}
              style={S.textarea}
            />
            <span style={S.inputHint}>
              A short description for your profile ({bio.length}/256)
            </span>
          </div>
        </div>

        {/* Interests */}
        <div style={S.interestsSection}>
          <span style={S.interestsLabel}>Select Your Interests</span>
          <div style={S.interestsGrid}>
            {INTEREST_OPTIONS.map((interest) => {
              const isSelected = selectedInterests.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  style={{
                    ...S.interestPill,
                    ...(isSelected ? S.interestPillSelected : S.interestPillUnselected),
                  }}
                >
                  {interest}
                </button>
              );
            })}
          </div>
        </div>

        {/* Submit button */}
        <Button type="submit" loading={loading} style={S.submitButton}>
          Complete Setup
        </Button>
      </form>

      {/* Skip link */}
      <Link to="/" style={S.skipLink}>
        Skip for now
      </Link>
    </div>
  );
}
