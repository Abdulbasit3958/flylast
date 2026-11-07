'use client';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, auth } from '@/lib/firebase-client';
import type { AppUser, Plan, Subscription } from '@/lib/domain';

export type Me = { user: AppUser | null; sub?: Subscription | null; plan?: Plan | null; history?: Subscription[] };

type Ctx = { fbUser: User | null; me: Me | null; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void> };
const AuthCtx = createContext<Ctx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setMe(auth.currentUser ? await api<Me>('/api/me').catch(() => ({ user: null })) : null);
  }, []);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setFbUser(u);
        await refresh();
        setLoading(false);
      }),
    [refresh],
  );

  const logout = async () => {
    await signOut(auth);
    setMe(null);
  };

  return <AuthCtx.Provider value={{ fbUser, me, loading, refresh, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
