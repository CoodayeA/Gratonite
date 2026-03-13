import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

/**
 * Task #92: Handles desktop notification action callbacks.
 * Notification click: navigates to channel.
 * Notification reply (macOS): sends message to channel.
 * Notification mark-read: marks channel as read.
 */
export function useDesktopNotifications() {
  const navigate = useNavigate();

  useEffect(() => {
    const desktop = window.gratoniteDesktop;
    if (!desktop?.isDesktop) return;

    const cleanups: Array<() => void> = [];

    // Handle notification click — navigate to the channel
    if (desktop.onNotificationClicked) {
      cleanups.push(desktop.onNotificationClicked((data) => {
        if (data.guildId && data.channelId) {
          navigate(`/guild/${data.guildId}/channel/${data.channelId}`);
        } else if (data.channelId) {
          navigate(`/dm/${data.channelId}`);
        }
      }));
    }

    // Handle inline reply from macOS notification
    if (desktop.onNotificationReply) {
      cleanups.push(desktop.onNotificationReply((data) => {
        if (data.channelId && data.reply) {
          api.messages.send(data.channelId, { content: data.reply }).catch(() => {});
        }
      }));
    }

    // Handle mark-as-read from notification action
    if (desktop.onNotificationMarkRead) {
      cleanups.push(desktop.onNotificationMarkRead((data) => {
        if (data.channelId) {
          api.channels.markRead(data.channelId).catch(() => {});
        }
      }));
    }

    return () => cleanups.forEach(fn => fn());
  }, [navigate]);
}
