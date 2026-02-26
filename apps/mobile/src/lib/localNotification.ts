import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';

/**
 * Schedule an immediate local notification.
 *
 * The notification is only shown when the app is NOT in the foreground
 * (i.e. background or inactive) so the user isn't double-notified while
 * they're already looking at the chat.
 */
export async function scheduleLocalNotification(data: {
  title: string;
  body: string;
  channelId: string;
  guildId?: string;
}): Promise<void> {
  // Only show local notification when app is NOT active (background/inactive)
  if (AppState.currentState === 'active') return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: data.title,
      body: data.body,
      data: { channelId: data.channelId, guildId: data.guildId },
      sound: 'default',
    },
    trigger: null, // immediate
  });
}
