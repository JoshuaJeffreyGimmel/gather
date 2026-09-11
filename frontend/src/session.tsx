import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, getToken, setToken } from './api';
import type { Me } from './types';

type Status = 'loading' | 'anonymous' | 'signed-in';

interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error';
}

interface SessionValue {
  status: Status;
  me: Me | null;
  signIn: (token: string, user: Me) => void;
  signOut: () => Promise<void>;
  setMe: (user: Me) => void;
  refresh: () => Promise<void>;
  toasts: Toast[];
  toast: (text: string, tone?: 'ok' | 'error') => void;
  /** Shows the right German sentence for a failed API call. */
  toastError: (err: unknown) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(() => (getToken() ? 'loading' : 'anonymous'));
  const [me, setMeState] = useState<Me | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  useEffect(() => {
    if (!getToken()) return;
    let alive = true;
    api.me()
      .then(({ user }) => { if (alive) { setMeState(user); setStatus('signed-in'); } })
      .catch(() => { if (alive) { setToken(null); setMeState(null); setStatus('anonymous'); } });
    return () => { alive = false; };
  }, []);

  const toast = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, text, tone }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 2800);
  }, []);

  const toastError = useCallback((err: unknown) => {
    toast(err instanceof ApiError ? err.german : 'Das hat gerade nicht geklappt.', 'error');
  }, [toast]);

  const signIn = useCallback((token: string, user: Me) => {
    setToken(token);
    setMeState(user);
    setStatus('signed-in');
  }, []);

  const signOut = useCallback(async () => {
    try { await api.logout(); } catch { /* the token is going away either way */ }
    setToken(null);
    setMeState(null);
    setStatus('anonymous');
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.me();
      setMeState(user);
    } catch {
      setToken(null);
      setMeState(null);
      setStatus('anonymous');
    }
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ status, me, signIn, signOut, setMe: setMeState, refresh, toasts, toast, toastError }),
    [status, me, signIn, signOut, refresh, toasts, toast, toastError]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}
