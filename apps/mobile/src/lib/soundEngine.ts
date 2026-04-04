import * as SecureStore from 'expo-secure-store';

// expo-av requires native linking — gracefully degrade if unavailable
let Audio: any = null;
try {
  Audio = require('expo-av').Audio;
} catch {
  // Native module not available (e.g. Expo Go without dev client)
}

export type SoundName =
  | 'messageSend'
  | 'messageReceive'
  | 'notification'
  | 'reaction'
  | 'uiClick'
  | 'uiToggle';

const SOUND_FILES: Record<string, Record<SoundName, any>> = {
  default: {
    messageSend: require('../../assets/sounds/default/messageSend.mp3'),
    messageReceive: require('../../assets/sounds/default/messageReceive.mp3'),
    notification: require('../../assets/sounds/default/notification.mp3'),
    reaction: require('../../assets/sounds/default/reaction.mp3'),
    uiClick: require('../../assets/sounds/default/uiClick.mp3'),
    uiToggle: require('../../assets/sounds/default/uiToggle.mp3'),
  },
  retro: {
    messageSend: require('../../assets/sounds/retro/messageSend.mp3'),
    messageReceive: require('../../assets/sounds/retro/messageReceive.mp3'),
    notification: require('../../assets/sounds/retro/notification.mp3'),
    reaction: require('../../assets/sounds/retro/reaction.mp3'),
    uiClick: require('../../assets/sounds/retro/uiClick.mp3'),
    uiToggle: require('../../assets/sounds/retro/uiToggle.mp3'),
  },
  minimal: {
    messageSend: require('../../assets/sounds/minimal/messageSend.mp3'),
    messageReceive: require('../../assets/sounds/minimal/messageReceive.mp3'),
    notification: require('../../assets/sounds/minimal/notification.mp3'),
    reaction: require('../../assets/sounds/minimal/reaction.mp3'),
    uiClick: require('../../assets/sounds/minimal/uiClick.mp3'),
    uiToggle: require('../../assets/sounds/minimal/uiToggle.mp3'),
  },
};

const SOUND_NAMES: SoundName[] = [
  'messageSend',
  'messageReceive',
  'notification',
  'reaction',
  'uiClick',
  'uiToggle',
];

let loadedSounds: Map<SoundName, any> = new Map();
let currentPack = 'default';

// In-memory cache to avoid SecureStore reads on every playSound call
let cachedMuted = false;
let cachedVolume = 1;

async function unloadAll(): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const sound of loadedSounds.values()) {
    promises.push(sound.unloadAsync().catch(() => {}));
  }
  await Promise.all(promises);
  loadedSounds.clear();
}

async function loadPack(pack: string): Promise<void> {
  if (!Audio) return;
  const files = SOUND_FILES[pack];
  if (!files) return;

  for (const name of SOUND_NAMES) {
    try {
      const { sound } = await Audio.Sound.createAsync(files[name]);
      loadedSounds.set(name, sound);
    } catch {
      // Ignore individual sound load failures
    }
  }
  currentPack = pack;
}

export async function initSounds(): Promise<void> {
  if (!Audio) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      shouldDuckAndroid: true,
    });

    const [savedPack, mutedStr, volumeStr] = await Promise.all([
      SecureStore.getItemAsync('gratonite_sound_pack'),
      SecureStore.getItemAsync('gratonite_sound_muted'),
      SecureStore.getItemAsync('gratonite_sound_volume'),
    ]);

    cachedMuted = mutedStr === 'true';
    const parsedVolume = parseInt(volumeStr ?? '', 10);
    cachedVolume = !isNaN(parsedVolume) ? Math.max(0, Math.min(1, parsedVolume / 100)) : 1;

    const pack = savedPack || 'default';
    await loadPack(pack);
  } catch {
    // Ignore init failures
  }
}

export async function playSound(name: SoundName): Promise<void> {
  if (!Audio) return;
  try {
    if (cachedMuted) return;

    const sound = loadedSounds.get(name);
    if (!sound) return;

    await sound.setPositionAsync(0);
    await sound.setVolumeAsync(cachedVolume);
    await sound.playAsync();
  } catch {
    // Ignore playback failures
  }
}

export async function switchSoundPack(pack: string): Promise<void> {
  if (!Audio) return;
  if (pack === currentPack) return;
  await unloadAll();
  await loadPack(pack);
  try {
    await SecureStore.setItemAsync('gratonite_sound_pack', pack);
  } catch {
    // Ignore persist failure
  }
}

/** Update the muted state in memory and persist to SecureStore. */
export async function setMuted(muted: boolean): Promise<void> {
  cachedMuted = muted;
  try {
    await SecureStore.setItemAsync('gratonite_sound_muted', String(muted));
  } catch {
    // Ignore persist failure
  }
}

/** Update the volume (0–100) in memory and persist to SecureStore. */
export async function setVolume(volume: number): Promise<void> {
  const clamped = Math.max(0, Math.min(100, Math.round(volume)));
  cachedVolume = clamped / 100;
  try {
    await SecureStore.setItemAsync('gratonite_sound_volume', String(clamped));
  } catch {
    // Ignore persist failure
  }
}
