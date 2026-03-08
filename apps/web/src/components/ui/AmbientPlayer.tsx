import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Ambient Modes ────────────────────────────────────────────────────────────

type AmbientMode = 'off' | 'lofi' | 'nature' | 'space';

// ─── Audio Graph Builders ─────────────────────────────────────────────────────

function buildLofi(ctx: AudioContext, master: GainNode): (() => void) {
    const nodes: AudioNode[] = [];

    // Chord: Cmaj7 — C3, E3, G3, B3
    const freqs = [130.81, 164.81, 196.0, 246.94];

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    filter.Q.value = 0.5;
    filter.connect(master);
    nodes.push(filter);

    freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        osc.detune.value = (Math.random() - 0.5) * 12; // slight detune for warmth

        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0, ctx.currentTime);
        oscGain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 2 + i * 0.4);

        // Slow LFO for tremolo
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.15 + i * 0.03;

        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.012;

        lfo.connect(lfoGain);
        lfoGain.connect(oscGain.gain);

        osc.connect(oscGain);
        oscGain.connect(filter);

        osc.start();
        lfo.start();
        nodes.push(osc, oscGain, lfo, lfoGain);
    });

    // Subtle noise for vinyl crackle texture
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) noiseData[i] = Math.random() * 2 - 1;

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 3200;
    noiseFilter.Q.value = 0.3;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.008;

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noiseSource.start();
    nodes.push(noiseSource, noiseFilter, noiseGain);

    return () => {
        nodes.forEach(n => {
            try { (n as OscillatorNode | AudioBufferSourceNode).stop?.(); } catch { /* already stopped */ }
            n.disconnect();
        });
    };
}

function buildNature(ctx: AudioContext, master: GainNode): (() => void) {
    const nodes: AudioNode[] = [];

    // Wind: filtered noise with slow amplitude envelope
    const bufferSize = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const windSrc = ctx.createBufferSource();
    windSrc.buffer = buf;
    windSrc.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 600;
    windFilter.Q.value = 0.4;

    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0, ctx.currentTime);
    windGain.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 3);

    // LFO to make wind swell
    const windLfo = ctx.createOscillator();
    windLfo.type = 'sine';
    windLfo.frequency.value = 0.08;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 0.05;
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windGain.gain);

    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    windSrc.start();
    windLfo.start();
    nodes.push(windSrc, windFilter, windGain, windLfo, windLfoGain);

    // Sub drone: low hum like distant water
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 55;
    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(0, ctx.currentTime);
    droneGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 4);
    drone.connect(droneGain);
    droneGain.connect(master);
    drone.start();
    nodes.push(drone, droneGain);

    // Occasional chirp: quick sine blips
    let chirpTimeout: ReturnType<typeof setTimeout>;
    let stopped = false;
    const scheduleChirp = () => {
        if (stopped) return;
        const delay = 3000 + Math.random() * 6000;
        chirpTimeout = setTimeout(() => {
            if (stopped) return;
            try {
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                const freq = [1200, 1600, 2000, 2400][Math.floor(Math.random() * 4)];
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(freq * 1.4, ctx.currentTime + 0.1);
                g.gain.setValueAtTime(0, ctx.currentTime);
                g.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.03);
                g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
                osc.connect(g);
                g.connect(master);
                osc.start();
                osc.stop(ctx.currentTime + 0.2);
            } catch { /* context might be closed */ }
            scheduleChirp();
        }, delay);
    };
    scheduleChirp();

    return () => {
        stopped = true;
        clearTimeout(chirpTimeout);
        nodes.forEach(n => {
            try { (n as OscillatorNode | AudioBufferSourceNode).stop?.(); } catch { /* already stopped */ }
            n.disconnect();
        });
    };
}

function buildSpace(ctx: AudioContext, master: GainNode): (() => void) {
    const nodes: AudioNode[] = [];

    // Long evolving pad — slow attack, modulated pitch
    const baseFreqs = [65.41, 82.41, 98.0, 123.47]; // C2 chord

    const convGain = ctx.createGain();
    convGain.gain.value = 0.8;
    convGain.connect(master);
    nodes.push(convGain);

    baseFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.value = freq;

        const modOsc = ctx.createOscillator();
        modOsc.type = 'sine';
        modOsc.frequency.value = 0.06 + i * 0.02;
        const modGain = ctx.createGain();
        modGain.gain.value = freq * 0.015;
        modOsc.connect(modGain);
        modGain.connect(osc.frequency);

        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0, ctx.currentTime);
        oscGain.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 4 + i * 0.8);

        // Slow swell LFO
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.05 + i * 0.015;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.02;
        lfo.connect(lfoGain);
        lfoGain.connect(oscGain.gain);

        osc.connect(oscGain);
        oscGain.connect(convGain);

        osc.start();
        modOsc.start();
        lfo.start();
        nodes.push(osc, modOsc, modGain, oscGain, lfo, lfoGain);
    });

    // High shimmer
    const shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.value = 2093; // C7
    const shimGain = ctx.createGain();
    shimGain.gain.setValueAtTime(0, ctx.currentTime);
    shimGain.gain.linearRampToValueAtTime(0.012, ctx.currentTime + 5);
    const shimLfo = ctx.createOscillator();
    shimLfo.frequency.value = 0.22;
    const shimLfoGain = ctx.createGain();
    shimLfoGain.gain.value = 0.009;
    shimLfo.connect(shimLfoGain);
    shimLfoGain.connect(shimGain.gain);
    shimmer.connect(shimGain);
    shimGain.connect(master);
    shimmer.start();
    shimLfo.start();
    nodes.push(shimmer, shimGain, shimLfo, shimLfoGain);

    return () => {
        nodes.forEach(n => {
            try { (n as OscillatorNode | AudioBufferSourceNode).stop?.(); } catch { /* already stopped */ }
            n.disconnect();
        });
    };
}

// ─── Component ─────────────────────────────────────────────────────────────────

const AMBIENT_STORAGE_KEY = 'gratonite_ambient_mode';
const AMBIENT_VOLUME_KEY = 'gratonite_ambient_volume';
const DEFAULT_AMBIENT_VOLUME = 0.5;

function getAmbientVolume(): number {
    const stored = localStorage.getItem(AMBIENT_VOLUME_KEY);
    if (stored !== null) {
        const v = parseFloat(stored);
        if (!isNaN(v) && v >= 0 && v <= 1) return v;
    }
    return DEFAULT_AMBIENT_VOLUME;
}

export const AmbientPlayer = () => {
    const savedMode = (localStorage.getItem(AMBIENT_STORAGE_KEY) as AmbientMode) || 'off';
    const [mode, setMode] = useState<AmbientMode>(savedMode);

    const ctxRef = useRef<AudioContext | null>(null);
    const masterRef = useRef<GainNode | null>(null);
    const stopRef = useRef<(() => void) | null>(null);

    const ensureCtx = useCallback(() => {
        if (!ctxRef.current || ctxRef.current.state === 'closed') {
            ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (ctxRef.current.state === 'suspended') {
            ctxRef.current.resume();
        }
        return ctxRef.current;
    }, []);

    const stopAllNodes = useCallback(() => {
        if (stopRef.current) {
            stopRef.current();
            stopRef.current = null;
        }
        if (masterRef.current) {
            try { masterRef.current.disconnect(); } catch { /* ok */ }
            masterRef.current = null;
        }
    }, []);

    const startMode = useCallback((m: AmbientMode) => {
        // Always stop existing first
        stopAllNodes();

        if (m === 'off') return;

        const ctx = ensureCtx();

        const master = ctx.createGain();
        const vol = getAmbientVolume();
        master.gain.setValueAtTime(0, ctx.currentTime);
        master.gain.linearRampToValueAtTime(vol, ctx.currentTime + 1.5);
        master.connect(ctx.destination);
        masterRef.current = master;

        if (m === 'lofi') stopRef.current = buildLofi(ctx, master);
        if (m === 'nature') stopRef.current = buildNature(ctx, master);
        if (m === 'space') stopRef.current = buildSpace(ctx, master);
    }, [ensureCtx, stopAllNodes]);

    const stopWithFade = useCallback(() => {
        if (!masterRef.current || !ctxRef.current) {
            stopAllNodes();
            return;
        }
        const ctx = ctxRef.current;
        const m = masterRef.current;
        try {
            m.gain.setValueAtTime(m.gain.value, ctx.currentTime);
            m.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
        } catch { /* context may be closed */ }
        const capturedStop = stopRef.current;
        const capturedMaster = masterRef.current;
        stopRef.current = null;
        masterRef.current = null;
        setTimeout(() => {
            if (capturedStop) capturedStop();
            try { capturedMaster.disconnect(); } catch { /* ok */ }
        }, 1300);
    }, [stopAllNodes]);

    // React to mode changes
    useEffect(() => {
        localStorage.setItem(AMBIENT_STORAGE_KEY, mode);
        if (mode === 'off') {
            stopWithFade();
        } else {
            startMode(mode);
        }
    }, [mode, startMode, stopWithFade]);

    // Listen for mode changes from Settings modal
    useEffect(() => {
        const handler = (e: Event) => {
            const newMode = (e as CustomEvent).detail as AmbientMode;
            setMode(newMode);
        };
        window.addEventListener('ambient-mode-change', handler);
        return () => window.removeEventListener('ambient-mode-change', handler);
    }, []);

    // Listen for volume changes from Settings modal
    useEffect(() => {
        const handler = (e: StorageEvent) => {
            if (e.key === AMBIENT_VOLUME_KEY && masterRef.current && ctxRef.current) {
                const vol = getAmbientVolume();
                try {
                    masterRef.current.gain.setValueAtTime(masterRef.current.gain.value, ctxRef.current.currentTime);
                    masterRef.current.gain.linearRampToValueAtTime(vol, ctxRef.current.currentTime + 0.3);
                } catch { /* context may be closed */ }
            }
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (stopRef.current) stopRef.current();
            if (masterRef.current) try { masterRef.current.disconnect(); } catch { /* ok */ }
            if (ctxRef.current) try { ctxRef.current.close(); } catch { /* ok */ }
        };
    }, []);

    // No visible UI — controlled from Settings > Sound tab
    return null;
};

export default AmbientPlayer;
