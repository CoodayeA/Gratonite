import { Globe } from 'lucide-react';
import { Tooltip } from './Tooltip';

type RemoteBadgeProps = {
  address?: string | null;
  size?: number;
};

/**
 * RemoteBadge — small Globe icon indicating a federated (remote-instance) user.
 * Shows the full federation address in the tooltip when available.
 */
export function RemoteBadge({ address, size = 12 }: RemoteBadgeProps) {
  return (
    <Tooltip
      content={address ? `Remote user · ${address}` : 'Remote instance'}
      position="top"
      delay={200}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          marginLeft: '5px',
          verticalAlign: 'middle',
          color: 'var(--text-muted)',
          cursor: 'default',
        }}
        aria-label={address ? `Federated user from ${address}` : 'Federated user'}
      >
        <Globe size={size} strokeWidth={2.5} />
      </span>
    </Tooltip>
  );
}
