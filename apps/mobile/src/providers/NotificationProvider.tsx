import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useAuthStore } from '../stores/auth.store';
import { notificationsApi } from '../lib/api';
import type { RootStackParamList } from '../navigation/types';

// ── Foreground notification handler ──────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Types ────────────────────────────────────────────────

interface NotificationData {
  channelId?: string;
  guildId?: string;
  [key: string]: unknown;
}

interface NotificationContextValue {
  expoPushToken: string | null;
  permissionStatus: Notifications.PermissionStatus | null;
  requestPermission: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  expoPushToken: null,
  permissionStatus: null,
  requestPermission: async () => {},
});

/**
 * Read the current notification context.
 *
 * ```tsx
 * const { expoPushToken, permissionStatus, requestPermission } = useNotifications();
 * ```
 */
export function useNotifications(): NotificationContextValue {
  return useContext(NotificationContext);
}

// ── Helpers ──────────────────────────────────────────────

const PROJECT_ID = '2c90539e-5fd5-4eed-a08e-507c32d77ed8';

async function getExpoPushToken(): Promise<string | null> {
  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: PROJECT_ID,
    });

    console.log('[NotificationProvider] Expo push token:', token.data);
    return token.data;
  } catch (error) {
    // This will fail on simulators — that's expected
    console.log('[NotificationProvider] Failed to get push token:', error);
    return null;
  }
}

async function requestPermissions(): Promise<Notifications.PermissionStatus> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return existingStatus;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  console.log('[NotificationProvider] Permission status:', status);
  return status;
}

// ── Android notification channel ─────────────────────────

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#7364FF',
  });
}

// ── Provider ─────────────────────────────────────────────

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<Notifications.PermissionStatus | null>(null);

  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);
  const notificationReceivedListener = useRef<Notifications.EventSubscription | null>(null);

  // We store the navigation object in a ref so the notification tap handler
  // can deep-link even if the component tree has shifted between the time the
  // notification arrived and the time the user tapped it.
  const navigationRef = useRef<NavigationProp<RootStackParamList> | null>(null);

  // Capture the navigation object from the nearest NavigationContainer.
  // This works because NotificationProvider is rendered inside the
  // NavigationContainer (or the hook is only called after the container
  // has mounted).
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const nav = useNavigation<NavigationProp<RootStackParamList>>();
    navigationRef.current = nav;
  } catch {
    // Navigation context not available yet — that is fine. We will get it
    // on the next render after NavigationContainer mounts.
  }

  // ------------------------------------------------------------------
  // Request permission (callable from outside too)
  // ------------------------------------------------------------------
  const requestPermission = useCallback(async () => {
    const status = await requestPermissions();
    setPermissionStatus(status);
  }, []);

  // ------------------------------------------------------------------
  // Register push token with backend
  // ------------------------------------------------------------------
  const registerToken = useCallback(async () => {
    const status = await requestPermissions();
    setPermissionStatus(status);

    if (status !== 'granted') {
      console.log('[NotificationProvider] Permission not granted, skipping token registration');
      return;
    }

    const token = await getExpoPushToken();
    if (!token) return;

    setExpoPushToken(token);

    try {
      await notificationsApi.registerPushToken(token, Platform.OS);
      console.log('[NotificationProvider] Push token registered with backend');
    } catch (error) {
      console.log('[NotificationProvider] Failed to register push token:', error);
    }
  }, []);

  // ------------------------------------------------------------------
  // Handle notification tap — deep-link into the app
  // ------------------------------------------------------------------
  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as NotificationData | undefined;
      if (!data) return;

      const nav = navigationRef.current;
      if (!nav) {
        console.log('[NotificationProvider] Navigation ref not available, cannot deep-link');
        return;
      }

      console.log('[NotificationProvider] Notification tapped, data:', data);

      try {
        if (data.channelId && data.guildId) {
          // Guild channel message — navigate to PortalsTab > Channel
          nav.navigate('Main', {
            screen: 'PortalsTab',
            params: {
              screen: 'Channel',
              params: {
                guildId: data.guildId as string,
                channelId: data.channelId as string,
              },
            },
          });
        } else if (data.channelId) {
          // DM message — navigate to HomeTab > DmChat
          nav.navigate('Main', {
            screen: 'HomeTab',
            params: {
              screen: 'DmChat',
              params: {
                channelId: data.channelId as string,
              },
            },
          });
        }
      } catch (error) {
        console.log('[NotificationProvider] Deep-link navigation failed:', error);
      }
    },
    [],
  );

  // ------------------------------------------------------------------
  // Set up listeners when authenticated
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!isAuthenticated) {
      // Clean up if user logs out
      setExpoPushToken(null);
      setPermissionStatus(null);
      return;
    }

    // Register the push token
    registerToken();

    // Listen for notification taps (user interacted with a notification)
    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    // Listen for incoming notifications (while app is foregrounded)
    notificationReceivedListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log(
          '[NotificationProvider] Notification received in foreground:',
          notification.request.content.title,
        );
      });

    return () => {
      if (notificationResponseListener.current) {
        notificationResponseListener.current.remove();
        notificationResponseListener.current = null;
      }
      if (notificationReceivedListener.current) {
        notificationReceivedListener.current.remove();
        notificationReceivedListener.current = null;
      }
    };
  }, [isAuthenticated, registerToken, handleNotificationResponse]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <NotificationContext.Provider
      value={{ expoPushToken, permissionStatus, requestPermission }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
