// ─── SoundManager — Web Audio API based, no external files needed ────────────
// All sounds are synthesized via oscillators/noise. Zero network requests.

let ctx: AudioContext | null = null;
let audioUnlocked = false;
let unlockListenersAttached = false;

const unlockEvents: Array<keyof WindowEventMap> = ['pointerdown', 'touchstart', 'keydown', 'mousedown'];

function getCtx(): AudioContext {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return ctx;
}

function unlockAudio() {
    audioUnlocked = true;
    try {
        const c = getCtx();
        if (c.state === 'suspended') void c.resume();
    } catch {
        // Ignore unlock failures — audio will retry on next gesture.
    }
}

function setupUnlockListeners() {
    if (unlockListenersAttached || typeof window === 'undefined') return;
    unlockListenersAttached = true;

    const onFirstGesture = () => {
        unlockAudio();
        for (const evt of unlockEvents) {
            window.removeEventListener(evt, onFirstGesture, true);
        }
    };

    for (const evt of unlockEvents) {
        window.addEventListener(evt, onFirstGesture, { capture: true, passive: true });
    }
}

function ensureAudioContextReady(): AudioContext | null {
    if (!audioUnlocked) return null;
    try {
        const c = getCtx();
        if (c.state === 'suspended') void c.resume();
        return c;
    } catch {
        return null;
    }
}

// ── Volume-aware primitives ──────────────────────────────────────────────────

function getVolume(): number {
    return parseFloat(localStorage.getItem('gratonite_notification_volume') || localStorage.getItem('gratonite_sound_volume') || '0.7');
}

function playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainStart = 0.18,
    gainEnd = 0,
    delay = 0,
    detune = 0
) {
    const c = ensureAudioContextReady();
    if (!c) return;
    const vol = getVolume();
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.detune.setValueAtTime(detune, t);
    gain.gain.setValueAtTime(gainStart * vol, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(gainEnd * vol, 0.0001), t + duration);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + duration);
}

function playNoise(duration: number, gainStart = 0.1, gainEnd = 0, delay = 0) {
    const c = ensureAudioContextReady();
    if (!c) return;
    const vol = getVolume();
    const t = c.currentTime + delay;
    const bufferSize = c.sampleRate * duration;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = c.createBufferSource();
    source.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 800;

    const gain = c.createGain();
    gain.gain.setValueAtTime(gainStart * vol, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(gainEnd * vol, 0.0001), t + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    source.start(t);
    source.stop(t + duration);
}

// ── Sound Packs ──────────────────────────────────────────────────────────────
// Each pack provides EVERY sound event with a distinct character.

type SoundFn = () => void;
type SoundPack = Record<string, SoundFn>;

const defaultPack: SoundPack = {
    click() {
        playTone(800, 0.06, 'sine', 0.12, 0);
    },
    hover() {
        playTone(600, 0.04, 'sine', 0.04, 0);
    },
    messageSend() {
        playTone(880, 0.07, 'sine', 0.15, 0);
        playTone(1320, 0.1, 'sine', 0.08, 0, 0.05);
    },
    notification() {
        playTone(523.25, 0.12, 'triangle', 0.2, 0);
        playTone(659.25, 0.12, 'triangle', 0.2, 0, 0.1);
        playTone(783.99, 0.2, 'triangle', 0.18, 0, 0.2);
    },
    success() {
        playTone(523.25, 0.08, 'sine', 0.18, 0.02);
        playTone(659.25, 0.08, 'sine', 0.18, 0.02, 0.1);
        playTone(783.99, 0.15, 'sine', 0.18, 0, 0.2);
        playTone(1046.5, 0.25, 'sine', 0.16, 0, 0.3);
    },
    error() {
        playTone(220, 0.08, 'sawtooth', 0.2, 0.02);
        playTone(196, 0.12, 'sawtooth', 0.2, 0, 0.08);
        playTone(174.6, 0.2, 'sawtooth', 0.18, 0, 0.2);
    },
    join() {
        playTone(392, 0.12, 'triangle', 0.18, 0.02);
        playTone(523.25, 0.12, 'triangle', 0.18, 0.02, 0.12);
        playTone(659.25, 0.22, 'triangle', 0.2, 0, 0.24);
    },
    leave() {
        playTone(659.25, 0.1, 'triangle', 0.18, 0.02);
        playTone(523.25, 0.1, 'triangle', 0.18, 0.02, 0.1);
        playTone(392, 0.2, 'triangle', 0.2, 0, 0.2);
    },
    mention() {
        playTone(440, 0.05, 'sine', 0.25, 0.02);
        playTone(880, 0.05, 'sine', 0.25, 0.02, 0.08);
        playTone(440, 0.1, 'sine', 0.25, 0, 0.16);
    },
    gachaLegendary() {
        [261.63, 329.63, 392, 523.25].forEach((f, i) => {
            playTone(f, 0.3, 'triangle', 0.2, 0.01, i * 0.08);
        });
        playTone(1046.5, 0.6, 'sine', 0.25, 0, 0.4);
        playNoise(0.3, 0.15, 0, 0.35);
    },
    gachaReveal() {
        playTone(523.25, 0.1, 'sine', 0.15, 0.02);
        playTone(784, 0.15, 'sine', 0.15, 0, 0.1);
    },
    fame() {
        playTone(659.25, 0.08, 'sine', 0.2, 0.05);
        playTone(880, 0.08, 'sine', 0.2, 0.05, 0.1);
        playTone(1108.7, 0.15, 'sine', 0.18, 0, 0.18);
    },
    achievement() {
        playTone(493.88, 0.06, 'sine', 0.22, 0.05);
        playTone(659.25, 0.06, 'sine', 0.22, 0.05, 0.08);
        playTone(987.77, 0.06, 'sine', 0.22, 0.05, 0.16);
        playTone(1318.5, 0.3, 'sine', 0.25, 0, 0.22);
        playNoise(0.12, 0.12, 0, 0.22);
    },
};

const softPack: SoundPack = {
    // Warm, airy, ASMR-like. Pure sine, much lower volume, longer sustain
    click() {
        playTone(340, 0.18, 'sine', 0.05, 0);
    },
    hover() {
        playTone(280, 0.12, 'sine', 0.02, 0);
    },
    messageSend() {
        playTone(262, 0.25, 'sine', 0.06, 0);
        playTone(330, 0.3, 'sine', 0.05, 0, 0.18);
    },
    notification() {
        playTone(294, 0.35, 'sine', 0.06, 0);
        playTone(370, 0.4, 'sine', 0.05, 0, 0.3);
        playTone(440, 0.5, 'sine', 0.04, 0, 0.6);
    },
    success() {
        playTone(330, 0.3, 'sine', 0.05, 0);
        playTone(392, 0.3, 'sine', 0.05, 0, 0.25);
        playTone(494, 0.4, 'sine', 0.04, 0, 0.5);
    },
    error() {
        playTone(196, 0.3, 'sine', 0.06, 0);
        playTone(174.6, 0.4, 'sine', 0.05, 0, 0.25);
    },
    join() {
        playTone(262, 0.3, 'sine', 0.05, 0);
        playTone(330, 0.3, 'sine', 0.05, 0, 0.25);
        playTone(392, 0.4, 'sine', 0.04, 0, 0.5);
    },
    leave() {
        playTone(392, 0.3, 'sine', 0.05, 0);
        playTone(330, 0.3, 'sine', 0.05, 0, 0.25);
        playTone(262, 0.4, 'sine', 0.04, 0, 0.5);
    },
    mention() {
        playTone(440, 0.2, 'sine', 0.06, 0);
        playTone(523, 0.25, 'sine', 0.05, 0, 0.2);
    },
    gachaLegendary() {
        [262, 330, 392, 523].forEach((f, i) => {
            playTone(f, 0.5, 'sine', 0.06, 0.01, i * 0.2);
        });
    },
    gachaReveal() {
        playTone(392, 0.25, 'sine', 0.05, 0);
        playTone(494, 0.3, 'sine', 0.04, 0, 0.2);
    },
    fame() {
        playTone(440, 0.25, 'sine', 0.06, 0);
        playTone(523, 0.25, 'sine', 0.05, 0, 0.2);
        playTone(659, 0.35, 'sine', 0.04, 0, 0.4);
    },
    achievement() {
        playTone(392, 0.2, 'sine', 0.06, 0);
        playTone(494, 0.2, 'sine', 0.06, 0, 0.15);
        playTone(587, 0.2, 'sine', 0.06, 0, 0.3);
        playTone(784, 0.5, 'sine', 0.05, 0, 0.45);
    },
};

const retroPack: SoundPack = {
    // Aggressive 8-bit chiptune. Square waves, short staccato, higher pitch
    click() {
        playTone(180, 0.03, 'square', 0.2, 0);
        playTone(360, 0.02, 'square', 0.1, 0, 0.03);
    },
    hover() {
        playTone(440, 0.02, 'square', 0.06, 0);
    },
    messageSend() {
        playTone(523, 0.03, 'square', 0.18, 0);
        playTone(784, 0.03, 'square', 0.15, 0, 0.04);
        playTone(1047, 0.05, 'square', 0.12, 0, 0.08);
    },
    notification() {
        [262, 330, 392, 523, 659].forEach((f, i) => playTone(f, 0.04, 'square', 0.14, 0.01, i * 0.05));
        playNoise(0.08, 0.08, 0, 0.25);
    },
    success() {
        [523, 659, 784, 1047].forEach((f, i) => playTone(f, 0.04, 'square', 0.16, 0.01, i * 0.06));
        playNoise(0.06, 0.06, 0, 0.25);
    },
    error() {
        playTone(220, 0.06, 'square', 0.2, 0);
        playTone(147, 0.06, 'square', 0.2, 0, 0.08);
        playTone(110, 0.12, 'square', 0.18, 0, 0.16);
    },
    join() {
        playTone(262, 0.04, 'square', 0.16, 0);
        playTone(392, 0.04, 'square', 0.16, 0, 0.06);
        playTone(523, 0.06, 'square', 0.14, 0, 0.12);
        playNoise(0.04, 0.05, 0, 0.12);
    },
    leave() {
        playTone(523, 0.04, 'square', 0.16, 0);
        playTone(392, 0.04, 'square', 0.16, 0, 0.06);
        playTone(262, 0.08, 'square', 0.14, 0, 0.12);
    },
    mention() {
        playTone(880, 0.03, 'square', 0.2, 0);
        playTone(660, 0.03, 'square', 0.18, 0, 0.04);
        playTone(880, 0.03, 'square', 0.2, 0, 0.08);
        playTone(1100, 0.05, 'square', 0.15, 0, 0.12);
    },
    gachaLegendary() {
        [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => {
            playTone(f, 0.05, 'square', 0.18, 0.01, i * 0.06);
        });
        playNoise(0.15, 0.15, 0, 0.4);
    },
    gachaReveal() {
        playTone(392, 0.04, 'square', 0.16, 0);
        playTone(784, 0.06, 'square', 0.14, 0, 0.05);
    },
    fame() {
        [440, 554, 659, 880].forEach((f, i) => playTone(f, 0.04, 'square', 0.16, 0.01, i * 0.05));
    },
    achievement() {
        [330, 440, 554, 659, 880].forEach((f, i) => playTone(f, 0.04, 'square', 0.18, 0.01, i * 0.05));
        playNoise(0.1, 0.1, 0, 0.25);
    },
};

const packs: Record<string, SoundPack> = {
    default: defaultPack,
    soft: softPack,
    retro: retroPack,
};

// Ensure unlock listeners are installed as soon as the module is evaluated.
setupUnlockListeners();

// ── Shared AudioContext for spatial audio and other subsystems ───────────────
export function getSharedAudioContext(): AudioContext {
    setupUnlockListeners();
    const c = getCtx();
    if (c.state === 'suspended') void c.resume();
    return c;
}

// ── Public API (legacy compat) ───────────────────────────────────────────────

export const SoundManager = {
    click: defaultPack.click,
    hover: defaultPack.hover,
    messageSend: defaultPack.messageSend,
    notification: defaultPack.notification,
    success: defaultPack.success,
    error: defaultPack.error,
    join: defaultPack.join,
    leave: defaultPack.leave,
    mention: defaultPack.mention,
    gachaLegendary: defaultPack.gachaLegendary,
    gachaReveal: defaultPack.gachaReveal,
    fame: defaultPack.fame,
    achievement: defaultPack.achievement,
    packs,
};

// Global state (persisted to localStorage)
export function isSoundMuted(): boolean {
    return localStorage.getItem('gratonite_sound_muted') === 'true';
}

export function setSoundMuted(muted: boolean) {
    localStorage.setItem('gratonite_sound_muted', muted.toString());
}

export function getSoundVolume(): number {
    return parseFloat(localStorage.getItem('gratonite_notification_volume') || localStorage.getItem('gratonite_sound_volume') || '0.7');
}

export function setSoundVolume(v: number) {
    localStorage.setItem('gratonite_notification_volume', v.toString());
}

export function getSoundPack(): string {
    return localStorage.getItem('gratonite_sound_pack') || 'default';
}

export function setSoundPack(pack: string) {
    localStorage.setItem('gratonite_sound_pack', pack);
}

// Safe play — respects mute AND active sound pack
export function playSound(name: string) {
    if (isSoundMuted()) return;
    setupUnlockListeners();
    if (!audioUnlocked) return;
    const packName = getSoundPack();
    const pack = packs[packName] || packs.default;
    const fn = pack[name] || defaultPack[name as keyof SoundPack];
    if (typeof fn === 'function') fn();
}
