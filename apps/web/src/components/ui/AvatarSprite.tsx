import type { AvatarSpriteConfig } from '@/lib/avatarStudio';

interface AvatarSpriteProps {
  config: AvatarSpriteConfig;
  size?: number;
  className?: string;
}

function HairLayer({ style, color }: { style: AvatarSpriteConfig['hairStyle']; color: string }) {
  if (style === 'long') {
    return <path d="M22 35c2-14 14-24 28-24s26 10 28 24v34H64V39H36v30H22V35z" fill={color} />;
  }
  if (style === 'spike') {
    return <path d="M20 36l8-18 10 10 12-16 10 16 12-10 8 18v8H20v-8z" fill={color} />;
  }
  return <path d="M24 34c0-14 12-24 26-24s26 10 26 24v8H24v-8z" fill={color} />;
}

function FaceLayer({ style }: { style: AvatarSpriteConfig['faceStyle'] }) {
  if (style === 'wink') {
    return (
      <>
        <circle cx="44" cy="34" r="2.2" fill="#1b1f2a" />
        <path d="M54 34h6" stroke="#1b1f2a" strokeWidth="2" strokeLinecap="round" />
        <path d="M43 44c3 4 11 4 14 0" stroke="#1b1f2a" strokeWidth="2" fill="none" strokeLinecap="round" />
      </>
    );
  }
  if (style === 'neutral') {
    return (
      <>
        <circle cx="43" cy="34" r="2.2" fill="#1b1f2a" />
        <circle cx="57" cy="34" r="2.2" fill="#1b1f2a" />
        <path d="M45 44h10" stroke="#1b1f2a" strokeWidth="2" strokeLinecap="round" />
      </>
    );
  }
  return (
    <>
      <circle cx="43" cy="34" r="2.2" fill="#1b1f2a" />
      <circle cx="57" cy="34" r="2.2" fill="#1b1f2a" />
      <path d="M43 43c3 4 11 4 14 0" stroke="#1b1f2a" strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  );
}

function HatLayer({ style }: { style: AvatarSpriteConfig['hatStyle'] }) {
  if (style === 'beanie') {
    return (
      <>
        <path d="M27 24c0-12 10-18 23-18s23 6 23 18v7H27v-7z" fill="#30384d" />
        <rect x="27" y="27" width="46" height="8" rx="3" fill="#1e2535" />
      </>
    );
  }
  if (style === 'crown') {
    return <path d="M30 30l8-11 12 10 12-10 8 11v6H30v-6z" fill="#f8c84c" />;
  }
  return null;
}

function AccessoryLayer({ style }: { style: AvatarSpriteConfig['accessoryStyle'] }) {
  if (style === 'glasses') {
    return (
      <>
        <rect x="37" y="30" width="10" height="8" rx="2" fill="none" stroke="#1b1f2a" strokeWidth="1.8" />
        <rect x="53" y="30" width="10" height="8" rx="2" fill="none" stroke="#1b1f2a" strokeWidth="1.8" />
        <path d="M47 34h6" stroke="#1b1f2a" strokeWidth="1.8" />
      </>
    );
  }
  if (style === 'star') {
    return <path d="M63 42l2 4 4 .6-3 2.8.8 4-3.8-2-3.8 2 .8-4-3-2.8 4-.6z" fill="#ffd75a" />;
  }
  return null;
}

export function AvatarSprite({ config, size = 56, className }: AvatarSpriteProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="2D avatar sprite"
    >
      <rect x="0" y="0" width="100" height="100" rx="20" fill="rgba(6,10,18,0.35)" />
      <rect x="36" y="50" width="28" height="26" rx="8" fill={config.topColor} />
      <rect x="36" y="76" width="12" height="14" rx="3" fill={config.bottomColor} />
      <rect x="52" y="76" width="12" height="14" rx="3" fill={config.bottomColor} />
      <ellipse cx="43" cy="91" rx="8" ry="4" fill={config.shoesColor} />
      <ellipse cx="57" cy="91" rx="8" ry="4" fill={config.shoesColor} />
      <circle cx="50" cy="35" r="18" fill={config.skinTone} />
      <HairLayer style={config.hairStyle} color={config.hairColor} />
      <HatLayer style={config.hatStyle} />
      <FaceLayer style={config.faceStyle} />
      <AccessoryLayer style={config.accessoryStyle} />
    </svg>
  );
}
