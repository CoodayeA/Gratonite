import { api } from './api';

type LeaveVoiceSessionOptions = {
  disconnectLiveKit?: () => Promise<void> | void;
  clearVoiceState: () => void;
};

/**
 * Canonical voice-leave flow used by both compact VoiceBar and full voice page.
 * If a LiveKit disconnect callback is provided, it is responsible for media
 * teardown and server leave signaling; otherwise this helper performs API leave.
 */
export async function leaveVoiceSession({ disconnectLiveKit, clearVoiceState }: LeaveVoiceSessionOptions): Promise<void> {
  try {
    if (disconnectLiveKit) {
      await disconnectLiveKit();
    } else {
      await api.voice.leave();
    }
  } catch {
    // Best effort. Local state must still be cleared.
  } finally {
    clearVoiceState();
  }
}

