/**
 * VoiceFederationBadge — Badge on voice participants showing their home instance.
 */

import { Globe } from 'lucide-react';

interface Props {
  instanceDomain: string;
}

export default function VoiceFederationBadge({ instanceDomain }: Props) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
      style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
      title={`Connected from ${instanceDomain}`}
    >
      <Globe size={10} />
      {instanceDomain}
    </span>
  );
}
