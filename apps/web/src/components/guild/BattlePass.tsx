/**
 * 124. Battle Pass / Seasonal Events — Active season pass with tiers and progress.
 */
import { useState, useEffect } from 'react';
import { Shield, Star, Gift, Lock, Check, Trophy } from 'lucide-react';
import { api } from '../../lib/api';

interface EventTier {
  level: number;
  name: string;
  reward: string;
  requiredPoints: number;
}

export default function BattlePass() {
  const [events, setEvents] = useState<any[]>([]);
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [progress, setProgress] = useState<{ points: number; claimedRewards: number[] }>({ points: 0, claimedRewards: [] });

  useEffect(() => {
    api.seasonalEvents.getActive().then(e => {
      setEvents(e);
      if (e.length > 0) {
        setActiveEvent(e[0]);
        api.seasonalEvents.getProgress(e[0].id).then(p => {
          setProgress({ points: p.points || 0, claimedRewards: p.claimedRewards || [] });
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const claimReward = async (rewardIndex: number) => {
    if (!activeEvent) return;
    try {
      await api.seasonalEvents.claim(activeEvent.id, rewardIndex);
      setProgress(prev => ({ ...prev, claimedRewards: [...prev.claimedRewards, rewardIndex] }));
    } catch {}
  };

  const tiers: EventTier[] = activeEvent?.rewards || [
    { level: 1, name: 'Bronze', reward: '50 Coins', requiredPoints: 100 },
    { level: 2, name: 'Silver', reward: 'Title: Explorer', requiredPoints: 300 },
    { level: 3, name: 'Gold', reward: 'Profile Border', requiredPoints: 600 },
    { level: 4, name: 'Platinum', reward: '200 Coins', requiredPoints: 1000 },
    { level: 5, name: 'Diamond', reward: 'Exclusive Badge', requiredPoints: 1500 },
  ];

  const currentTier = tiers.filter(t => progress.points >= t.requiredPoints).length;
  const nextTier = tiers[currentTier] || tiers[tiers.length - 1];
  const progressPct = nextTier ? Math.min(100, (progress.points / nextTier.requiredPoints) * 100) : 100;

  const daysLeft = activeEvent
    ? Math.max(0, Math.ceil((new Date(activeEvent.endAt).getTime() - Date.now()) / 86400000))
    : 0;

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          {activeEvent?.name || 'Season Pass'}
        </h3>
        {activeEvent && (
          <span className="text-xs text-gray-400">{daysLeft} days left</span>
        )}
      </div>

      {!activeEvent && events.length === 0 && (
        <p className="text-gray-500 text-sm">No active seasonal events right now.</p>
      )}

      {(activeEvent || events.length === 0) && (
        <>
          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Tier {currentTier}/{tiers.length}</span>
              <span>{progress.points} / {nextTier?.requiredPoints || 'MAX'} pts</span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all bg-gradient-to-r from-indigo-600 to-purple-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Tier list */}
          <div className="space-y-2">
            {tiers.map((tier, i) => {
              const unlocked = progress.points >= tier.requiredPoints;
              const claimed = progress.claimedRewards.includes(i);
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    unlocked
                      ? claimed
                        ? 'bg-green-900/20 border-green-800'
                        : 'bg-indigo-900/20 border-indigo-700'
                      : 'bg-gray-800/50 border-gray-700 opacity-60'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    unlocked ? 'bg-indigo-600' : 'bg-gray-700'
                  }`}>
                    {claimed ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : unlocked ? (
                      <Star className="w-4 h-4 text-yellow-400" />
                    ) : (
                      <Lock className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium">{tier.name}</p>
                    <p className="text-xs text-gray-400">{tier.reward}</p>
                  </div>
                  <div className="text-xs text-gray-500">{tier.requiredPoints} pts</div>
                  {unlocked && !claimed && (
                    <button
                      onClick={() => claimReward(i)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded"
                    >
                      Claim
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
