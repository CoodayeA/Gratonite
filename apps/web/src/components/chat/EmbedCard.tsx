import React, { useState } from 'react';

export interface OgEmbed {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

interface Props {
  embed: OgEmbed;
}

export function EmbedCard({ embed }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="embed-card">
      <div className="embed-card-inner">
        <div className="embed-card-content">
          {embed.siteName && <div className="embed-site-name">{embed.siteName}</div>}
          {embed.title && (
            <a href={embed.url} target="_blank" rel="noopener noreferrer" className="embed-title">
              {embed.title}
            </a>
          )}
          {embed.description && <div className="embed-description">{embed.description}</div>}
        </div>
        {embed.image && (
          <div className="embed-image-wrap">
            <img src={embed.image} alt="" className="embed-image" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        )}
      </div>
      <button className="embed-dismiss" onClick={() => setDismissed(true)} title="Dismiss">&times;</button>
    </div>
  );
}
