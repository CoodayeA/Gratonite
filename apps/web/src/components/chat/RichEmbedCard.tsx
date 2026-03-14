import React from 'react';

export interface RichEmbed {
  type?: 'rich';
  title?: string;
  description?: string;
  color?: string;
  url?: string;
  thumbnail?: string;
  footer?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

interface Props {
  embed: RichEmbed;
}

export function RichEmbedCard({ embed }: Props) {
  const accentColor = embed.color || 'var(--accent-primary)';

  return (
    <div style={{
      maxWidth: '520px',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid var(--stroke)',
      background: 'var(--bg-tertiary)',
      borderLeft: `4px solid ${accentColor}`,
      padding: '12px 16px',
      display: 'flex',
      gap: '16px',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title */}
        {embed.title && (
          embed.url ? (
            <a
              href={embed.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                fontSize: '16px',
                fontWeight: 700,
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
          ) : (
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', lineHeight: '1.3' }}>
              {embed.title}
            </div>
          )
        )}

        {/* Description */}
        {embed.description && (
          <div style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: '1.5',
            marginBottom: embed.fields && embed.fields.length > 0 ? '8px' : '0',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {embed.description}
          </div>
        )}

        {/* Fields grid */}
        {embed.fields && embed.fields.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '8px',
            marginTop: '4px',
          }}>
            {embed.fields.map((field, i) => (
              <div
                key={i}
                style={{
                  gridColumn: field.inline ? undefined : '1 / -1',
                  minWidth: 0,
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                  {field.name}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4', wordBreak: 'break-word' }}>
                  {field.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {embed.footer && (
          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: '8px',
            fontWeight: 500,
          }}>
            {embed.footer}
          </div>
        )}
      </div>

      {/* Thumbnail */}
      {embed.thumbnail && (
        <div style={{ flexShrink: 0 }}>
          <img
            src={embed.thumbnail}
            alt=""
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '6px',
              objectFit: 'cover',
            }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
    </div>
  );
}
