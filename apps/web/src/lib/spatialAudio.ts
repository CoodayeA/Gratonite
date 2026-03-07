/**
 * SpatialAudioEngine — Per-participant Web Audio graphs with HRTF panning.
 *
 * Audio chain per participant:
 *   RemoteAudioTrack.mediaStreamTrack
 *     → MediaStreamAudioSourceNode
 *     → PannerNode (HRTF + inverse distance rolloff)
 *     → GainNode (per-user volume)
 *     → masterGain
 *     → AudioContext.destination
 */
import { getSharedAudioContext } from '../utils/SoundManager';

interface ParticipantAudioGraph {
  source: MediaStreamAudioSourceNode;
  panner: PannerNode;
  gain: GainNode;
}

export class SpatialAudioEngine {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private graphs = new Map<string, ParticipantAudioGraph>();
  private visibilityHandler: (() => void) | null = null;

  constructor() {
    this.ctx = getSharedAudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1;
    this.masterGain.connect(this.ctx.destination);

    // Resume AudioContext when tab regains focus
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  addParticipant(id: string, mediaStreamTrack: MediaStreamTrack): void {
    // Remove existing graph if any
    this.removeParticipant(id);

    const stream = new MediaStream([mediaStreamTrack]);
    const source = this.ctx.createMediaStreamSource(stream);

    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 0.15;
    panner.maxDistance = 1.0;
    panner.rolloffFactor = 1.5;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;
    panner.coneOuterGain = 1;
    // Default position at origin
    panner.positionX.setValueAtTime(0, this.ctx.currentTime);
    panner.positionY.setValueAtTime(0, this.ctx.currentTime);
    panner.positionZ.setValueAtTime(0, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.value = 1;

    source.connect(panner);
    panner.connect(gain);
    gain.connect(this.masterGain);

    this.graphs.set(id, { source, panner, gain });
  }

  removeParticipant(id: string): void {
    const graph = this.graphs.get(id);
    if (!graph) return;
    try {
      graph.source.disconnect();
      graph.panner.disconnect();
      graph.gain.disconnect();
    } catch {
      // Nodes may already be disconnected
    }
    this.graphs.delete(id);
  }

  /**
   * Update a remote participant's position.
   * x, y are normalized 0–1 (canvas coordinates).
   * We map to Web Audio 3D space: x → [-1, 1], y → [-1, 1], z = 0.
   */
  updatePosition(id: string, x: number, y: number): void {
    const graph = this.graphs.get(id);
    if (!graph) return;
    const mappedX = (x - 0.5) * 2; // 0–1 → -1 to 1
    const mappedY = (y - 0.5) * 2;
    const t = this.ctx.currentTime;
    graph.panner.positionX.setValueAtTime(mappedX, t);
    graph.panner.positionY.setValueAtTime(-mappedY, t); // Invert Y (screen Y is top-down)
    graph.panner.positionZ.setValueAtTime(0, t);
  }

  /**
   * Update the listener's position (local user).
   * x, y are normalized 0–1.
   */
  updateListenerPosition(x: number, y: number): void {
    const listener = this.ctx.listener;
    const mappedX = (x - 0.5) * 2;
    const mappedY = (y - 0.5) * 2;
    const t = this.ctx.currentTime;
    if (listener.positionX) {
      listener.positionX.setValueAtTime(mappedX, t);
      listener.positionY.setValueAtTime(-mappedY, t);
      listener.positionZ.setValueAtTime(0, t);
    } else {
      // Fallback for older browsers
      listener.setPosition(mappedX, -mappedY, 0);
    }
  }

  /**
   * Set per-user volume (0–200, where 100 is normal).
   */
  setParticipantVolume(id: string, volume: number): void {
    const graph = this.graphs.get(id);
    if (!graph) return;
    graph.gain.gain.setValueAtTime(Math.max(0, volume / 100), this.ctx.currentTime);
  }

  /**
   * Set master volume (0–100).
   */
  setMasterVolume(volume: number): void {
    this.masterGain.gain.setValueAtTime(Math.max(0, volume / 100), this.ctx.currentTime);
  }

  destroy(): void {
    for (const [id] of this.graphs) {
      this.removeParticipant(id);
    }
    try {
      this.masterGain.disconnect();
    } catch {
      // Already disconnected
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }
}
