/**
 * Noise suppression using Web Audio API.
 *
 * For V1, we implement a simple noise gate / compressor approach using
 * the Web Audio API — no external VAD library required.
 */

export function isNoiseSuppressionSupported(): boolean {
  return !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
}

export async function createNoiseSuppressionStream(inputStream: MediaStream): Promise<MediaStream> {
  const AudioContextClass: typeof AudioContext =
    window.AudioContext ||
    ((window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);

  const audioCtx = new AudioContextClass();

  const source = audioCtx.createMediaStreamSource(inputStream);
  const destination = audioCtx.createMediaStreamDestination();

  // Dynamics compressor to reduce background noise bursts
  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-50, audioCtx.currentTime);
  compressor.knee.setValueAtTime(40, audioCtx.currentTime);
  compressor.ratio.setValueAtTime(12, audioCtx.currentTime);
  compressor.attack.setValueAtTime(0, audioCtx.currentTime);
  compressor.release.setValueAtTime(0.25, audioCtx.currentTime);

  // High-pass filter to remove low-frequency rumble (< 100 Hz)
  const highPass = audioCtx.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.setValueAtTime(100, audioCtx.currentTime);

  source.connect(highPass);
  highPass.connect(compressor);
  compressor.connect(destination);

  // Build output stream: processed audio + original video tracks
  const processedStream = new MediaStream();
  destination.stream.getAudioTracks().forEach((track) => processedStream.addTrack(track));
  inputStream.getVideoTracks().forEach((track) => processedStream.addTrack(track));

  return processedStream;
}
