/**
 * FederationBadge — Instance domain badge for federated users/messages.
 * Trust level determines color: verified=green, trusted=blue, auto=gray.
 */

import { Globe } from 'lucide-react';

interface Props {
  domain: string;
  trustLevel?: 'verified' | 'manually_trusted' | 'auto_discovered';
  size?: 'sm' | 'md';
}

const TRUST_COLORS = {
  verified: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  manually_trusted: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' },
  auto_discovered: { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8' },
};

export default function FederationBadge({ domain, trustLevel = 'auto_discovered', size = 'sm' }: Props) {
  const colors = TRUST_COLORS[trustLevel];
  const fontSize = size === 'sm' ? '10px' : '12px';
  const padding = size === 'sm' ? '1px 4px' : '2px 6px';
  const iconSize = size === 'sm' ? 10 : 12;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        background: colors.bg,
        color: colors.text,
        fontSize,
        fontWeight: 600,
        padding,
        borderRadius: '4px',
        whiteSpace: 'nowrap',
      }}
      title={`Federated from ${domain} (${trustLevel.replace('_', ' ')})`}
    >
      <Globe size={iconSize} />
      {domain}
    </span>
  );
}
