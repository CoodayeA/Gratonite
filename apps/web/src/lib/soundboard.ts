import { readSoundboardPrefs } from './soundboardPrefs';

export interface CachedSoundboardSound {
  id: string;
  guildId: string;
  name: string;
  soundHash: string;
  volume: number;
  emojiName?: string | null;
  uploaderId?: string;
}

const soundboardByGuild = new Map<string, Map<string, CachedSoundboardSound>>();
let currentAudio: HTMLAudioElement | null = null;

export function cacheSoundboardSounds(guildId: string, sounds: CachedSoundboardSound[]) {
  const map = new Map<string, CachedSoundboardSound>();
  for (const sound of sounds) map.set(sound.id, sound);
  soundboardByGuild.set(guildId, map);
}

export function upsertSoundboardSound(sound: CachedSoundboardSound) {
  const existing = soundboardByGuild.get(sound.guildId) ?? new Map<string, CachedSoundboardSound>();
  existing.set(sound.id, sound);
  soundboardByGuild.set(sound.guildId, existing);
}

export function removeSoundboardSound(guildId: string, soundId: string) {
  const existing = soundboardByGuild.get(guildId);
  if (!existing) return;
  existing.delete(soundId);
}

export function getCachedSoundboardSound(guildId: string, soundId: string): CachedSoundboardSound | null {
  return soundboardByGuild.get(guildId)?.get(soundId) ?? null;
}

export function stopSoundboardPlayback() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

export function playSoundboardClip(
  sound: { soundHash: string; volume?: number },
  options?: { previewOnly?: boolean; volumeScale?: number },
) {
  const prefs = readSoundboardPrefs();
  if (!prefs.enabled) return;
  stopSoundboardPlayback();
  const audio = new Audio(`/api/v1/files/${sound.soundHash}`);
  const base = Math.max(0, Math.min(1, (sound.volume ?? 1)));
  const pref = Math.max(0, Math.min(1, prefs.volume / 100));
  const scale = Math.max(0, Math.min(1, options?.volumeScale ?? 1));
  audio.volume = Math.max(0, Math.min(1, base * pref * scale));
  currentAudio = audio;
  audio.play().catch(() => {
    if (currentAudio === audio) currentAudio = null;
  });
  audio.addEventListener('ended', () => {
    if (currentAudio === audio) currentAudio = null;
  }, { once: true });
}

export function resolveEntranceSoundIdForGuild(guildId: string | null): string | null {
  const prefs = readSoundboardPrefs();
  if (!prefs.entranceEnabled) return null;
  if (guildId && guildId in prefs.entranceByGuild) return prefs.entranceByGuild[guildId] ?? null;
  return prefs.entranceGlobalSoundId;
}

