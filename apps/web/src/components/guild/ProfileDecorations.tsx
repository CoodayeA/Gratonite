/**
 * 126. Profile Decorations — CSS-based animated borders and profile effects.
 */
import { useState } from 'react';
import { Sparkles, Check } from 'lucide-react';

interface Decoration {
  id: string;
  name: string;
  preview: string; // CSS class or style description
  borderStyle: React.CSSProperties;
}

const DECORATIONS: Decoration[] = [
  {
    id: 'none',
    name: 'None',
    preview: 'No decoration',
    borderStyle: {},
  },
  {
    id: 'rainbow',
    name: 'Rainbow Glow',
    preview: 'Animated rainbow border',
    borderStyle: {
      border: '3px solid transparent',
      backgroundClip: 'padding-box',
      boxShadow: '0 0 10px rgba(99, 102, 241, 0.5), 0 0 20px rgba(236, 72, 153, 0.3), 0 0 30px rgba(245, 158, 11, 0.2)',
      animation: 'rainbowGlow 3s ease-in-out infinite',
    },
  },
  {
    id: 'fire',
    name: 'Fire Ring',
    preview: 'Orange-red glowing border',
    borderStyle: {
      border: '3px solid #ef4444',
      boxShadow: '0 0 8px rgba(239, 68, 68, 0.6), 0 0 16px rgba(245, 158, 11, 0.3)',
      animation: 'fireGlow 2s ease-in-out infinite',
    },
  },
  {
    id: 'ice',
    name: 'Ice Crystal',
    preview: 'Blue crystalline border',
    borderStyle: {
      border: '3px solid #06b6d4',
      boxShadow: '0 0 8px rgba(6, 182, 212, 0.5), 0 0 16px rgba(59, 130, 246, 0.3)',
    },
  },
  {
    id: 'gold',
    name: 'Golden Frame',
    preview: 'Premium gold border',
    borderStyle: {
      border: '3px solid #f59e0b',
      boxShadow: '0 0 8px rgba(245, 158, 11, 0.5), 0 0 16px rgba(245, 158, 11, 0.2)',
    },
  },
  {
    id: 'neon-green',
    name: 'Neon Pulse',
    preview: 'Pulsing neon green',
    borderStyle: {
      border: '3px solid #22c55e',
      boxShadow: '0 0 8px rgba(34, 197, 94, 0.6), 0 0 16px rgba(34, 197, 94, 0.3)',
      animation: 'neonPulse 2s ease-in-out infinite',
    },
  },
  {
    id: 'purple-haze',
    name: 'Purple Haze',
    preview: 'Mystic purple glow',
    borderStyle: {
      border: '3px solid #a855f7',
      boxShadow: '0 0 10px rgba(168, 85, 247, 0.5), 0 0 20px rgba(139, 92, 246, 0.3)',
    },
  },
];

const KEYFRAMES = `
@keyframes rainbowGlow {
  0%, 100% { box-shadow: 0 0 10px rgba(99, 102, 241, 0.5), 0 0 20px rgba(236, 72, 153, 0.3); }
  33% { box-shadow: 0 0 10px rgba(236, 72, 153, 0.5), 0 0 20px rgba(245, 158, 11, 0.3); }
  66% { box-shadow: 0 0 10px rgba(245, 158, 11, 0.5), 0 0 20px rgba(34, 197, 94, 0.3); }
}
@keyframes fireGlow {
  0%, 100% { box-shadow: 0 0 8px rgba(239, 68, 68, 0.6), 0 0 16px rgba(245, 158, 11, 0.3); }
  50% { box-shadow: 0 0 12px rgba(245, 158, 11, 0.7), 0 0 24px rgba(239, 68, 68, 0.4); }
}
@keyframes neonPulse {
  0%, 100% { box-shadow: 0 0 8px rgba(34, 197, 94, 0.6); }
  50% { box-shadow: 0 0 16px rgba(34, 197, 94, 0.8), 0 0 32px rgba(34, 197, 94, 0.4); }
}
`;

interface ProfileDecorationsProps {
  selected: string;
  onSelect: (id: string) => void;
}

export default function ProfileDecorations({ selected, onSelect }: ProfileDecorationsProps) {
  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <style>{KEYFRAMES}</style>
      <h3 className="text-white font-medium flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-pink-400" /> Profile Decorations
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {DECORATIONS.map(dec => (
          <button
            key={dec.id}
            onClick={() => onSelect(dec.id)}
            className={`relative p-3 rounded-lg border text-left transition-colors ${
              selected === dec.id
                ? 'bg-indigo-900/30 border-indigo-600'
                : 'bg-gray-800 border-gray-700 hover:border-gray-600'
            }`}
          >
            {/* Preview circle */}
            <div className="flex justify-center mb-2">
              <div
                className="w-12 h-12 rounded-full bg-gray-700"
                style={{ ...dec.borderStyle, borderRadius: '50%' }}
              />
            </div>
            <p className="text-sm text-white font-medium text-center">{dec.name}</p>
            <p className="text-xs text-gray-500 text-center">{dec.preview}</p>
            {selected === dec.id && (
              <div className="absolute top-2 right-2">
                <Check className="w-4 h-4 text-green-400" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Utility: get border style for a decoration ID */
export function getDecorationStyle(decorationId: string): React.CSSProperties {
  const dec = DECORATIONS.find(d => d.id === decorationId);
  return dec?.borderStyle || {};
}

/** Inject keyframes into document (call once) */
export function injectDecorationKeyframes() {
  if (typeof document !== 'undefined' && !document.getElementById('profile-decoration-keyframes')) {
    const style = document.createElement('style');
    style.id = 'profile-decoration-keyframes';
    style.textContent = KEYFRAMES;
    document.head.appendChild(style);
  }
}
