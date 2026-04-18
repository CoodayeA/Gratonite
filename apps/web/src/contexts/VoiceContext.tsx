import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react';

export type ActiveCallType = 'guild' | 'dm';

export type ActiveCallTarget =
  | {
      type: 'guild';
      channelId: string;
      channelName: string;
      guildId: string;
      guildName: string;
    }
  | {
      type: 'dm';
      channelId: string;
      channelName: string;
    };

export interface VoiceParticipant {
  id: string;
  username: string;
  isSpeaking: boolean;
  /** Whether this participant is from a federated instance */
  isFederated?: boolean;
  /** The home instance domain (e.g. "chat.example.com") */
  instanceDomain?: string;
}

interface VoiceState {
  activeCallType: ActiveCallType | null;
  channelId: string | null;
  channelName: string;
  guildId: string;
  guildName: string;
  connected: boolean;
  muted: boolean;
  deafened: boolean;
  screenSharing: boolean;
  participants: VoiceParticipant[];
  /** Number of participants currently in the connected voice channel (including self) */
  participantCount: number;
  connectionQuality: 'good' | 'fair' | 'poor';
}

interface VoiceContextValue extends VoiceState {
  joinCall: (target: ActiveCallTarget) => void;
  clearCallState: () => void;
  joinVoice: (channelId: string, channelName: string, guildName: string, guildId: string) => void;
  leaveVoice: () => void;
  toggleMute: () => Promise<void>;
  toggleDeafen: () => void;
  startScreenShare: (sourceId?: string) => Promise<void>;
  stopScreenShare: () => Promise<void>;
  /** Update the participant count for the connected channel */
  setParticipantCount: (count: number) => void;
  /** Called by VoiceChannel to register the real LiveKit mute handler */
  registerMuteHandler: (fn: (() => Promise<void>) | null) => void;
  /** Called by voice views to register the real LiveKit deafen handler */
  registerDeafenHandler: (fn: (() => void) | null) => void;
  /** Called by VoiceChannel to register the real LiveKit disconnect handler */
  registerDisconnectHandler: (fn: (() => Promise<void>) | null) => void;
  /** Called by voice views to register the real LiveKit start screen share handler */
  registerStartScreenShareHandler: (fn: ((sourceId?: string) => Promise<void>) | null) => void;
  /** Called by voice views to register the real LiveKit stop screen share handler */
  registerStopScreenShareHandler: (fn: (() => Promise<void>) | null) => void;
  /** Called by VoiceChannel to push the authoritative isMuted value into context */
  syncMuted: (muted: boolean) => void;
  /** Called by voice views to push the authoritative isDeafened value into context */
  syncDeafened: (deafened: boolean) => void;
  /** Called by voice views to push the authoritative screen share state into context */
  syncScreenSharing: (screenSharing: boolean) => void;
  /** Called by VoiceChannel to sync connection quality */
  syncConnectionQuality: (quality: 'good' | 'fair' | 'poor') => void;
}

const defaultState: VoiceState = {
  activeCallType: null,
  channelId: null,
  channelName: '',
  guildId: '',
  guildName: '',
  connected: false,
  muted: false,
  deafened: false,
  screenSharing: false,
  participants: [],
  participantCount: 0,
  connectionQuality: 'good',
};

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<VoiceState>(defaultState);

  // Ref to the real LiveKit toggleMute, registered by VoiceChannel on mount
  const liveKitToggleMuteRef = useRef<(() => Promise<void>) | null>(null);
  // Ref to the real LiveKit toggleDeafen, registered by the active call surface
  const liveKitToggleDeafenRef = useRef<(() => void) | null>(null);
  // Ref to the real LiveKit disconnect, registered by VoiceChannel on mount
  const liveKitDisconnectRef = useRef<(() => Promise<void>) | null>(null);
  // Refs to the real LiveKit screen share controls, registered by the active call surface
  const liveKitStartScreenShareRef = useRef<((sourceId?: string) => Promise<void>) | null>(null);
  const liveKitStopScreenShareRef = useRef<(() => Promise<void>) | null>(null);

  const registerMuteHandler = useCallback((fn: (() => Promise<void>) | null) => {
    liveKitToggleMuteRef.current = fn;
  }, []);

  const registerDeafenHandler = useCallback((fn: (() => void) | null) => {
    liveKitToggleDeafenRef.current = fn;
  }, []);

  const registerDisconnectHandler = useCallback((fn: (() => Promise<void>) | null) => {
    liveKitDisconnectRef.current = fn;
  }, []);

  const registerStartScreenShareHandler = useCallback((fn: ((sourceId?: string) => Promise<void>) | null) => {
    liveKitStartScreenShareRef.current = fn;
  }, []);

  const registerStopScreenShareHandler = useCallback((fn: (() => Promise<void>) | null) => {
    liveKitStopScreenShareRef.current = fn;
  }, []);

  const syncMuted = useCallback((muted: boolean) => {
    setState(prev => ({ ...prev, muted }));
  }, []);

  const syncDeafened = useCallback((deafened: boolean) => {
    setState(prev => ({ ...prev, deafened }));
  }, []);

  const syncScreenSharing = useCallback((screenSharing: boolean) => {
    setState(prev => ({ ...prev, screenSharing }));
  }, []);

  const syncConnectionQuality = useCallback((connectionQuality: 'good' | 'fair' | 'poor') => {
    setState(prev => ({ ...prev, connectionQuality }));
  }, []);

  const joinCall = useCallback((target: ActiveCallTarget) => {
    setState({
      activeCallType: target.type,
      channelId: target.channelId,
      channelName: target.channelName,
      guildId: target.type === 'guild' ? target.guildId : '',
      guildName: target.type === 'guild' ? target.guildName : '',
      connected: true,
      muted: true,
      deafened: false,
      screenSharing: false,
      participants: [],
      participantCount: 1, // self
      connectionQuality: 'good',
    });
  }, []);

  const joinVoice = useCallback((channelId: string, channelName: string, guildName: string, guildId: string) => {
    joinCall({ type: 'guild', channelId, channelName, guildId, guildName });
  }, [joinCall]);

  const clearCallState = useCallback(() => {
    liveKitToggleMuteRef.current = null;
    liveKitToggleDeafenRef.current = null;
    liveKitDisconnectRef.current = null;
    liveKitStartScreenShareRef.current = null;
    liveKitStopScreenShareRef.current = null;
    setState(defaultState);
  }, []);

  const leaveVoice = useCallback(() => {
    // If a LiveKit disconnect handler is registered, call it to properly tear
    // down the WebRTC room (sets the intentional-disconnect flag in useLiveKit).
    if (liveKitDisconnectRef.current) {
      liveKitDisconnectRef.current().catch(() => {});
    }
    clearCallState();
  }, [clearCallState]);

  const toggleMute = useCallback(async () => {
    if (liveKitToggleMuteRef.current) {
      await liveKitToggleMuteRef.current();
      setState(prev => ({ ...prev, muted: !prev.muted }));
      return;
    }
    setState(prev => ({ ...prev, muted: !prev.muted }));
  }, []);

  const toggleDeafen = useCallback(() => {
    if (liveKitToggleDeafenRef.current) {
      liveKitToggleDeafenRef.current();
    }
    setState(prev => {
      const newDeafened = !prev.deafened;
      return { ...prev, deafened: newDeafened, muted: newDeafened ? true : prev.muted };
    });
  }, []);

  const startScreenShare = useCallback(async (sourceId?: string) => {
    if (!liveKitStartScreenShareRef.current) {
      throw new Error('No active call available for screen sharing.');
    }
    await liveKitStartScreenShareRef.current(sourceId);
    setState(prev => ({ ...prev, screenSharing: true }));
  }, []);

  const stopScreenShare = useCallback(async () => {
    if (liveKitStopScreenShareRef.current) {
      await liveKitStopScreenShareRef.current();
    }
    setState(prev => ({ ...prev, screenSharing: false }));
  }, []);

  const setParticipantCount = useCallback((count: number) => {
    setState(prev => ({ ...prev, participantCount: count }));
  }, []);

  return (
    <VoiceContext.Provider value={{ ...state, joinCall, clearCallState, joinVoice, leaveVoice, toggleMute, toggleDeafen, startScreenShare, stopScreenShare, setParticipantCount, registerMuteHandler, registerDeafenHandler, registerDisconnectHandler, registerStartScreenShareHandler, registerStopScreenShareHandler, syncMuted, syncDeafened, syncScreenSharing, syncConnectionQuality }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used within a VoiceProvider');
  return ctx;
}
