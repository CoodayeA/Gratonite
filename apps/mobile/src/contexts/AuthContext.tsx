import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, users, loadTokens, setTokens, getAccessToken } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, load stored tokens and fetch user
  useEffect(() => {
    (async () => {
      try {
        await loadTokens();
        if (getAccessToken()) {
          const me = await users.getMe();
          setUser(me);
          connectSocket();
        }
      } catch {
        // Token invalid or expired
        await setTokens(null, null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (loginStr: string, password: string) => {
    const res = await auth.login({ login: loginStr, password });
    await setTokens(res.accessToken, res.refreshToken);
    const me = await users.getMe();
    setUser(me);
    connectSocket();
  };

  const register = async (username: string, email: string, password: string) => {
    const res = await auth.register({ username, email, password });
    await setTokens(res.accessToken, res.refreshToken);
    const me = await users.getMe();
    setUser(me);
    connectSocket();
  };

  const logout = async () => {
    try {
      await auth.logout();
    } catch {
      // ignore
    }
    disconnectSocket();
    await setTokens(null, null);
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

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
