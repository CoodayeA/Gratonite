import React, { useState, useRef, useEffect } from 'react';
import { Play, ExternalLink } from 'lucide-react';

export interface OgEmbed {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

interface Props {
  embed: OgEmbed;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function getFaviconUrl(url: string): string {
  try {
    const origin = new URL(url).origin;
    return `${origin}/favicon.ico`;
  } catch {
    return '';
  }
}

// ─── YouTube detection ────────────────────────────────────────────────────────
function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') && u.searchParams.has('v')) return u.searchParams.get('v');
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (u.hostname.includes('youtube.com') && u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null;
  } catch { /* ignore */ }
  return null;
}

// ─── Twitter/X detection ──────────────────────────────────────────────────────
function isTwitterUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h.includes('twitter.com') || h.includes('x.com');
  } catch { return false; }
}

// ─── Reddit detection ─────────────────────────────────────────────────────────
function isRedditUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h.includes('reddit.com') || h.includes('redd.it');
  } catch { return false; }
}

function getRedditInfo(url: string): { subreddit: string } | null {
  try {
    const match = new URL(url).pathname.match(/\/r\/([^/]+)/);
    return match ? { subreddit: `r/${match[1]}` } : null;
  } catch { return null; }
}

// ─── Media detection ──────────────────────────────────────────────────────────
function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
}

function isAudioUrl(url: string): boolean {
  return /\.(mp3|wav|ogg|flac|aac|m4a)(\?.*)?$/i.test(url);
}

// ─── Site accent colors ───────────────────────────────────────────────────────
function getSiteAccent(url: string, siteName?: string): string {
  const domain = extractDomain(url);
  const name = (siteName || domain).toLowerCase();
  if (name.includes('youtube') || domain.includes('youtube') || domain === 'youtu.be') return '#ff0000';
  if (name.includes('twitter') || name.includes('x.com') || domain.includes('twitter') || domain.includes('x.com')) return '#1d9bf0';
  if (name.includes('reddit') || domain.includes('reddit')) return '#ff4500';
  if (domain.includes('github')) return '#8b5cf6';
  if (domain.includes('twitch')) return '#9146ff';
  if (domain.includes('spotify')) return '#1db954';
  return 'var(--accent-primary)';
}

export function EmbedCard({ embed }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const [ytPlaying, setYtPlaying] = useState(false);
  if (dismissed) return null;

  const domain = extractDomain(embed.url);
  const faviconSrc = embed.favicon || getFaviconUrl(embed.url);
  const accent = getSiteAccent(embed.url, embed.siteName);
  const ytId = getYouTubeId(embed.url);
  const isTwitter = isTwitterUrl(embed.url);
  const isReddit = isRedditUrl(embed.url);
  const redditInfo = isReddit ? getRedditInfo(embed.url) : null;
  const isVideo = isVideoUrl(embed.url);
  const isAudio = isAudioUrl(embed.url);

  // YouTube embed
  if (ytId) {
    return (
      <div className="embed-card" style={{
        maxWidth: '480px',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid var(--stroke)',
        background: 'var(--bg-tertiary)',
        borderLeft: `3px solid ${accent}`,
        position: 'relative',
      }}>
        <div style={{ padding: '10px 14px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            {faviconSrc && !faviconError && (
              <img src={faviconSrc} width={14} height={14} alt="" style={{ borderRadius: '2px', flexShrink: 0 }} onError={() => setFaviconError(true)} />
            )}
            <span style={{ fontSize: '11px', color: accent, fontWeight: 600 }}>{embed.siteName || 'YouTube'}</span>
          </div>
          {embed.title && (
            <a href={embed.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--accent-primary)', textDecoration: 'none', lineHeight: '1.3' }}
              className="hover-underline">
              {embed.title}
            </a>
          )}
        </div>
        <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000', cursor: 'pointer' }} onClick={() => setYtPlaying(true)}>
          {ytPlaying ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none' }}
              title={embed.title || 'YouTube video'}
            />
          ) : (
            <>
              <img
                src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                alt={embed.title || 'Video thumbnail'}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.3)', transition: 'background 0.15s',
              }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: 'rgba(255,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }}>
                  <Play size={28} fill="white" color="white" style={{ marginLeft: '3px' }} />
                </div>
              </div>
            </>
          )}
        </div>
        <DismissButton onDismiss={() => setDismissed(true)} />
      </div>
    );
  }

  // Direct video link
  if (isVideo) {
    return (
      <div className="embed-card" style={{
        maxWidth: '480px', borderRadius: '8px', overflow: 'hidden',
        border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)',
        borderLeft: `3px solid ${accent}`, position: 'relative',
      }}>
        {embed.title && (
          <div style={{ padding: '10px 14px 8px' }}>
            <a href={embed.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent-primary)', textDecoration: 'none' }}>
              {embed.title}
            </a>
          </div>
        )}
        <video controls preload="metadata" style={{ width: '100%', maxHeight: '360px', display: 'block' }}>
          <source src={embed.url} />
        </video>
        <DismissButton onDismiss={() => setDismissed(true)} />
      </div>
    );
  }

  // Direct audio link
  if (isAudio) {
    return (
      <div className="embed-card" style={{
        maxWidth: '420px', borderRadius: '8px', overflow: 'hidden',
        border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)',
        borderLeft: `3px solid ${accent}`, position: 'relative', padding: '12px 14px',
      }}>
        {embed.title && (
          <a href={embed.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--accent-primary)', textDecoration: 'none', marginBottom: '8px' }}>
            {embed.title}
          </a>
        )}
        <audio controls preload="metadata" style={{ width: '100%' }}>
          <source src={embed.url} />
        </audio>
        <DismissButton onDismiss={() => setDismissed(true)} />
      </div>
    );
  }

  // Twitter/X card
  if (isTwitter) {
    return (
      <div className="embed-card" style={{
        maxWidth: '440px', borderRadius: '8px', overflow: 'hidden',
        border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)',
        borderLeft: `3px solid ${accent}`, position: 'relative',
      }}>
        <div style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={accent}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            <span style={{ fontSize: '12px', color: accent, fontWeight: 600 }}>{embed.siteName || 'X (Twitter)'}</span>
            <a href={embed.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
              <ExternalLink size={12} />
            </a>
          </div>
          {embed.description && (
            <div style={{
              fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.5',
              display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              marginBottom: embed.image ? '8px' : '0',
            }}>
              {embed.description}
            </div>
          )}
          {!embed.description && embed.title && (
            <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.5', marginBottom: embed.image ? '8px' : '0' }}>
              {embed.title}
            </div>
          )}
        </div>
        {embed.image && (
          <div style={{ maxHeight: '280px', overflow: 'hidden' }}>
            <img src={embed.image} alt={embed.title || ''} loading="lazy" style={{ width: '100%', objectFit: 'cover', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        )}
        <DismissButton onDismiss={() => setDismissed(true)} />
      </div>
    );
  }

  // Reddit card
  if (isReddit) {
    return (
      <div className="embed-card" style={{
        maxWidth: '440px', borderRadius: '8px', overflow: 'hidden',
        border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)',
        borderLeft: `3px solid ${accent}`, position: 'relative',
      }}>
        <div style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={accent}><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 0-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" /></svg>
            <span style={{ fontSize: '12px', color: accent, fontWeight: 600 }}>
              {redditInfo?.subreddit || embed.siteName || 'Reddit'}
            </span>
            <a href={embed.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
              <ExternalLink size={12} />
            </a>
          </div>
          {embed.title && (
            <a href={embed.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none', lineHeight: '1.3', marginBottom: '4px' }}
              className="hover-underline">
              {embed.title}
            </a>
          )}
          {embed.description && (
            <div style={{
              fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4',
              display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {embed.description}
            </div>
          )}
        </div>
        {embed.image && (
          <div style={{ maxHeight: '300px', overflow: 'hidden' }}>
            <img src={embed.image} alt={embed.title || ''} loading="lazy" style={{ width: '100%', objectFit: 'cover', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        )}
        <DismissButton onDismiss={() => setDismissed(true)} />
      </div>
    );
  }

  // Default embed card (enhanced)
  return (
    <div className="embed-card" style={{
      maxWidth: '480px',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid var(--stroke)',
      background: 'var(--bg-tertiary)',
      borderLeft: `3px solid ${accent}`,
      position: 'relative',
    }}>
      <div className="embed-card-inner" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="embed-card-content" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            {faviconSrc && !faviconError && (
              <img src={faviconSrc} width={14} height={14} alt="" style={{ borderRadius: '2px', flexShrink: 0 }} onError={() => setFaviconError(true)} />
            )}
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
              {embed.siteName || domain}
            </span>
          </div>
          {embed.title && (
            <a href={embed.url} target="_blank" rel="noopener noreferrer" className="embed-title" style={{
              display: 'block', fontSize: '14px', fontWeight: 600,
              color: 'var(--accent-primary)', textDecoration: 'none',
              marginBottom: '4px', lineHeight: '1.3',
            }}
              className="hover-underline">
              {embed.title}
            </a>
          )}
          {embed.description && (
            <div style={{
              fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4',
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {embed.description}
            </div>
          )}
        </div>
        {embed.image && (
          <div style={{ maxHeight: '300px', overflow: 'hidden' }}>
            <img src={embed.image} alt={embed.title || embed.url} loading="lazy" style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
            }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        )}
      </div>
      <DismissButton onDismiss={() => setDismissed(true)} />
    </div>
  );
}

function DismissButton({ onDismiss }: { onDismiss: () => void }) {
  return (
    <button
      onClick={onDismiss}
      title="Dismiss"
      style={{
        position: 'absolute', top: '8px', right: '8px',
        background: 'rgba(0,0,0,0.3)', border: 'none',
        borderRadius: '50%', width: '20px', height: '20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: 'white', fontSize: '14px',
        opacity: 0.6, transition: 'opacity 0.15s',
      }}
      className="hover-opacity-full"
    >
      &times;
    </button>
  );
}

/**
 * Wrapper that defers rendering of EmbedCard until it enters the viewport.
 * Uses IntersectionObserver with a generous rootMargin so embeds load
 * slightly before they become visible during scrolling.
 */
export function LazyEmbed({ embed }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (visible) return <EmbedCard embed={embed} />;

  // Placeholder with approximate height to prevent layout shift
  return (
    <div
      ref={ref}
      className="embed-card"
      style={{
        maxWidth: '480px',
        minHeight: '80px',
        borderRadius: '8px',
        border: '1px solid var(--stroke)',
        background: 'var(--bg-tertiary)',
        borderLeft: '3px solid var(--accent-primary)',
      }}
    />
  );
}
