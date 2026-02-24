import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProfilePopover } from '@/components/ui/ProfilePopover';
import { api } from '@/lib/api';

interface MentionLinkProps {
  userId: string;
  label: string;
}

/**
 * Renders an @mention as a clickable link that opens a ProfilePopover on click.
 * Self-contained: fetches user data on demand and manages its own popover state.
 */
export function MentionLink({ userId, label }: MentionLinkProps) {
  const [popover, setPopover] = useState<{ x: number; y: number } | null>(null);

  // Fetch user summary when popover is opened
  const { data: summaries } = useQuery({
    queryKey: ['users', 'summaries', 'mention-popover', [userId]],
    queryFn: () => api.users.getSummaries([userId]),
    enabled: popover !== null,
    staleTime: 60_000,
  });

  const user = summaries?.[0] ?? null;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPopover({ x: e.clientX, y: e.clientY });
  }, []);

  return (
    <>
      <button
        type="button"
        className="markdown-mention mention-link"
        data-user-id={userId}
        onClick={handleClick}
        title={`@${label}`}
      >
        @{label}
      </button>
      {popover && (
        <ProfilePopover
          x={popover.x}
          y={popover.y}
          displayName={user?.displayName ?? label}
          username={user?.username ?? null}
          avatarHash={user?.avatarHash ?? null}
          bannerHash={null}
          bio={null}
          userId={userId}
          onClose={() => setPopover(null)}
        />
      )}
    </>
  );
}
