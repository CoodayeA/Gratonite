import { useEffect, useRef } from 'react';
import { Avatar } from './Avatar';

interface ProfilePopoverProps {
  x: number;
  y: number;
  displayName: string;
  username: string | null;
  avatarHash: string | null;
  bannerHash: string | null;
  bio?: string | null;
  userId: string;
  onClose: () => void;
}

export function ProfilePopover({
  x,
  y,
  displayName,
  username,
  avatarHash,
  bannerHash,
  bio,
  userId,
  onClose,
}: ProfilePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!popoverRef.current) return;
    const rect = popoverRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      popoverRef.current.style.left = `${window.innerWidth - rect.width - 12}px`;
    }
    if (rect.bottom > window.innerHeight) {
      popoverRef.current.style.top = `${window.innerHeight - rect.height - 12}px`;
    }
  }, [x, y]);

  return (
    <div
      className="profile-popover"
      ref={popoverRef}
      style={{ top: y, left: x }}
    >
      <div
        className="profile-popover-banner"
        style={bannerHash ? { backgroundImage: `url(/api/v1/files/${bannerHash})` } : undefined}
      />
      <div className="profile-popover-body">
        <Avatar name={displayName} hash={avatarHash} userId={userId} size={52} className="profile-popover-avatar" />
        <div className="profile-popover-names">
          <span className="profile-popover-name">{displayName}</span>
          {username && <span className="profile-popover-username">@{username}</span>}
        </div>
        {bio && <p className="profile-popover-bio">{bio}</p>}
      </div>
    </div>
  );
}
