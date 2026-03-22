import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { PresenceType } from '../components/modals/PresenceMenu';
import { api, getAccessToken } from '../lib/api';
import { isAuthRuntimeExpired, useAuthRuntimeState } from '../lib/authRuntime';

export interface UserProfile {
    id: string;
    name: string;
    handle: string;
    email: string;
    avatarUrl: string | null;
    avatarHash: string | null;
    bannerHash: string | null;
    status: PresenceType;
    customStatus: string | null;
    badges: string[];
    isAdmin: boolean;
    emailVerified: boolean;
    onboardingCompleted: boolean;
    createdAt: string | null;
}

interface UserContextType {
    user: UserProfile;
    updateUser: (updates: Partial<UserProfile>) => void;
    gratoniteBalance: number;
    setGratoniteBalance: React.Dispatch<React.SetStateAction<number>>;
    loading: boolean;
    refetchUser: () => Promise<void>;
}

const defaultUser: UserProfile = {
    id: '',
    name: '',
    handle: '',
    email: '',
    avatarUrl: null,
    avatarHash: null,
    bannerHash: null,
    status: 'online',
    customStatus: null,
    badges: [],
    isAdmin: false,
    emailVerified: false,
    onboardingCompleted: true, // default true to avoid flash on load
    createdAt: null,
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
    const ctx = useContext(UserContext);
    if (!ctx) throw new Error('useUser must be used within UserProvider');
    return ctx;
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<UserProfile>(defaultUser);
    const [gratoniteBalance, setGratoniteBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const authRuntimeState = useAuthRuntimeState();
    const inFlightFetchRef = useRef<Promise<void> | null>(null);

    const fetchUser = useCallback(async () => {
        if (isAuthRuntimeExpired()) {
            setLoading(false);
            return;
        }
        if (inFlightFetchRef.current) {
            return inFlightFetchRef.current;
        }
        if (!getAccessToken()) {
            setLoading(false);
            return;
        }

        const fetchPromise = (async () => {
            try {
                const me = await api.users.getMe();
                const profile = me.profile;
                const avatarHash = profile?.avatarHash;
                const avatarUrl = avatarHash
                    ? `${(api as any)._baseUrl || ''}/files/${avatarHash}`
                    : null;

                setUser({
                    id: me.id,
                    name: profile?.displayName || me.username,
                    handle: me.username,
                    email: me.email,
                    avatarUrl,
                    avatarHash: avatarHash ?? null,
                    bannerHash: profile?.bannerHash ?? null,
                    status: (me.status as PresenceType) || 'online',
                    customStatus: null,
                    badges: [],
                    isAdmin: me.isAdmin,
                    emailVerified: me.emailVerified ?? false,
                    onboardingCompleted: me.onboardingCompleted ?? false,
                    createdAt: me.createdAt ?? null,
                });

                const wallet = await api.economy.getWallet().catch(() => null);
                if (wallet) {
                    setGratoniteBalance(wallet.balance);
                }
            } catch {
                // Token may be invalid - leave as default
            } finally {
                setLoading(false);
            }
        })();

        inFlightFetchRef.current = fetchPromise;
        try {
            await fetchPromise;
        } finally {
            if (inFlightFetchRef.current === fetchPromise) {
                inFlightFetchRef.current = null;
            }
        }
    }, []);

    useEffect(() => {
        if (authRuntimeState === 'expired') {
            setLoading(false);
            return;
        }
        fetchUser();
    }, [fetchUser, authRuntimeState]);

    // Refetch user when tab regains focus (e.g. after email verification in another tab)
    const lastFetchRef = useRef(0);
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible' && user.id && Date.now() - lastFetchRef.current > 30_000) {
                lastFetchRef.current = Date.now();
                fetchUser();
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [fetchUser, user.id]);

    const updateUser = useCallback((updates: Partial<UserProfile>) => {
        setUser(prev => ({ ...prev, ...updates }));
    }, []);

    return (
        <UserContext.Provider value={{ user, updateUser, gratoniteBalance, setGratoniteBalance, loading, refetchUser: fetchUser }}>
            {children}
        </UserContext.Provider>
    );
};
