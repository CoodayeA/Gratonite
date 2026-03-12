import React, { createContext, useContext, useState, useRef, useCallback, useMemo, type ReactNode } from 'react';

export interface VoiceParticipant {
  id: string;
  username: string;
  isSpeaking: boolean;
  isMuted: boolean;
}

interface VoiceState {
  channelId: string | null;
  channelName: string;
  guildId: string;
  guildName: string;
  connected: boolean;
  muted: boolean;
  deafened: boolean;
  participants: VoiceParticipant[];
}

interface VoiceContextValue extends VoiceState {
  joinVoice: (channelId: string, channelName: string, guildName: string, guildId: string) => void;
  leaveVoice: () => void;
  toggleMute: () => Promise<void>;
  toggleDeafen: () => void;
  /** Called by VoiceChannelScreen to register the real LiveKit mute handler */
  registerMuteHandler: (fn: (() => Promise<void>) | null) => void;
  /** Called by VoiceChannelScreen to push the authoritative isMuted value into context */
  syncMuted: (muted: boolean) => void;
  /** Update participant list */
  setParticipants: (participants: VoiceParticipant[]) => void;
}

const defaultState: VoiceState = {
  channelId: null,
  channelName: '',
  guildId: '',
  guildName: '',
  connected: false,
  muted: true,
  deafened: false,
  participants: [],
};

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<VoiceState>(defaultState);
  const liveKitToggleMuteRef = useRef<(() => Promise<void>) | null>(null);

  const registerMuteHandler = useCallback((fn: (() => Promise<void>) | null) => {
    liveKitToggleMuteRef.current = fn;
  }, []);

  const syncMuted = useCallback((muted: boolean) => {
    setState(prev => ({ ...prev, muted }));
  }, []);

  const joinVoice = useCallback((channelId: string, channelName: string, guildName: string, guildId: string) => {
    setState({
      channelId,
      channelName,
      guildId,
      guildName,
      connected: true,
      muted: true,
      deafened: false,
      participants: [],
    });
  }, []);

  const leaveVoice = useCallback(() => {
    liveKitToggleMuteRef.current = null;
    setState(defaultState);
  }, []);

  const toggleMute = useCallback(async () => {
    if (liveKitToggleMuteRef.current) {
      await liveKitToggleMuteRef.current();
    } else {
      setState(prev => ({ ...prev, muted: !prev.muted }));
    }
  }, []);

  const toggleDeafen = useCallback(() => {
    setState(prev => {
      const newDeafened = !prev.deafened;
      return { ...prev, deafened: newDeafened, muted: newDeafened ? true : prev.muted };
    });
  }, []);

  const setParticipants = useCallback((participants: VoiceParticipant[]) => {
    setState(prev => ({ ...prev, participants }));
  }, []);

  const value = useMemo(() => ({
    ...state,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    registerMuteHandler,
    syncMuted,
    setParticipants,
  }), [state, joinVoice, leaveVoice, toggleMute, toggleDeafen, registerMuteHandler, syncMuted, setParticipants]);

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used within a VoiceProvider');
  return ctx;
}
