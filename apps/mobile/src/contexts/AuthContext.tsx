import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AppState as RNAppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { auth, users, userSettings as settingsApi, loadTokens, setTokens, getAccessToken, encryption as encryptionApi, initServerConfig } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { presenceStore } from '../lib/presenceStore';
import { getOrCreateKeyPair, clearKeyPairFromSecureStore } from '../lib/crypto';
import { publicKeyCache } from '../lib/publicKeyCache';
import { clearCacheEncryptionKey, closeDb } from '../lib/offlineDb';
import { themeStore } from '../lib/themeStore';
import type { ThemeName } from '../lib/themes';
import type { User, PresenceStatus } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (login: string, password: string, mfaCode?: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<string>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
  updateProfile: (data: Partial<Pick<User, 'displayName' | 'bio' | 'pronouns'>>) => Promise<void>;
  updateStatus: (status: PresenceStatus) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, load stored tokens and fetch user
  useEffect(() => {
    (async () => {
      try {
        await initServerConfig();
        await loadTokens();
        // Restore saved theme
        const savedTheme = await SecureStore.getItemAsync('gratonite_theme');
        if (savedTheme) themeStore.setTheme(savedTheme as ThemeName);

        let token = getAccessToken();
        if (!token) {
          token = await auth.refresh();
        }

        if (token) {
          const me = await users.getMe();
          setUser(me);
          connectSocket();
          // Restore saved font size from user settings
          try {
            const s = await settingsApi.get();
            if (s.fontSize) themeStore.setFontSize(s.fontSize);
          } catch {
            // non-critical
          }
        }
      } catch (err: any) {
        // Only clear tokens on auth errors, not network failures
        if (err.status === 401 || err.status === 403) {
          await setTokens(null, null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (loginStr: string, password: string, mfaCode?: string) => {
    const res = await auth.login({ login: loginStr, password, mfaCode });
    await setTokens(res.accessToken, res.refreshToken);
    const me = await users.getMe();
    setUser(me);
    connectSocket();
    // Initialize E2E keys (fire-and-forget)
    getOrCreateKeyPair(me.id, (pubJwk) => encryptionApi.uploadPublicKey(pubJwk)).catch(() => {});
  };

  const register = async (username: string, email: string, password: string): Promise<string> => {
    const res = await auth.register({ username, email, password });
    return res.email;
  };

  const logout = async () => {
    try {
      await auth.logout();
    } catch {
      // ignore
    }
    disconnectSocket();
    await setTokens(null, null);
    // Clear E2E keys and encrypted cache key
    await clearKeyPairFromSecureStore().catch(() => {});
    await clearCacheEncryptionKey().catch(() => {});
    await closeDb().catch(() => {});
    publicKeyCache.clearAll();
    setUser(null);
  };

  const refetchUser = async () => {
    try {
      const me = await users.getMe();
      setUser(me);
    } catch {
      // ignore
    }
  };

  const updateProfile = async (data: Partial<Pick<User, 'displayName' | 'bio' | 'pronouns'>>) => {
    const updated = await users.updateMe(data);
    setUser(updated);
  };

  const updateStatus = async (status: PresenceStatus) => {
    await users.updatePresence(status);
    setUser(prev => prev ? { ...prev, status } : prev);
    if (user) presenceStore.set(user.id, status);
  };

  // Auto-idle: when app goes to background, set idle; when it returns, restore.
  // Skip if user is DND or invisible — those are intentional states.
  const statusBeforeBackground = useRef<PresenceStatus | null>(null);

  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    if (!user) return;
    const sub = RNAppState.addEventListener('change', (nextState) => {
      const current = userRef.current;
      if (!current) return;
      if (nextState === 'background' || nextState === 'inactive') {
        // Only auto-idle from "online" — don't override DND/invisible
        if (current.status === 'online') {
          statusBeforeBackground.current = current.status;
          users.updatePresence('idle').catch(() => {});
        }
      } else if (nextState === 'active') {
        // Restore previous status if we were the ones who set idle
        if (statusBeforeBackground.current) {
          const restore = statusBeforeBackground.current;
          statusBeforeBackground.current = null;
          users.updatePresence(restore).catch(() => {});
          setUser(prev => prev ? { ...prev, status: restore } : prev);
          presenceStore.set(current.id, restore);
        }
      }
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refetchUser, updateProfile, updateStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
