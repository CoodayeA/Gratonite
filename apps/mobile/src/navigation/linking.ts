import type { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import type { RootStackParamList } from './types';

const prefix = Linking.createURL('/');

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [prefix, 'gratonite://'],

  // Handle notification deep links
  async getInitialURL() {
    // Check if the app was opened from a notification
    const response = await Notifications.getLastNotificationResponseAsync();
    const url = response?.notification.request.content.data?.['url'];
    if (typeof url === 'string') return url;

    // Otherwise, check standard deep link
    const initialUrl = await Linking.getInitialURL();
    return initialUrl;
  },

  subscribe(listener) {
    // Listen for incoming deep links
    const linkSub = Linking.addEventListener('url', ({ url }) => listener(url));

    // Listen for notification taps
    const notifSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.['url'];
      if (typeof url === 'string') listener(url);
    });

    return () => {
      linkSub.remove();
      notifSub.remove();
    };
  },

  config: {
    screens: {
      Main: {
        screens: {
          HomeTab: {
            screens: {
              Friends: 'friends',
              DmChat: 'dm/:channelId',
              UserProfile: 'user/:userId',
            },
          },
          PortalsTab: {
            screens: {
              GuildList: 'portals',
              Guild: 'guild/:guildId',
              Channel: 'guild/:guildId/channel/:channelId',
              Thread: 'channel/:channelId/thread/:threadId',
              Invite: 'invite/:code',
            },
          },
          DiscoverTab: {
            screens: {
              Discover: 'discover',
              GuildPreview: 'discover/:guildId',
            },
          },
          InboxTab: {
            screens: {
              Notifications: 'inbox',
            },
          },
          ProfileTab: {
            screens: {
              Settings: 'settings',
            },
          },
        },
      },
      Auth: {
        screens: {
          Login: 'login',
          Register: 'register',
          VerifyEmailConfirm: 'verify/:token',
        },
      },
    },
  },
};
