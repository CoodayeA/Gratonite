/**
 * 135. Reputation System — Upvote/downvote messages, display user reputation.
 */
import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, TrendingUp, Star } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

/** Inline upvote/downvote buttons for a message */
export function MessageReputation({
  channelId,
  messageId,
  initialUpvotes = 0,
  initialDownvotes = 0,
}: {
  channelId: string;
  messageId: string;
  initialUpvotes?: number;
  initialDownvotes?: number;
}) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const [voted, setVoted] = useState<'up' | 'down' | null>(null);
  const { addToast } = useToast();

  const vote = async (direction: 'up' | 'down') => {
    if (voted === direction) return; // Already voted this way
    try {
      const value = direction === 'up' ? 1 : -1;
      const result = await api.reputation.upvote(channelId, messageId, value);
      setUpvotes(result.upvotes);
      setDownvotes(result.downvotes);
      setVoted(direction);
    } catch { addToast({ title: 'Failed to vote', variant: 'error' }); }
  };

  const score = upvotes - downvotes;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => vote('up')}
        className={`p-0.5 rounded transition-colors ${
          voted === 'up' ? 'text-green-400' : 'text-gray-500 hover:text-green-400'
        }`}
        title="Upvote"
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <span className={`text-xs font-medium min-w-[1.5rem] text-center ${
        score > 0 ? 'text-green-400' : score < 0 ? 'text-red-400' : 'text-gray-500'
      }`}>
        {score > 0 ? `+${score}` : score}
      </span>
      <button
        onClick={() => vote('down')}
        className={`p-0.5 rounded transition-colors ${
          voted === 'down' ? 'text-red-400' : 'text-gray-500 hover:text-red-400'
        }`}
        title="Downvote"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/** User reputation badge for profiles/member lists */
export function UserReputationBadge({ userId }: { userId: string }) {
  const [rep, setRep] = useState<{ reputation: number; upvotes: number; downvotes: number } | null>(null);

  useEffect(() => {
    api.reputation.getUserReputation(userId).then(setRep).catch(() => {});
  }, [userId]);

  if (!rep) return null;

  const tier = rep.reputation >= 100 ? { label: 'Trusted', color: '#22c55e', icon: Star } :
               rep.reputation >= 50 ? { label: 'Respected', color: '#3b82f6', icon: TrendingUp } :
               rep.reputation >= 10 ? { label: 'Known', color: '#6366f1', icon: TrendingUp } :
               null;

  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs font-medium ${
        rep.reputation > 0 ? 'text-green-400' : rep.reputation < 0 ? 'text-red-400' : 'text-gray-500'
      }`}>
        {rep.reputation > 0 ? '+' : ''}{rep.reputation} rep
      </span>
      {tier && (
        <span
          className="text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5"
          style={{ backgroundColor: `${tier.color}15`, color: tier.color }}
        >
          <tier.icon className="w-3 h-3" />
          {tier.label}
        </span>
      )}
    </div>
  );
}

/** Full reputation card for profile page */
export function ReputationCard({ userId }: { userId: string }) {
  const [rep, setRep] = useState<{ reputation: number; upvotes: number; downvotes: number } | null>(null);

  useEffect(() => {
    api.reputation.getUserReputation(userId).then(setRep).catch(() => {});
  }, [userId]);

  if (!rep) return null;

  const percentage = rep.upvotes + rep.downvotes > 0
    ? Math.round((rep.upvotes / (rep.upvotes + rep.downvotes)) * 100)
    : 0;

  return (
    <div className="p-3 bg-gray-800 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="w-4 h-4 text-indigo-400" />
        <span className="text-sm text-white font-medium">Reputation</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className={`text-lg font-bold ${rep.reputation >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {rep.reputation >= 0 ? '+' : ''}{rep.reputation}
          </p>
          <p className="text-xs text-gray-500">score</p>
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <ThumbsUp className="w-3 h-3 text-green-400" />
            <span className="text-gray-400">{rep.upvotes} upvotes</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <ThumbsDown className="w-3 h-3 text-red-400" />
            <span className="text-gray-400">{rep.downvotes} downvotes</span>
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${percentage}%` }} />
          </div>
          <p className="text-xs text-gray-500">{percentage}% positive</p>
        </div>
      </div>
    </div>
  );
}
