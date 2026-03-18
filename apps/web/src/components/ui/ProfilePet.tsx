import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';

type PetType = 'cat' | 'dog' | 'dragon' | 'slime' | 'robot';
type PetStage = 'baby' | 'teen' | 'adult';

interface PetData {
  type: PetType;
  name: string;
  happiness: number;
  level: number;
  stage: PetStage;
  lastFed: number;
  messageCount: number;
}

const PET_EMOJIS: Record<PetType, Record<PetStage, string>> = {
  cat:    { baby: '🐱', teen: '😺', adult: '😸' },
  dog:    { baby: '🐶', teen: '🐕', adult: '🐕‍🦺' },
  dragon: { baby: '🐉', teen: '🐲', adult: '🔥' },
  slime:  { baby: '🟢', teen: '🟩', adult: '💚' },
  robot:  { baby: '🤖', teen: '⚙️', adult: '🦾' },
};

function getStage(messageCount: number): PetStage {
  if (messageCount >= 1000) return 'adult';
  if (messageCount >= 100) return 'teen';
  return 'baby';
}

function decayHappiness(pet: PetData): number {
  const hoursSinceFed = (Date.now() - pet.lastFed) / (1000 * 60 * 60);
  const decay = Math.floor(hoursSinceFed * 2);
  return Math.max(0, pet.happiness - decay);
}

export function getPetData(userId: string): PetData | null {
  try {
    const raw = localStorage.getItem(`gratonite-pet:${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function savePetData(userId: string, data: PetData): void {
  localStorage.setItem(`gratonite-pet:${userId}`, JSON.stringify(data));
}

interface ProfilePetProps {
  userId: string;
  messageCount?: number;
  compact?: boolean;
  onFeed?: (cost: number) => Promise<boolean>;
}

export default function ProfilePet({ userId, messageCount = 0, compact = false, onFeed }: ProfilePetProps) {
  const [pet, setPet] = useState<PetData | null>(null);
  const [showHeart, setShowHeart] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const data = getPetData(userId);
    if (data) {
      data.happiness = decayHappiness(data);
      data.messageCount = Math.max(data.messageCount, messageCount);
      data.stage = getStage(data.messageCount);
      savePetData(userId, data);
      setPet(data);
    }
  }, [userId, messageCount]);

  const handleCreate = (type: PetType) => {
    const newPet: PetData = {
      type,
      name: type.charAt(0).toUpperCase() + type.slice(1),
      happiness: 80,
      level: 1,
      stage: getStage(messageCount),
      lastFed: Date.now(),
      messageCount,
    };
    savePetData(userId, newPet);
    setPet(newPet);
    setCreating(false);
  };

  const handlePet = () => {
    if (!pet) return;
    setShowHeart(true);
    const updated = { ...pet, happiness: Math.min(100, pet.happiness + 5) };
    savePetData(userId, updated);
    setPet(updated);
    setTimeout(() => setShowHeart(false), 800);
  };

  const handleFeed = async () => {
    if (!pet || !onFeed) return;
    const success = await onFeed(10);
    if (success) {
      const updated = { ...pet, happiness: Math.min(100, pet.happiness + 20), lastFed: Date.now() };
      savePetData(userId, updated);
      setPet(updated);
    }
  };

  if (!pet && !creating) {
    if (compact) return null;
    return (
      <button
        onClick={() => setCreating(true)}
        style={{
          background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)',
          borderRadius: '8px', padding: '8px 12px', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: '12px', width: '100%',
        }}
      >
        Adopt a Pet Companion
      </button>
    );
  }

  if (creating) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.04)', borderRadius: '8px',
        padding: '10px', display: 'flex', gap: '8px', justifyContent: 'center',
      }}>
        {(Object.keys(PET_EMOJIS) as PetType[]).map(type => (
          <button
            key={type}
            onClick={() => handleCreate(type)}
            title={type}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', padding: '8px 12px', cursor: 'pointer',
              fontSize: '20px',
            }}
          >
            {PET_EMOJIS[type].baby}
          </button>
        ))}
      </div>
    );
  }

  if (!pet) return null;

  const emoji = PET_EMOJIS[pet.type][pet.stage];
  const happinessColor = pet.happiness >= 60 ? '#22c55e' : pet.happiness >= 30 ? '#f59e0b' : '#ef4444';

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '16px' }}>{emoji}</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{pet.name} Lv.{pet.level}</span>
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', borderRadius: '10px',
      padding: '12px', position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          onClick={handlePet}
          style={{
            fontSize: '28px', cursor: 'pointer', position: 'relative',
            transition: 'transform 0.2s',
          }}
          className="hover-scale-up"
        >
          {emoji}
          {showHeart && (
            <Heart
              size={14} color="#ef4444" fill="#ef4444"
              style={{
                position: 'absolute', top: '-8px', right: '-4px',
                animation: 'petHeartFloat 0.8s ease-out forwards',
              }}
            />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{pet.name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {pet.stage.charAt(0).toUpperCase() + pet.stage.slice(1)} &middot; Lv.{pet.level}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <div style={{
              flex: 1, height: '4px', borderRadius: '2px',
              background: 'rgba(255,255,255,0.08)',
            }}>
              <div style={{
                height: '100%', borderRadius: '2px', background: happinessColor,
                width: `${pet.happiness}%`, transition: 'width 0.3s',
              }} />
            </div>
            <span style={{ fontSize: '10px', color: happinessColor }}>{pet.happiness}%</span>
          </div>
        </div>
        {onFeed && (
          <button
            onClick={handleFeed}
            title="Feed (10 Gratonites)"
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px', padding: '4px 8px', cursor: 'pointer',
              fontSize: '11px', color: 'var(--text-primary)',
            }}
          >
            Feed
          </button>
        )}
      </div>
      <style>{`
        @keyframes petHeartFloat {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-20px) scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
