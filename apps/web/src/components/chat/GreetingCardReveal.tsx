import { useState, useEffect } from 'react';
import { X, Mail } from 'lucide-react';
import { api } from '../../lib/api';

interface CardData {
  id: string;
  message: string;
  sentAt: string;
  viewedAt: string | null;
  template: {
    name: string;
    category: string;
    bgColor: string;
    bgImage: string | null;
    fontFamily: string;
  };
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarHash: string | null;
  };
}

interface GreetingCardRevealProps {
  card: CardData;
  onClose: () => void;
}

export default function GreetingCardReveal({ card, onClose }: GreetingCardRevealProps) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    // Mark as viewed
    if (!card.viewedAt) {
      api.patch(`/greeting-cards/${card.id}/view`, {}).catch(() => {});
    }
    // Trigger animation
    const timer = setTimeout(() => setRevealed(true), 100);
    return () => clearTimeout(timer);
  }, [card.id]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className={`relative transition-all duration-700 ease-out ${
          revealed ? 'scale-100 opacity-100 translate-y-0' : 'scale-75 opacity-0 translate-y-12'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-zinc-800 rounded-full p-1.5 text-zinc-400 hover:text-zinc-200 z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Envelope background */}
        <div
          className={`w-80 sm:w-96 rounded-2xl overflow-hidden shadow-2xl transition-all duration-500 ${
            revealed ? 'max-h-[600px]' : 'max-h-0'
          }`}
        >
          {/* Card content */}
          <div
            className="p-8 text-center space-y-6 min-h-[300px] flex flex-col items-center justify-center"
            style={{
              backgroundColor: card.template.bgColor,
              backgroundImage: card.template.bgImage ? `url(${card.template.bgImage})` : undefined,
              backgroundSize: 'cover',
              fontFamily: card.template.fontFamily,
            }}
          >
            <div className={`transition-all duration-500 delay-300 ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <Mail className="w-10 h-10 text-white/60 mx-auto mb-2" />
              <h2 className="text-3xl font-bold text-white drop-shadow-lg">{card.template.name}</h2>
            </div>

            <div className={`transition-all duration-500 delay-500 ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <p className="text-white/90 text-lg leading-relaxed drop-shadow">{card.message}</p>
            </div>

            <div className={`transition-all duration-500 delay-700 ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="text-white/60 text-sm mt-4">
                From <span className="text-white font-medium">{card.sender.displayName}</span>
              </div>
              <div className="text-white/40 text-xs mt-1">
                {new Date(card.sentAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
