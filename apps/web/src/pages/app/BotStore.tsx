import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Star,
  Shield,
  Download,
  ChevronLeft,
  ChevronRight,
  Bot,
  CheckCircle2,
  Music,
  Gamepad2,
  Users,
  Wrench,
  Sparkles,
} from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';
import { getDeterministicGradient } from '../../utils/colors';

type Category = 'all' | 'moderation' | 'music' | 'fun' | 'utility' | 'social' | 'gaming';

type BotListing = {
  id: string;
  name: string;
  shortDesc: string;
  category: string;
  verified: boolean;
  rating: number;
  reviews: number;
  installs: number;
  developer: string;
  avatar: string;
  tags: string[];
  applicationId: string | null;
};

type BotReview = {
  id: string;
  rating: number;
  content: string;
  createdAt: string;
  authorName: string;
};

const categories: Array<{ id: Category; label: string; icon: any }> = [
  { id: 'all', label: 'All Bots', icon: Bot },
  { id: 'moderation', label: 'Moderation', icon: Shield },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'fun', label: 'Fun', icon: Sparkles },
  { id: 'utility', label: 'Utility', icon: Wrench },
  { id: 'social', label: 'Social', icon: Users },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2 },
];

const formatNumber = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const BotStore = () => {
  const { addToast } = useToast();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [allBots, setAllBots] = useState<BotListing[]>([]);
  const [selectedBot, setSelectedBot] = useState<BotListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [myGuilds, setMyGuilds] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGuildId, setSelectedGuildId] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);

  const [reviews, setReviews] = useState<BotReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadListings = async () => {
    const res = await api.botStore.list({ limit: 100 });
    const raw = res as unknown as { items?: unknown[] } | unknown[];
    const items: any[] = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' && 'items' in raw ? (raw.items ?? []) : []) as any[];

    const mapped: BotListing[] = items.flatMap((item: any) => {
      const id = typeof item.id === 'string' && item.id.trim() ? item.id : null;
      if (!id) return [];

      return [{
        id,
        name: item.name ?? item.applicationName ?? 'Unknown Bot',
        shortDesc: item.shortDescription ?? item.description ?? '',
        category: item.category ?? 'utility',
        verified: item.verified ?? false,
        rating: Number(item.rating ?? 0),
        reviews: Number(item.reviewCount ?? 0),
        installs: Number(item.installCount ?? 0),
        developer: item.developerName ?? item.developer ?? 'Unknown',
        avatar: item.iconUrl ?? getDeterministicGradient(id),
        tags: Array.isArray(item.tags) ? item.tags : [],
        applicationId: typeof item.applicationId === 'string' && item.applicationId.trim() ? item.applicationId : null,
      }];
    });

    setAllBots(mapped);
  };

  useEffect(() => {
    let active = true;

    (async () => {
      setIsLoading(true);
      try {
        const [_, guilds] = await Promise.all([
          loadListings(),
          api.guilds.getMine().catch(() => [] as Array<{ id: string; name: string }>),
        ]);

        if (!active) return;

        const guildOptions = (Array.isArray(guilds) ? guilds : []).map((g: any) => ({
          id: String(g.id),
          name: String(g.name ?? 'Unnamed Guild'),
        }));
        setMyGuilds(guildOptions);
        setSelectedGuildId(guildOptions[0]?.id ?? '');
      } catch {
        if (active) {
          addToast({ title: 'Failed to load bot store', description: 'Could not fetch listings.', variant: 'error' });
        }
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [addToast]);

  const loadReviews = async (listingId: string) => {
    setLoadingReviews(true);
    try {
      const res = await api.botStore.reviews(listingId, 50, 0);
      const rawReviews = res as unknown as { items?: unknown[] } | unknown[];
      const items: any[] = (Array.isArray(rawReviews) ? rawReviews : (rawReviews && typeof rawReviews === 'object' && 'items' in rawReviews ? (rawReviews.items ?? []) : [])) as any[];
      setReviews(items.flatMap((r: any) => {
        const id = typeof r.id === 'string' && r.id.trim() ? r.id : null;
        if (!id) return [];
        return [{
          id,
          rating: Number(r.rating ?? 0),
          content: r.content ?? '',
          createdAt: r.createdAt ?? new Date().toISOString(),
          authorName: r.author?.displayName ?? r.author?.username ?? 'Unknown',
        }];
      }));
    } catch {
      setReviews([]);
      addToast({ title: 'Failed to load reviews', variant: 'error' });
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    if (!selectedBot) return;
    loadReviews(selectedBot.id);
  }, [selectedBot?.id]);

  const filtered = useMemo(() => allBots.filter((b) => {
    if (activeCategory !== 'all' && b.category !== activeCategory) return false;
    if (verifiedOnly && !b.verified) return false;
    if (
      search &&
      !b.name.toLowerCase().includes(search.toLowerCase()) &&
      !b.shortDesc.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  }), [allBots, activeCategory, verifiedOnly, search]);

  const perPage = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const handleInstall = async () => {
    if (!selectedBot) return;
    if (!selectedBot.applicationId) {
      addToast({ title: 'Install unavailable', description: 'This listing is missing an application id.', variant: 'error' });
      return;
    }
    if (!selectedGuildId) {
      addToast({ title: 'Select a guild', description: 'Pick a target guild first.', variant: 'info' });
      return;
    }

    setIsInstalling(true);
    try {
      await api.botInstalls.install(selectedGuildId, selectedBot.applicationId);
      setAllBots((prev) => prev.map((bot) => bot.id === selectedBot.id ? { ...bot, installs: bot.installs + 1 } : bot));
      setSelectedBot((prev) => (prev ? { ...prev, installs: prev.installs + 1 } : prev));
      addToast({ title: 'Bot installed', description: `${selectedBot.name} was installed successfully.`, variant: 'success' });
    } catch (err: any) {
      const message = String(err?.message ?? 'Could not install bot.');
      if (message.toLowerCase().includes('already')) {
        addToast({ title: 'Already installed', description: `${selectedBot.name} is already installed in this guild.`, variant: 'info' });
      } else {
        addToast({ title: 'Install failed', description: message, variant: 'error' });
      }
    } finally {
      setIsInstalling(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedBot || !reviewText.trim()) return;
    setSubmittingReview(true);
    try {
      await api.botStore.postReview(selectedBot.id, { rating: reviewRating, content: reviewText.trim() });
      setReviewText('');
      setReviewRating(5);
      await Promise.all([loadReviews(selectedBot.id), loadListings()]);
      const refreshed = await api.botStore.get(selectedBot.id).catch(() => null) as Record<string, unknown> | null;
      if (refreshed) {
        setSelectedBot((prev) => prev ? {
          ...prev,
          rating: Number(refreshed.rating ?? prev.rating),
          reviews: Number(refreshed.reviewCount ?? prev.reviews),
          installs: Number(refreshed.installCount ?? prev.installs),
        } : prev);
      }
      addToast({ title: 'Review submitted', variant: 'success' });
    } catch (err: any) {
      addToast({ title: 'Review failed', description: String(err?.message ?? 'Could not post review.'), variant: 'error' });
    } finally {
      setSubmittingReview(false);
    }
  };

  if (selectedBot) {
    return (
      <div className="main-content-wrapper" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: '920px', margin: '0 auto', padding: '48px 24px', width: '100%' }}>
          <button onClick={() => setSelectedBot(null)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '32px', padding: 0 }}>
            <ChevronLeft size={16} /> Back to Bot Store
          </button>

          <div style={{ display: 'flex', gap: '24px', marginBottom: '28px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: selectedBot.avatar, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot size={36} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-display)', margin: 0 }}>{selectedBot.name}</h1>
                {selectedBot.verified && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--accent-blue)', background: 'rgba(59,130,246,0.1)', padding: '4px 10px', borderRadius: '12px' }}>
                    <CheckCircle2 size={14} /> Verified
                  </span>
                )}
              </div>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '10px' }}>{selectedBot.shortDesc}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Star size={14} color="#f59e0b" fill="#f59e0b" /> {selectedBot.rating.toFixed(1)}</span>
                <span>{formatNumber(selectedBot.reviews)} reviews</span>
                <span><Download size={14} style={{ verticalAlign: 'middle' }} /> {formatNumber(selectedBot.installs)} installs</span>
                <span>by {selectedBot.developer}</span>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>Install to portal</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <select
                value={selectedGuildId}
                onChange={(e) => setSelectedGuildId(e.target.value)}
                disabled={myGuilds.length === 0 || isInstalling}
                style={{ minWidth: '260px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', color: 'var(--text-primary)', padding: '10px 12px', fontSize: '14px' }}
              >
                {myGuilds.length === 0 ? (
                  <option value="">No portals available</option>
                ) : (
                  myGuilds.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)
                )}
              </select>
              <button
                onClick={handleInstall}
                disabled={isInstalling || !selectedBot.applicationId || !selectedGuildId}
                className="auth-button"
                style={{ margin: 0, width: 'auto', padding: '0 22px', height: '42px', opacity: isInstalling ? 0.7 : 1 }}
              >
                {isInstalling ? 'Installing…' : 'Install'}
              </button>
            </div>
            {!selectedBot.applicationId && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>This listing cannot be installed because it has no application id.</div>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
            {selectedBot.tags.map((tag) => (
              <span key={tag} style={{ padding: '4px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '12px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>{tag}</span>
            ))}
          </div>

          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '28px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '18px' }}>Write a Review</h3>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={24}
                  style={{ cursor: 'pointer', transition: 'transform 0.1s' }}
                  color={s <= (hoveredStar || reviewRating) ? '#f59e0b' : 'var(--text-muted)'}
                  fill={s <= (hoveredStar || reviewRating) ? '#f59e0b' : 'none'}
                  onMouseEnter={() => setHoveredStar(s)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => setReviewRating(s)}
                />
              ))}
            </div>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your experience with this bot..."
              style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '12px', color: 'var(--text-primary)', fontSize: '14px', resize: 'none', height: '100px', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            <button
              onClick={handleSubmitReview}
              disabled={submittingReview || !reviewText.trim()}
              className="auth-button"
              style={{ margin: '14px 0 0', width: 'auto', padding: '0 24px', height: '36px', opacity: submittingReview ? 0.7 : 1 }}
            >
              {submittingReview ? 'Submitting…' : 'Submit Review'}
            </button>
          </div>

          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '28px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '18px' }}>Recent Reviews</h3>
            {loadingReviews ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading reviews…</p>
            ) : reviews.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No reviews yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {reviews.map((r) => (
                  <div key={r.id} style={{ padding: '12px 14px', border: '1px solid var(--stroke)', borderRadius: '10px', background: 'var(--bg-tertiary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '10px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{r.authorName}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(r.createdAt)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '2px', marginBottom: '6px' }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={13} color={s <= r.rating ? '#f59e0b' : 'var(--text-muted)'} fill={s <= r.rating ? '#f59e0b' : 'none'} />
                      ))}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content-wrapper" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 24px', width: '100%' }}>
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '8px' }}>Bot Store</h1>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Discover and install bots to supercharge your portal.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search bots..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{ width: '100%', padding: '10px 12px 10px 36px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px' }}
            />
          </div>
          <button
            onClick={() => {
              setVerifiedOnly(!verifiedOnly);
              setPage(1);
            }}
            style={{ padding: '10px 16px', background: verifiedOnly ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-elevated)', border: `1px solid ${verifiedOnly ? 'var(--accent-blue)' : 'var(--stroke)'}`, borderRadius: '8px', color: verifiedOnly ? 'var(--accent-blue)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <CheckCircle2 size={14} /> Verified Only
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setPage(1);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  background: activeCategory === cat.id ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                  color: activeCategory === cat.id ? 'white' : 'var(--text-secondary)',
                  border: `1px solid ${activeCategory === cat.id ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                }}
              >
                <Icon size={14} /> {cat.label}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px', color: 'var(--text-muted)', gap: '12px', flexDirection: 'column' }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ width: '32px', height: '32px', border: '3px solid var(--stroke)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '14px' }}>Loading...</span>
          </div>
        ) : (
          <>
            {paginated.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                <Bot size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No bots found</p>
                <p style={{ fontSize: '13px' }}>Try different search terms or category filters.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                {paginated.map((bot) => (
                  <div
                    key={bot.id}
                    onClick={() => setSelectedBot(bot)}
                    onMouseEnter={() => setHoveredCard(bot.id)}
                    onMouseLeave={() => setHoveredCard(null)}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--stroke)',
                      borderRadius: '12px',
                      padding: '24px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      transform: hoveredCard === bot.id ? 'translateY(-2px)' : 'none',
                      boxShadow: hoveredCard === bot.id ? '0 8px 24px rgba(0,0,0,0.15)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: bot.avatar, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Bot size={24} color="white" />
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600, fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bot.name}</span>
                          {bot.verified && <CheckCircle2 size={14} color="var(--accent-blue)" />}
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>by {bot.developer}</span>
                      </div>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{bot.shortDesc}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Star size={12} color="#f59e0b" fill="#f59e0b" /> {bot.rating.toFixed(1)}
                        <span style={{ marginLeft: '4px' }}>({formatNumber(bot.reviews)})</span>
                      </div>
                      <span>{formatNumber(bot.installs)} installs</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} style={{ padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '8px', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: page === 1 ? 0.5 : 1 }}>
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)} style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid var(--stroke)', background: p === page ? 'var(--accent-primary)' : 'var(--bg-elevated)', color: p === page ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={{ padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '8px', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? 'var(--text-muted)' : 'var(--text-primary)', opacity: page === totalPages ? 0.5 : 1 }}>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BotStore;
