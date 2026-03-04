/**
 * useVoiceSounds — Plays join/leave sounds when users enter/exit voice channels.
 *
 * Listens for VOICE_STATE_UPDATE socket events and uses the SoundManager
 * to play the corresponding sound. Respects the global soundMuted setting.
 *
 * Mount this hook in a top-level component (e.g. App.tsx) so it is always active.
 */
import { useEffect } from 'react';
import { onVoiceStateUpdate, type VoiceStateUpdatePayload } from '../lib/socket';
import { playSound } from '../utils/SoundManager';

/**
 * Optional filter: only play sounds for a specific channelId.
 * If not provided, plays sounds for all voice state events.
 */
export function useVoiceSounds(channelId?: string): void {
    useEffect(() => {
        const unsub = onVoiceStateUpdate((payload: VoiceStateUpdatePayload) => {
            // If filtering by channel, skip events from other channels
            if (channelId && payload.channelId !== channelId) return;

            if (payload.type === 'join') {
                playSound('join');
            } else if (payload.type === 'leave') {
                playSound('leave');
            }
        });

        return unsub;
    }, [channelId]);
}
