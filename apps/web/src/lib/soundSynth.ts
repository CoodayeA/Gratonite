/**
 * soundSynth.ts — Web Audio API sound synthesis for the soundboard.
 * All 8 sounds are synthesized without external audio files.
 */

let ctx: AudioContext | null = null;

const getCtx = (): AudioContext => {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

function playAirhorn(ac: AudioContext): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = 'sawtooth';
  const now = ac.currentTime;
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.linearRampToValueAtTime(880, now + 1);
  gain.gain.setValueAtTime(0.5, now);
  gain.gain.linearRampToValueAtTime(0, now + 1);
  osc.start(now);
  osc.stop(now + 1);
}

function playCrickets(ac: AudioContext): void {
  const duration = 3;
  const now = ac.currentTime;
  // Use FM (frequency modulation) rather than AM on the output gain to avoid
  // scheduling automation events on the same AudioParam as a modulator source.
  [3800, 4200].forEach(freq => {
    const osc = ac.createOscillator();
    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    const gain = ac.createGain();
    // LFO modulates the carrier's frequency (FM), not the output gain
    lfo.frequency.value = 50;
    lfoGain.gain.value = 80; // FM depth in Hz
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    // Output gain has scheduled automation only — no modulator connected here
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    lfo.start(now);
    osc.start(now);
    lfo.stop(now + duration);
    osc.stop(now + duration);
  });
}

function playKick(ac: AudioContext, startTime: number): void {
  const bufferSize = ac.sampleRate * 0.05;
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const noise = ac.createBufferSource();
  noise.buffer = buffer;

  const osc = ac.createOscillator();
  const oscGain = ac.createGain();
  const noiseGain = ac.createGain();

  osc.frequency.setValueAtTime(80, startTime);
  osc.frequency.exponentialRampToValueAtTime(0.01, startTime + 0.05);
  oscGain.gain.setValueAtTime(1, startTime);
  oscGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.05);
  noiseGain.gain.setValueAtTime(0.3, startTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.05);

  osc.connect(oscGain);
  oscGain.connect(ac.destination);
  noise.connect(noiseGain);
  noiseGain.connect(ac.destination);

  osc.start(startTime);
  osc.stop(startTime + 0.05);
  noise.start(startTime);
  noise.stop(startTime + 0.05);
}

function playDrumRoll(ac: AudioContext): void {
  const now = ac.currentTime;
  const duration = 1.5;
  const interval = 0.06;
  const count = Math.floor(duration / interval);
  for (let i = 0; i < count; i++) {
    playKick(ac, now + i * interval);
  }
}

function playTada(ac: AudioContext): void {
  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
  const now = ac.currentTime;
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.12;
    gain.gain.setValueAtTime(0.4, start);
    gain.gain.linearRampToValueAtTime(0, start + 0.12);
    osc.start(start);
    osc.stop(start + 0.12);
  });
}

function playSadTrombone(ac: AudioContext): void {
  const notes = [440, 392, 330, 262]; // A4, G4, E4, C4
  const now = ac.currentTime;
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const vibLfo = ac.createOscillator();
    const vibGain = ac.createGain();
    const gain = ac.createGain();
    vibLfo.frequency.value = 5;
    vibGain.gain.value = 8;
    vibLfo.connect(vibGain);
    vibGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const start = now + i * 0.2;
    gain.gain.setValueAtTime(0.3, start);
    gain.gain.linearRampToValueAtTime(0, start + 0.2);
    vibLfo.start(start);
    osc.start(start);
    vibLfo.stop(start + 0.2);
    osc.stop(start + 0.2);
  });
}

function playApplause(ac: AudioContext): void {
  const duration = 2.5;
  const bufferSize = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ac.createBufferSource();
  source.buffer = buffer;
  const gain = ac.createGain();
  source.connect(gain);
  gain.connect(ac.destination);
  const now = ac.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.4, now + 0.2);
  gain.gain.setValueAtTime(0.4, now + 1.5);
  gain.gain.linearRampToValueAtTime(0, now + duration);
  source.start(now);
  source.stop(now + duration);
}

function playSwoosh(ac: AudioContext): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = 'sine';
  const now = ac.currentTime;
  osc.frequency.setValueAtTime(2000, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.4);
  gain.gain.setValueAtTime(0.4, now);
  gain.gain.linearRampToValueAtTime(0, now + 0.4);
  osc.start(now);
  osc.stop(now + 0.4);
}

function playBuzzer(ac: AudioContext): void {
  const now = ac.currentTime;
  [160, 320].forEach(freq => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.setValueAtTime(0, now + 0.6);
    osc.start(now);
    osc.stop(now + 0.6);
  });
}

export function playSynthSound(name: string): void {
  const ac = getCtx();
  const normalized = name.toLowerCase().replace(/\s+/g, ' ').trim();
  if (normalized.includes('airhorn')) return playAirhorn(ac);
  if (normalized.includes('cricket')) return playCrickets(ac);
  if (normalized.includes('drum')) return playDrumRoll(ac);
  if (normalized.includes('tada')) return playTada(ac);
  if (normalized.includes('trombone') || normalized.includes('sad')) return playSadTrombone(ac);
  if (normalized.includes('applause')) return playApplause(ac);
  if (normalized.includes('swoosh')) return playSwoosh(ac);
  if (normalized.includes('buzzer')) return playBuzzer(ac);
  // Default fallback: short beep
  playTada(ac);
}
