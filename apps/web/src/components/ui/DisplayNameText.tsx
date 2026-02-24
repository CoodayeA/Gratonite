import { useEffect, useState, type CSSProperties } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import {
  getEffectiveDisplayNameStyle,
  readDisplayNameStylePrefs,
  subscribeDisplayNameStyleChanges,
} from '@/lib/displayNameStyles';
import { getNameplateById, subscribeProfileCosmeticsChanges } from '@/lib/profileCosmetics';

interface DisplayNameTextProps {
  text: string;
  userId?: string | null;
  guildId?: string | null;
  className?: string;
  context?: 'profile' | 'server' | 'dm_message' | 'dm_list';
}

export function DisplayNameText({
  text,
  userId,
  guildId,
  className = '',
  context = 'profile',
}: DisplayNameTextProps) {
  const currentUser = useAuthStore((s) => s.user);
  const currentUserId = currentUser?.id;
  const [version, setVersion] = useState(0);

  useEffect(() => subscribeDisplayNameStyleChanges(() => setVersion((v) => v + 1)), []);
  useEffect(() => subscribeProfileCosmeticsChanges(() => setVersion((v) => v + 1)), []);

  if (!currentUserId || !userId || currentUserId !== userId) {
    return <span className={className}>{text}</span>;
  }

  const prefs = readDisplayNameStylePrefs(currentUserId);
  const nameplate = getNameplateById(currentUser?.nameplateId);
  const nameplateStyle =
    nameplate?.assetHash
      ? ({ '--nameplate-image': `url(/api/v1/files/${nameplate.assetHash})` } as CSSProperties)
      : undefined;
  if (!prefs.stylesEnabled) {
    return (
      <span
        style={nameplateStyle}
        className={[nameplate ? 'display-name-nameplate nameplate-from-asset' : '', className].filter(Boolean).join(' ')}
      >
        {text}
      </span>
    );
  }

  const style = getEffectiveDisplayNameStyle(prefs, guildId);
  const isServerContext = context === 'server';

  return (
    <span
      key={version}
      className={[
        'display-name-style',
        `dns-font-${style.font}`,
        isServerContext ? '' : `dns-effect-${style.effect}`,
        context === 'dm_message' ? 'dns-message-context' : '',
        nameplate ? 'display-name-nameplate nameplate-from-asset' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={{
        '--dns-color-a': style.colorA,
        '--dns-color-b': style.colorB,
        ...(nameplateStyle ?? {}),
      } as CSSProperties}
      data-dns-context={context}
    >
      {text}
    </span>
  );
}
