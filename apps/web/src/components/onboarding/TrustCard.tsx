import React from 'react';
import { Lock, Globe, Shield, Wifi } from 'lucide-react';

export type TrustCardType = 'e2e' | 'federation' | 'privacy' | 'offline';

interface TrustCardProps {
  type: TrustCardType;
  title: string;
  description: string;
}

const iconMap: Record<TrustCardType, React.ReactNode> = {
  'e2e': <Lock size={28} />,
  'federation': <Globe size={28} />,
  'privacy': <Shield size={28} />,
  'offline': <Wifi size={28} />,
};

const colorMap: Record<TrustCardType, string> = {
  'e2e': '#d4af37',
  'federation': '#9333ea',
  'privacy': '#4f46e5',
  'offline': '#666666',
};

export function TrustCard({ type, title, description }: TrustCardProps) {
  const icon = iconMap[type];
  const color = colorMap[type];

  return (
    <div
      className="trust-card neo-border"
      style={{
        '--trust-color': color,
      } as React.CSSProperties & { '--trust-color': string }}
    >
      <div className="trust-card-header">
        <div className="trust-card-icon-wrapper" style={{ color }}>
          {icon}
        </div>
        <div className="trust-card-badge" style={{ borderColor: color }}>
          {type === 'e2e' && 'E2E Encrypted'}
          {type === 'federation' && 'Federated'}
          {type === 'privacy' && 'Privacy'}
          {type === 'offline' && 'Offline'}
        </div>
      </div>
      <h3 className="trust-card-title">{title}</h3>
      <p className="trust-card-description">{description}</p>
    </div>
  );
}
