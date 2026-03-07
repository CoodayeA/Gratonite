/**
 * cosmetics.ts — Shared helper for applying equipped shop items visually.
 * Handles localStorage writes + event dispatches for all item types.
 * Both Inventory.tsx and Shop.tsx import this to avoid duplication.
 */

export function applyEquippedItem(
  type: string,
  assetConfig: Record<string, unknown> | null | undefined,
  userId: string,
): void {
  const cfg = (assetConfig ?? {}) as Record<string, unknown>;

  if (type === 'avatar_frame') {
    const frame = (cfg.frameStyle as string) ?? 'neon';
    const color = cfg.glowColor as string | undefined;
    try {
      localStorage.setItem(`gratonite-avatar-frame:${userId}`, frame);
      localStorage.setItem('gratonite-avatar-frame', frame);
      if (color) {
        localStorage.setItem(`gratonite-avatar-frame-color:${userId}`, color);
        localStorage.setItem('gratonite-avatar-frame-color', color);
      } else {
        localStorage.removeItem(`gratonite-avatar-frame-color:${userId}`);
        localStorage.removeItem('gratonite-avatar-frame-color');
      }
    } catch { /* ignore */ }
    window.dispatchEvent(
      new CustomEvent('gratonite:avatar-frame-updated', { detail: { frame, glowColor: color } }),
    );
  }

  if (type === 'nameplate') {
    const style = (cfg.nameplateStyle as string) ?? 'none';
    try {
      localStorage.setItem(`gratonite-nameplate-style:${userId}`, style);
      localStorage.setItem('gratonite-nameplate-style', style);
    } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('gratonite:nameplate-updated', { detail: { style } }));
  }

  if (type === 'profile_effect') {
    const effectType = (cfg.effectType as string) ?? 'gradient-pulse';
    try {
      localStorage.setItem(`gratonite-profile-effect:${userId}`, effectType);
      localStorage.setItem('gratonite-profile-effect', effectType);
    } catch { /* ignore */ }
  }

  window.dispatchEvent(new Event('gratonite:cosmetics-updated'));
}

export function clearEquippedItem(type: string, userId: string): void {
  if (type === 'avatar_frame') {
    try {
      localStorage.setItem(`gratonite-avatar-frame:${userId}`, 'none');
      localStorage.setItem('gratonite-avatar-frame', 'none');
      localStorage.removeItem(`gratonite-avatar-frame-color:${userId}`);
      localStorage.removeItem('gratonite-avatar-frame-color');
    } catch { /* ignore */ }
    window.dispatchEvent(
      new CustomEvent('gratonite:avatar-frame-updated', { detail: { frame: 'none' } }),
    );
  }

  if (type === 'nameplate') {
    try {
      localStorage.setItem(`gratonite-nameplate-style:${userId}`, 'none');
      localStorage.setItem('gratonite-nameplate-style', 'none');
    } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('gratonite:nameplate-updated', { detail: { style: 'none' } }));
  }

  if (type === 'profile_effect') {
    try {
      localStorage.removeItem(`gratonite-profile-effect:${userId}`);
      localStorage.removeItem('gratonite-profile-effect');
    } catch { /* ignore */ }
  }

  window.dispatchEvent(new Event('gratonite:cosmetics-updated'));
}
