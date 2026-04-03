/**
 * Electron/Chromium desktop capture using desktopCapturer source ids.
 * LiveKit's default path uses getDisplayMedia(), which is unreliable in Electron;
 * this uses getUserMedia + chromeMediaSource (same approach as Chromium desktop capture).
 *
 * System audio: Windows often supports loopback when chromeMediaSourceId matches the
 * shared surface; macOS may not expose desktop audio the same way.
 */

export type ElectronDesktopSource = {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  displayId: string;
  appIconDataUrl: string | null;
};

export function isGratoniteDesktopApp(): boolean {
  return typeof window !== 'undefined' && !!window.gratoniteDesktop?.isDesktop;
}

/** Prefer full displays over single windows for voice/video screen share. */
export async function pickDefaultElectronScreenSourceId(): Promise<string | null> {
  const api = window.gratoniteDesktop?.getScreenSources;
  if (!api) return null;
  const sources: ElectronDesktopSource[] = await api();
  if (!sources.length) return null;
  const fullScreen = sources.find((s) => s.id.startsWith('screen:'));
  return (fullScreen ?? sources[0]).id;
}

export type ElectronCaptureDims = {
  maxWidth: number;
  maxHeight: number;
  maxFrameRate: number;
};

/**
 * Returns live video (required) and optional system-audio track for the given desktopCapturer id.
 * Caller must not stop tracks until screen share ends (LiveKit owns publication lifecycle).
 */
export async function captureElectronScreenTracks(
  sourceId: string,
  dims: ElectronCaptureDims,
): Promise<{ video: MediaStreamTrack; audio?: MediaStreamTrack }> {
  // Video track from desktop capture
  const videoStream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      // Chromium/Electron desktop capture (see Electron docs)
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
        maxWidth: dims.maxWidth,
        maxHeight: dims.maxHeight,
        maxFrameRate: dims.maxFrameRate,
      },
    },
  } as MediaStreamConstraints);

  const video = videoStream.getVideoTracks()[0];
  if (!video) {
    videoStream.getTracks().forEach((t) => t.stop());
    throw new Error('No screen video track from Electron capture');
  }

  // System / loopback audio: same source id is required on Windows for loopback in many builds
  let audio: MediaStreamTrack | undefined;
  try {
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
        },
      },
      video: false,
    } as MediaStreamConstraints);
    audio = audioStream.getAudioTracks()[0];
    if (!audio) {
      audioStream.getTracks().forEach((t) => t.stop());
    }
  } catch {
    // No system audio (common on macOS, or user denied) — video-only share
  }

  return { video, audio };
}
