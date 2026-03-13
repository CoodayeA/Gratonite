import React, { useState } from 'react';

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

export function EmbedCard({ embed }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  if (dismissed) return null;

  const domain = extractDomain(embed.url);
  const faviconSrc = embed.favicon || getFaviconUrl(embed.url);

  return (
    <div className="embed-card" style={{
      maxWidth: '420px',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid var(--stroke)',
      background: 'var(--bg-tertiary)',
      borderLeft: '3px solid var(--accent-primary)',
      transition: 'border-color 0.15s',
      position: 'relative',
    }}>
      <div className="embed-card-inner" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="embed-card-content" style={{ padding: '12px 14px' }}>
          {/* Site name with favicon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            {faviconSrc && !faviconError && (
              <img
                src={faviconSrc}
                width={14}
                height={14}
                alt=""
                style={{ borderRadius: '2px', flexShrink: 0 }}
                onError={() => setFaviconError(true)}
              />
            )}
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
              {embed.siteName || domain}
            </span>
          </div>
          {embed.title && (
            <a
              href={embed.url}
              target="_blank"
              rel="noopener noreferrer"
              className="embed-title"
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--accent-primary)',
                textDecoration: 'none',
                marginBottom: '4px',
                lineHeight: '1.3',
              }}
              onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseOut={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              {embed.title}
            </a>
          )}
          {embed.description && (
            <div style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              lineHeight: '1.4',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {embed.description}
            </div>
          )}
        </div>
        {embed.image && (
          <div style={{
            maxHeight: '200px',
            overflow: 'hidden',
          }}>
            <img
              src={embed.image}
              alt={embed.title || embed.url}
              loading="lazy"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        title="Dismiss"
        style={{
          position: 'absolute', top: '8px', right: '8px',
          background: 'rgba(0,0,0,0.3)', border: 'none',
          borderRadius: '50%', width: '20px', height: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'white', fontSize: '14px',
          opacity: 0.6, transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
      >
        &times;
      </button>
    </div>
  );
}
