/**
 * Tests for VoiceContext — state management for voice channels.
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { VoiceProvider, useVoice } from '../src/contexts/VoiceContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <VoiceProvider>{children}</VoiceProvider>
);

describe('VoiceContext', () => {
  it('starts disconnected', () => {
    const { result } = renderHook(() => useVoice(), { wrapper });
    expect(result.current.connected).toBe(false);
    expect(result.current.channelId).toBeNull();
    expect(result.current.muted).toBe(true);
    expect(result.current.deafened).toBe(false);
  });

  it('joinVoice sets connected state', () => {
    const { result } = renderHook(() => useVoice(), { wrapper });

    act(() => {
      result.current.joinVoice('ch-1', 'General', 'My Server', 'guild-1');
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.channelId).toBe('ch-1');
    expect(result.current.channelName).toBe('General');
    expect(result.current.guildId).toBe('guild-1');
    expect(result.current.muted).toBe(true); // starts muted
  });

  it('leaveVoice resets state', () => {
    const { result } = renderHook(() => useVoice(), { wrapper });

    act(() => {
      result.current.joinVoice('ch-1', 'General', 'My Server', 'guild-1');
    });
    expect(result.current.connected).toBe(true);

    act(() => {
      result.current.leaveVoice();
    });
    expect(result.current.connected).toBe(false);
    expect(result.current.channelId).toBeNull();
  });

  it('toggleMute toggles muted state (no LiveKit handler)', async () => {
    const { result } = renderHook(() => useVoice(), { wrapper });

    expect(result.current.muted).toBe(true);
    await act(async () => {
      await result.current.toggleMute();
    });
    expect(result.current.muted).toBe(false);

    await act(async () => {
      await result.current.toggleMute();
    });
    expect(result.current.muted).toBe(true);
  });

  it('toggleDeafen also mutes when deafening', () => {
    const { result } = renderHook(() => useVoice(), { wrapper });

    // Unmute first
    act(() => {
      result.current.syncMuted(false);
    });
    expect(result.current.muted).toBe(false);

    // Deafen should also mute
    act(() => {
      result.current.toggleDeafen();
    });
    expect(result.current.deafened).toBe(true);
    expect(result.current.muted).toBe(true);

    // Undeafen should keep muted state from deafen
    act(() => {
      result.current.toggleDeafen();
    });
    expect(result.current.deafened).toBe(false);
    // muted stays true because deafen forced it
  });

  it('syncMuted updates muted from external source', () => {
    const { result } = renderHook(() => useVoice(), { wrapper });

    act(() => {
      result.current.syncMuted(false);
    });
    expect(result.current.muted).toBe(false);

    act(() => {
      result.current.syncMuted(true);
    });
    expect(result.current.muted).toBe(true);
  });

  it('setParticipants updates participant list', () => {
    const { result } = renderHook(() => useVoice(), { wrapper });

    act(() => {
      result.current.setParticipants([
        { id: 'u1', username: 'Alice', isSpeaking: true, isMuted: false },
        { id: 'u2', username: 'Bob', isSpeaking: false, isMuted: true },
      ]);
    });

    expect(result.current.participants).toHaveLength(2);
    expect(result.current.participants[0].username).toBe('Alice');
    expect(result.current.participants[1].isMuted).toBe(true);
  });

  it('registerMuteHandler delegates toggleMute', async () => {
    const { result } = renderHook(() => useVoice(), { wrapper });
    const mockHandler = jest.fn();

    act(() => {
      result.current.registerMuteHandler(mockHandler);
    });

    await act(async () => {
      await result.current.toggleMute();
    });

    expect(mockHandler).toHaveBeenCalled();
  });
});
