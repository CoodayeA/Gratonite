import { Audio } from 'expo-av';
import * as SecureStore from 'expo-secure-store';

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

let loadedSounds: Map<SoundName, Audio.Sound> = new Map();
let currentPack = 'default';

async function unloadAll(): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const sound of loadedSounds.values()) {
    promises.push(sound.unloadAsync().catch(() => {}));
  }
  await Promise.all(promises);
  loadedSounds.clear();
}

async function loadPack(pack: string): Promise<void> {
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
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      shouldDuckAndroid: true,
    });

    const savedPack = await SecureStore.getItemAsync('gratonite_sound_pack');
    const pack = savedPack || 'default';
    await loadPack(pack);
  } catch {
    // Ignore init failures
  }
}

export async function playSound(name: SoundName): Promise<void> {
  try {
    const mutedStr = await SecureStore.getItemAsync('gratonite_sound_muted');
    if (mutedStr === 'true') return;

    const sound = loadedSounds.get(name);
    if (!sound) return;

    const volumeStr = await SecureStore.getItemAsync('gratonite_sound_volume');
    const volume = volumeStr != null ? parseInt(volumeStr, 10) / 100 : 1;

    await sound.setPositionAsync(0);
    await sound.setVolumeAsync(Math.max(0, Math.min(1, volume)));
    await sound.playAsync();
  } catch {
    // Ignore playback failures
  }
}

export async function switchSoundPack(pack: string): Promise<void> {
  if (pack === currentPack) return;
  await unloadAll();
  await loadPack(pack);
  try {
    await SecureStore.setItemAsync('gratonite_sound_pack', pack);
  } catch {
    // Ignore persist failure
  }
}
