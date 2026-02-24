import { readNotificationSoundPrefs } from './notificationSoundPrefs';

const audioCache = new Map<string, HTMLAudioElement>();

export type SoundName =
  | 'ringtone'
  | 'outgoing-ring'
  | 'call-connect'
  | 'call-end'
  | 'message'
  | 'mention'
  | 'dm';

function getAudio(name: SoundName): HTMLAudioElement {
  let el = audioCache.get(name);
  if (!el) {
    el = new Audio(`/sounds/${name}.wav`);
    audioCache.set(name, el);
  }
  return el;
}

/** Play a sound. Looping sounds (ringtone, outgoing-ring) repeat until stopped. */
export function playSound(name: SoundName): void {
  const prefs = readNotificationSoundPrefs();
  if (!prefs.enabled) return;
  if (!prefs.sounds[name]) return;

  const el = getAudio(name);
  el.loop = name === 'ringtone' || name === 'outgoing-ring';
  el.volume = Math.max(0, Math.min(1, prefs.volume / 100));
  el.currentTime = 0;
  el.play().catch(() => {});
}

/** Stop a specific sound. */
export function stopSound(name: SoundName): void {
  const el = audioCache.get(name);
  if (el) {
    el.pause();
    el.currentTime = 0;
    el.loop = false;
  }
}

/** Stop all currently playing sounds. */
export function stopAllSounds(): void {
  for (const el of audioCache.values()) {
    el.pause();
    el.currentTime = 0;
    el.loop = false;
  }
}
