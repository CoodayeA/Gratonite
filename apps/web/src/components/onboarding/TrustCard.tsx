import React from 'react';
import { Lock, Globe, AlertCircle, X } from 'lucide-react';

export type TrustCardType = 'encryption' | 'federation' | 'privacy' | 'offline-capable';

export interface TrustCardProps {
  type: TrustCardType;
  title: string;
  description: string;
  onDismiss: () => void;
  icon?: React.ReactNode;
}

const iconMap: Record<TrustCardType, React.ReactNode> = {
  encryption: <Lock size={20} className="text-green-600" />,
  federation: <Globe size={20} className="text-blue-600" />,
  privacy: <AlertCircle size={20} className="text-purple-600" />,
  'offline-capable': <Lock size={20} className="text-amber-600" />,
};

export function TrustCard({ type, title, description, onDismiss, icon }: TrustCardProps) {
  const bgClass = {
    encryption: 'bg-green-50 border-green-200',
    federation: 'bg-blue-50 border-blue-200',
    privacy: 'bg-purple-50 border-purple-200',
    'offline-capable': 'bg-amber-50 border-amber-200',
  }[type];

  const textClass = {
    encryption: 'text-green-800',
    federation: 'text-blue-800',
    privacy: 'text-purple-800',
    'offline-capable': 'text-amber-800',
  }[type];

  return (
    <div
      className={`border rounded-lg p-3 flex gap-3 mb-3 ${bgClass}`}
      role="article"
      aria-label={`Trust signal: ${title}`}
    >
      <div className="flex-shrink-0 mt-0.5">{icon || iconMap[type]}</div>
      <div className="flex-1">
        <h4 className={`font-semibold text-sm ${textClass}`}>{title}</h4>
        <p className={`text-xs ${textClass} opacity-80 mt-1`}>{description}</p>
      </div>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 p-1"
        aria-label={`Dismiss ${title} card`}
      >
        <X size={16} />
      </button>
    </div>
  );
}
