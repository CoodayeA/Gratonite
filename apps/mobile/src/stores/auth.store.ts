import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatar: string | null;
  banner: string | null;
  tier: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;

  login: (user: AuthUser, token: string) => Promise<void>;
  logout: () => Promise<void>;
  setToken: (token: string) => void;
  updateUser: (partial: Partial<AuthUser>) => void;
}

const TOKEN_KEY = 'gratonite_token';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: async (user, token) => {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch {
      // SecureStore may not be available in all envs
    }
    set({ user, token, isAuthenticated: true });
  },

  logout: async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      // ignore
    }
    set({ user: null, token: null, isAuthenticated: false });
  },

  setToken: (token) => set({ token }),

  updateUser: (partial) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...partial } : null,
    })),
}));
