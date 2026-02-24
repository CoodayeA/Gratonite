export async function getUserMediaWithFallback(
  attempts: MediaStreamConstraints[],
): Promise<MediaStream> {
  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Unable to access media devices');
}

export function mapMediaError(error: any): string {
  if (error?.name === 'NotAllowedError') {
    return 'Microphone/camera permission denied. Check browser site permissions.';
  }
  if (error?.name === 'NotFoundError') {
    return 'No compatible media device was found.';
  }
  if (error?.name === 'NotReadableError') {
    return 'Media device is busy in another app or tab.';
  }
  if (error?.name === 'OverconstrainedError') {
    return 'Selected media device is unavailable. Try the default device.';
  }
  return `Media error: ${error?.name ?? 'Unknown'}${error?.message ? ` - ${error.message}` : ''}`;
}
