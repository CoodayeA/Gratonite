import { useState, useEffect } from 'react';
import { Tags, Users, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface MatchedUser {
  userId: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
  sharedTags: string[];
  overlapCount: number;
}

interface InterestTagPickerProps {
  guildId?: string;
}

export default function InterestTagPicker({ guildId }: InterestTagPickerProps) {
  const { addToast } = useToast();
  const [allTags, setAllTags] = useState<Record<string, Array<{ tag: string; icon: string | null }>>>({});
  const [myTags, setMyTags] = useState<Set<string>>(new Set());
  const [matches, setMatches] = useState<MatchedUser[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTags();
    loadMyInterests();
  }, []);

  useEffect(() => {
    if (guildId) loadMatches();
  }, [guildId, myTags.size]);

  async function loadTags() {
    try {
      const data = await api.get<Record<string, Array<{ tag: string; icon: string | null }>>>('/interest-tags');
      setAllTags(data);
    } catch { /* ignore */ }
  }

  async function loadMyInterests() {
    try {
      const data = await api.get<string[]>('/users/@me/interests');
      setMyTags(new Set(data));
    } catch { /* ignore */ }
  }

  async function loadMatches() {
    if (!guildId) return;
    try {
      const data = await api.get<MatchedUser[]>(`/guilds/${guildId}/interest-matches`);
      setMatches(data);
    } catch { /* ignore */ }
  }

  async function toggleTag(tag: string) {
    const updated = new Set(myTags);
    if (updated.has(tag)) {
      updated.delete(tag);
    } else {
      updated.add(tag);
    }
    setMyTags(updated);

    setSaving(true);
    try {
      await api.put('/users/@me/interests', { tags: Array.from(updated) });
    } catch {
      addToast({ title: 'Failed to save interests', variant: 'error' });
      setMyTags(myTags); // revert
    } finally {
      setSaving(false);
    }
  }

  const categories = Object.keys(allTags);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-zinc-100">
        <Tags className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Your Interests</h3>
        {saving && <span className="text-xs text-zinc-400">Saving...</span>}
      </div>

      <div className="space-y-4">
        {categories.map((category) => (
          <div key={category}>
            <h4 className="text-sm font-medium text-zinc-400 mb-2">{category}</h4>
            <div className="flex flex-wrap gap-2">
              {allTags[category].map(({ tag }) => {
                const selected = myTags.has(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      selected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {guildId && matches.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-zinc-700">
          <div className="flex items-center gap-2 text-zinc-100">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            <h4 className="text-sm font-semibold">People Like You</h4>
          </div>

          <div className="space-y-2">
            {matches.map((match) => (
              <div key={match.userId} className="flex items-center gap-3 bg-zinc-800/40 rounded-lg p-2">
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
                  {match.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-100 truncate">{match.displayName}</div>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {match.sharedTags.map((tag) => (
                      <span key={tag} className="text-xs bg-indigo-600/30 text-indigo-300 rounded-full px-1.5 py-0.5">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-zinc-400">
                  <Users className="w-3 h-3" />
                  {match.overlapCount}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
