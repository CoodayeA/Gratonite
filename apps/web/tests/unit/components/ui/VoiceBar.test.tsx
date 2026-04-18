import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VoiceBar from '../../../../src/components/ui/VoiceBar';

const navigateMock = vi.hoisted(() => vi.fn());

type VoiceStateMock = {
  activeCallType: 'guild' | 'dm' | null;
  connected: boolean;
  channelName: string;
  guildName: string;
  guildId: string;
  channelId: string | null;
  muted: boolean;
  deafened: boolean;
  screenSharing: boolean;
  participantCount: number;
  connectionQuality: 'good' | 'fair' | 'poor';
  toggleMute: () => Promise<void>;
  toggleDeafen: () => void;
  leaveVoice: () => void;
};

let voiceStateMock: VoiceStateMock;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../../../src/contexts/VoiceContext', () => ({
  useVoice: () => voiceStateMock,
}));

describe('VoiceBar', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => {
          if (key === 'gratonite_voice_mode') return 'voice_activity';
          if (key === 'gratonite_ptt_key') return 'Space';
          return null;
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
    });
    voiceStateMock = {
      activeCallType: 'guild',
      connected: true,
      channelName: 'General',
      guildName: 'Workspace',
      guildId: 'guild-1',
      channelId: 'channel-1',
      muted: true,
      deafened: false,
      screenSharing: true,
      participantCount: 3,
      connectionQuality: 'good',
      toggleMute: vi.fn().mockResolvedValue(undefined),
      toggleDeafen: vi.fn(),
      leaveVoice: vi.fn(),
    };
  });

  it('opens the popout and sends current state when the popout announces readiness', async () => {
    const postMessage = vi.fn();
    const focus = vi.fn();
    const popoutWindow = { closed: false, postMessage, focus } as unknown as Window;
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(popoutWindow);

    render(<VoiceBar />);

    fireEvent.click(screen.getByRole('button', { name: /pop out call window/i }));

    expect(openSpy).toHaveBeenCalledWith(
      `${window.location.origin}/voice-popout?channelId=channel-1&guildId=guild-1&channelName=General&callType=guild`,
      'gratoniteVoicePopout',
      'width=420,height=580,resizable=yes,scrollbars=no'
    );
    expect(focus).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      source: popoutWindow,
      data: { type: 'GRATONITE_VOICE_POPOUT_READY' },
    }));

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({
        type: 'GRATONITE_VOICE_STATE',
        payload: {
          activeCallType: 'guild',
          connected: true,
          channelId: 'channel-1',
          channelName: 'General',
          guildId: 'guild-1',
          guildName: 'Workspace',
          muted: true,
          deafened: false,
          screenSharing: true,
          participantCount: 3,
          connectionQuality: 'good',
        },
      }, window.location.origin);
    });

    openSpy.mockRestore();
  });

  it('executes popout mute actions from the active popout window', async () => {
    const postMessage = vi.fn();
    const popoutWindow = { closed: false, postMessage, focus: vi.fn() } as unknown as Window;
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(popoutWindow);

    render(<VoiceBar />);

    fireEvent.click(screen.getByRole('button', { name: /pop out call window/i }));

    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      source: popoutWindow,
      data: { type: 'GRATONITE_VOICE_ACTION', action: 'toggleMute' },
    }));

    await waitFor(() => {
      expect(voiceStateMock.toggleMute).toHaveBeenCalledTimes(1);
    });

    openSpy.mockRestore();
  });
});
