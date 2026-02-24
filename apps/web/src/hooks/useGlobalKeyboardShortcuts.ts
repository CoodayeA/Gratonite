import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUiStore } from '@/stores/ui.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { SHORTCUTS, matchesShortcut } from '@/lib/keyboardShortcuts';

/**
 * Global keyboard shortcut handler.
 * Mounted once at the AppLayout level.
 * Skips shortcuts when focus is inside text inputs (except formatting shortcuts).
 */
export function useGlobalKeyboardShortcuts() {
  const navigate = useNavigate();
  const openModal = useUiStore((s) => s.openModal);
  const activeModal = useUiStore((s) => s.activeModal);
  const togglePinnedPanel = useUiStore((s) => s.togglePinnedPanel);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Never intercept when a modal is open (Escape is handled by the modal itself)
      if (activeModal) return;

      // Check if focus is in a text input — allow formatting shortcuts, block navigation ones
      const target = event.target as HTMLElement;
      const isInTextInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      for (const def of SHORTCUTS) {
        if (!matchesShortcut(event, def)) continue;

        // Formatting shortcuts only apply inside text inputs
        if (def.category === 'Formatting') {
          if (!isInTextInput) continue;
          // Let the browser/composer handle formatting natively — don't preventDefault
          return;
        }

        // All other shortcuts are blocked when typing in an input
        if (isInTextInput) continue;

        event.preventDefault();
        handleAction(def.action);
        return;
      }
    }

    function handleAction(action: string) {
      switch (action) {
        case 'open-settings':
          openModal('settings', { type: 'user' });
          break;

        case 'show-shortcuts':
          openModal('shortcuts-help');
          break;

        case 'create-server':
          openModal('create-guild');
          break;

        case 'toggle-pins':
          togglePinnedPanel();
          break;

        case 'prev-channel':
        case 'next-channel':
          navigateChannel(action === 'prev-channel' ? -1 : 1);
          break;

        case 'prev-server':
        case 'next-server':
          navigateServer(action === 'prev-server' ? -1 : 1);
          break;

        // These are stubs — can be wired once voice and search are fully integrated
        case 'toggle-mute':
        case 'toggle-deafen':
        case 'search-channel':
        case 'search-all':
        case 'quick-switcher':
        case 'upload-file':
        case 'emoji-picker':
          // TODO: wire to respective subsystems
          break;
      }
    }

    function navigateChannel(direction: number) {
      const state = useChannelsStore.getState();
      const currentChannelId = state.currentChannelId;
      if (!currentChannelId) return;

      const currentChannel = state.channels.get(currentChannelId);
      if (!currentChannel?.guildId) return;

      const guildChannelIds = state.channelsByGuild.get(currentChannel.guildId) ?? [];
      // Filter to text channels only (skip categories)
      const textChannelIds = guildChannelIds.filter((id) => {
        const ch = state.channels.get(id);
        return ch && ch.type !== 'GUILD_CATEGORY' && ch.type !== 'GUILD_VOICE';
      });

      const currentIndex = textChannelIds.indexOf(currentChannelId);
      if (currentIndex < 0) return;

      const newIndex = currentIndex + direction;
      if (newIndex < 0 || newIndex >= textChannelIds.length) return;

      const newChannelId = textChannelIds[newIndex];
      navigate(`/guild/${currentChannel.guildId}/channel/${newChannelId}`);
    }

    function navigateServer(direction: number) {
      const guilds = Array.from(useGuildsStore.getState().guilds.values());
      if (guilds.length === 0) return;

      // Find current guild from URL
      const match = window.location.pathname.match(/\/guild\/(\d+)/);
      const currentGuildId = match?.[1];
      const guildIds = guilds.map((g) => g.id);
      const currentIndex = currentGuildId ? guildIds.indexOf(currentGuildId) : -1;

      let newIndex: number;
      if (currentIndex < 0) {
        newIndex = direction > 0 ? 0 : guildIds.length - 1;
      } else {
        newIndex = currentIndex + direction;
        if (newIndex < 0) newIndex = guildIds.length - 1;
        if (newIndex >= guildIds.length) newIndex = 0;
      }

      const targetGuildId = guildIds[newIndex];
      if (!targetGuildId) return;
      // Navigate to the first text channel of the target guild
      const channelState = useChannelsStore.getState();
      const guildChannelIds = channelState.channelsByGuild.get(targetGuildId) ?? [];
      const firstTextChannel = guildChannelIds.find((id) => {
        const ch = channelState.channels.get(id);
        return ch && ch.type !== 'GUILD_CATEGORY' && ch.type !== 'GUILD_VOICE';
      });

      if (firstTextChannel) {
        navigate(`/guild/${targetGuildId}/channel/${firstTextChannel}`);
      } else {
        navigate(`/guild/${targetGuildId}`);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeModal, navigate, openModal, togglePinnedPanel]);
}
