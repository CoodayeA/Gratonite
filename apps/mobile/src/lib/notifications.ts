import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { push } from './api';

// Configure foreground notification display
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '2c90539e-5fd5-4eed-a08e-507c32d77ed8',
    });
    const token = tokenData.data;

    await push.register(token, Platform.OS);
    return token;
  } catch {
    return null;
  }
}

export function setupNotificationHandlers(
  navigationRef: any,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data;
      if (!navigationRef?.current) return;

      if (data?.channelId && data?.type === 'dm') {
        navigationRef.current.navigate('DirectMessage', {
          channelId: data.channelId,
          recipientName: data.senderName || 'User',
          recipientId: data.senderId || undefined,
        });
      } else if (data?.channelId && data?.guildId) {
        navigationRef.current.navigate('ChannelChat', {
          channelId: data.channelId,
          channelName: data.channelName || 'channel',
          guildId: data.guildId,
        });
      }
    },
  );

  return () => subscription.remove();
}
