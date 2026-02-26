import React from 'react';

/* ── CSS variable design tokens ─────────────────────────────────────── */
const V = {
  bgElevated: 'var(--bg-elevated, #353348)',
  bgSoft: 'var(--bg-soft, #413d58)',
  stroke: 'var(--stroke, #4a4660)',
  radiusLg: 'var(--radius-lg, 12px)',
} as const;

/* ── Inline style objects ───────────────────────────────────────────── */

const skeletonBase = {
  background: `linear-gradient(90deg, ${V.bgSoft} 25%, ${V.bgElevated} 50%, ${V.bgSoft} 75%)`,
  backgroundSize: '200% 100%',
  animation: 'skeleton-pulse 1.5s ease-in-out infinite',
} as React.CSSProperties;

const skeletonTextStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
} as React.CSSProperties;

const skeletonCardStyle = {
  padding: 16,
  background: V.bgSoft,
  borderRadius: V.radiusLg,
} as React.CSSProperties;

const skeletonCardHeaderStyle = {
  display: 'flex',
  gap: 12,
  marginBottom: 16,
} as React.CSSProperties;

const skeletonCardHeaderTextStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  justifyContent: 'center',
} as React.CSSProperties;

const skeletonListStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
} as React.CSSProperties;

const skeletonListItemStyle = {
  display: 'flex',
  gap: 12,
  alignItems: 'center',
} as React.CSSProperties;

const skeletonListItemContentStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
} as React.CSSProperties;

const skeletonTableStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
} as React.CSSProperties;

const skeletonTableHeaderStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 12,
  paddingBottom: 8,
  borderBottom: `1px solid ${V.stroke}`,
} as React.CSSProperties;

const skeletonTableRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 12,
} as React.CSSProperties;

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 4, className = '' }: SkeletonProps) {
  return (
    <div
      className={className || undefined}
      style={{
        ...skeletonBase,
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
      }}
    />
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div style={skeletonTextStyle}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '70%' : '100%'}
          height={16}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return <Skeleton width={size} height={size} borderRadius="50%" />;
}

export function SkeletonCard() {
  return (
    <div style={skeletonCardStyle}>
      <div style={skeletonCardHeaderStyle}>
        <SkeletonAvatar size={48} />
        <div style={skeletonCardHeaderTextStyle}>
          <Skeleton width={120} height={16} />
          <Skeleton width={80} height={12} />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div style={skeletonListStyle}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={skeletonListItemStyle}>
          <SkeletonAvatar size={40} />
          <div style={skeletonListItemContentStyle}>
            <Skeleton width="40%" height={14} />
            <Skeleton width="60%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonButton() {
  return <Skeleton width={100} height={36} borderRadius={6} />;
}

export function SkeletonInput() {
  return <Skeleton width="100%" height={40} borderRadius={6} />;
}

export function SkeletonImage({ width = '100%', height = 200 }: { width?: string | number; height?: string | number }) {
  return <Skeleton width={width} height={height} borderRadius={8} />;
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  const headerStyle = columns !== 4
    ? { ...skeletonTableHeaderStyle, gridTemplateColumns: `repeat(${columns}, 1fr)` } as React.CSSProperties
    : skeletonTableHeaderStyle;
  const rowStyle = columns !== 4
    ? { ...skeletonTableRowStyle, gridTemplateColumns: `repeat(${columns}, 1fr)` } as React.CSSProperties
    : skeletonTableRowStyle;

  return (
    <div style={skeletonTableStyle}>
      <div style={headerStyle}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} height={16} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowI) => (
        <div key={rowI} style={rowStyle}>
          {Array.from({ length: columns }).map((_, colI) => (
            <Skeleton key={colI} height={14} />
          ))}
        </div>
      ))}
    </div>
  );
}
