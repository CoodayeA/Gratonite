/**
 * 123. Daily Login Rewards — Streak-based daily rewards UI.
 */
import { useState, useEffect } from 'react';
import { Gift, Flame, Check, Coins } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

export default function LoginRewards() {
  const [data, setData] = useState<{
    streak: number;
    lastClaim: string | null;
    canClaim: boolean;
    todayReward: number;
    weekRewards: Array<{ day: number; reward: number; claimed: boolean }>;
  } | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    api.loginRewards.get().then(setData).catch(() => {});
  }, []);

  const claim = async () => {
    try {
      const result = await api.loginRewards.claim();
      setData(prev => prev ? {
        ...prev,
        canClaim: false,
        streak: result.streak ?? prev.streak + 1,
        lastClaim: new Date().toISOString(),
        weekRewards: prev.weekRewards.map((w, i) =>
          i === (prev.streak % 7) ? { ...w, claimed: true } : w
        ),
      } : prev);
    } catch { addToast({ title: 'Failed to claim reward', variant: 'error' }); }
  };

  if (!data) return null;

  const weekDays = data.weekRewards?.length
    ? data.weekRewards
    : Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        reward: (i + 1) * 10,
        claimed: i < (data.streak % 7),
      }));

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium flex items-center gap-2">
          <Gift className="w-5 h-5 text-yellow-400" /> Daily Login Rewards
        </h3>
        <div className="flex items-center gap-1.5 text-orange-400">
          <Flame className="w-4 h-4" />
          <span className="text-sm font-medium">{data.streak} day streak</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-4">
        {weekDays.map((day, i) => (
          <div
            key={i}
            className={`flex flex-col items-center p-2 rounded-lg border ${
              day.claimed
                ? 'bg-green-900/30 border-green-700'
                : i === (data.streak % 7) && data.canClaim
                ? 'bg-yellow-900/30 border-yellow-600 animate-pulse'
                : 'bg-gray-800 border-gray-700'
            }`}
          >
            <span className="text-xs text-gray-400 mb-1">Day {day.day}</span>
            {day.claimed ? (
              <Check className="w-5 h-5 text-green-400" />
            ) : (
              <Coins className="w-5 h-5 text-yellow-400" />
            )}
            <span className="text-xs text-gray-300 mt-1">+{day.reward}</span>
          </div>
        ))}
      </div>

      {data.canClaim ? (
        <button
          onClick={claim}
          className="w-full py-2.5 bg-yellow-600 hover:bg-yellow-500 text-white font-medium rounded-lg flex items-center justify-center gap-2"
        >
          <Gift className="w-4 h-4" /> Claim Today's Reward (+{data.todayReward || weekDays[data.streak % 7]?.reward || 10} coins)
        </button>
      ) : (
        <div className="text-center text-sm text-gray-500 py-2">
          Already claimed today. Come back tomorrow!
        </div>
      )}
    </div>
  );
}
