import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { onMessageCreate } from '../lib/socket';
import { sendDesktopNotification } from '../lib/notificationService';
import { pushDmNotif } from '../store/dmNotifStore';
import { addDmUnread } from '../store/dmUnreadStore';
import { playSound } from '../utils/SoundManager';

type DmChannel = {
  id: string;
  isGroup?: boolean;
  groupName?: string;
  type?: string;
  participants?: Array<{ id: string }>;
  recipients?: Array<{ id: string; username: string; displayName: string; avatarHash: string | null }>;
  otherUser?: { id: string; username: string; displayName?: string; avatarHash: string | null };
};

type Props = {
  dmChannels: DmChannel[];
  currentUserId: string | undefined;
};

/**
 * Listens for incoming DM messages and fires:
 *  1. In-app rich popup toast (DmNotificationToast)
 *  2. Browser/OS notification (if permission granted and tab is hidden)
 *  3. Notification sound
 *
 * Does NOT fire for:
 *  - Messages sent by the current user
 *  - The DM conversation the user is currently viewing
 *  - System messages
 */
export function useDmNotifications({ dmChannels, currentUserId }: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  // Keep a live ref so the socket callback always sees latest values without
  // being re-registered on every render.
  const stateRef = useRef({ location, dmChannels, currentUserId, navigate });
  useEffect(() => {
    stateRef.current = { location, dmChannels, currentUserId, navigate };
  });

  useEffect(() => {
    const unsub = onMessageCreate((msg) => {
      const { location, dmChannels, currentUserId, navigate } = stateRef.current;

      // Ignore system messages
      if (msg.isSystem) return;

      // Ignore own messages
      if (msg.authorId === currentUserId) return;

      // Only handle DM channels
      const dmChannel = dmChannels.find((d) => d.id === msg.channelId);
      if (!dmChannel) return;

      // Don't notify if already viewing this DM
      const dmMatch = location.pathname.match(/\/dm\/([^/]+)/);
      if (dmMatch?.[1] === msg.channelId) return;

      const author = msg.author;
      const authorName = author?.displayName || author?.username || 'Someone';
      const authorAvatarHash = author?.avatarHash ?? null;
      const isGroup = !!(dmChannel.isGroup || dmChannel.type === 'GROUP_DM');
      const channelName = isGroup
        ? dmChannel.groupName ||
          dmChannel.participants?.map((p: { id: string }) => p.id).join(', ') ||
          'Group DM'
        : undefined;

      // 1. In-app popup toast
      pushDmNotif({
        channelId: msg.channelId,
        authorId: msg.authorId,
        authorName,
        authorAvatarHash,
        content: msg.content,
        attachmentCount: msg.attachments?.length ?? 0,
        channelName,
        isGroup,
      });

      // 1b. Rail unread indicator (Discord-style avatar in sidebar)
      addDmUnread({
        channelId: msg.channelId,
        authorId: msg.authorId,
        authorName,
        authorAvatarHash,
        isGroup,
        groupName: channelName,
      });

      // 2. Browser/OS notification — only when tab is hidden or not focused
      if (document.hidden || !document.hasFocus()) {
        sendDesktopNotification({
          title: isGroup ? `${authorName} in ${channelName ?? 'Group DM'}` : authorName,
          body: msg.content
            ? msg.content.length > 100
              ? msg.content.slice(0, 97) + '…'
              : msg.content
            : msg.attachments?.length
              ? '📎 Sent an attachment'
              : 'Sent a message',
          channelId: msg.channelId,
          channelName: channelName ?? authorName,
          navigate,
        });
      }

      // 3. Sound
      playSound('notification');
    });

    return unsub;
  }, []); // empty deps — always uses stateRef
}
