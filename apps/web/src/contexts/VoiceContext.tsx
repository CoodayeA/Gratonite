import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react';

export interface VoiceParticipant {
  id: string;
  username: string;
  isSpeaking: boolean;
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
  /** Number of participants currently in the connected voice channel (including self) */
  participantCount: number;
}

interface VoiceContextValue extends VoiceState {
  joinVoice: (channelId: string, channelName: string, guildName: string, guildId: string) => void;
  leaveVoice: () => void;
  toggleMute: () => Promise<void>;
  toggleDeafen: () => void;
  /** Update the participant count for the connected channel */
  setParticipantCount: (count: number) => void;
  /** Called by VoiceChannel to register the real LiveKit mute handler */
  registerMuteHandler: (fn: (() => Promise<void>) | null) => void;
  /** Called by VoiceChannel to push the authoritative isMuted value into context */
  syncMuted: (muted: boolean) => void;
}

const defaultState: VoiceState = {
  channelId: null,
  channelName: '',
  guildId: '',
  guildName: '',
  connected: false,
  muted: false,
  deafened: false,
  participants: [],
  participantCount: 0,
};

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<VoiceState>(defaultState);

  // Ref to the real LiveKit toggleMute, registered by VoiceChannel on mount
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
      participantCount: 1, // self
    });
  }, []);

  const leaveVoice = useCallback(() => {
    liveKitToggleMuteRef.current = null;
    setState(defaultState);
  }, []);

  const toggleMute = useCallback(async () => {
    if (liveKitToggleMuteRef.current) {
      // Delegate to the real LiveKit handler; VoiceChannel will sync state via syncMuted
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

  const setParticipantCount = useCallback((count: number) => {
    setState(prev => ({ ...prev, participantCount: count }));
  }, []);

  return (
    <VoiceContext.Provider value={{ ...state, joinVoice, leaveVoice, toggleMute, toggleDeafen, setParticipantCount, registerMuteHandler, syncMuted }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used within a VoiceProvider');
  return ctx;
}
