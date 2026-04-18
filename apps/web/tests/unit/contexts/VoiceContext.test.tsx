import React from 'react';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { VoiceProvider, useVoice } from '../../../src/contexts/VoiceContext';

function wrapper({ children }: { children: ReactNode }) {
  return <VoiceProvider>{children}</VoiceProvider>;
}

describe('VoiceContext', () => {
  it('startScreenShare delegates to the registered handler and marks screen sharing active', async () => {
    const { result } = renderHook(() => useVoice(), { wrapper });
    const startHandler = vi.fn().mockResolvedValue(undefined);

    act(() => {
      result.current.registerStartScreenShareHandler(startHandler);
    });

    await act(async () => {
      await result.current.startScreenShare('screen:1:0');
    });

    expect(startHandler).toHaveBeenCalledWith('screen:1:0');
    expect(result.current.screenSharing).toBe(true);
  });

  it('stopScreenShare clears local sharing state even if the registered handler disappears', async () => {
    const { result } = renderHook(() => useVoice(), { wrapper });
    const stopHandler = vi.fn().mockResolvedValue(undefined);

    act(() => {
      result.current.syncScreenSharing(true);
      result.current.registerStopScreenShareHandler(stopHandler);
      result.current.registerStopScreenShareHandler(null);
    });

    await act(async () => {
      await result.current.stopScreenShare();
    });

    expect(stopHandler).not.toHaveBeenCalled();
    expect(result.current.screenSharing).toBe(false);
  });

  it('clearCallState resets screen sharing and unregisters screen share handlers', async () => {
    const { result } = renderHook(() => useVoice(), { wrapper });
    const startHandler = vi.fn().mockResolvedValue(undefined);

    act(() => {
      result.current.registerStartScreenShareHandler(startHandler);
      result.current.syncScreenSharing(true);
      result.current.clearCallState();
    });

    expect(result.current.screenSharing).toBe(false);

    await expect(result.current.startScreenShare()).rejects.toThrow('No active call available for screen sharing.');
    expect(startHandler).not.toHaveBeenCalled();
  });
});
