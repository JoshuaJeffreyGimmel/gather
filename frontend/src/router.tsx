import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * A ~60-line router. The app has tabs plus a handful of stacked screens, so a
 * dependency would cost more than it saves. Real URLs and the browser back
 * button both work.
 */

interface RouterValue {
  path: string;
  go: (to: string) => void;
  replace: (to: string) => void;
  back: () => void;
  /** How many entries deep into this session's history we are. */
  depth: number;
}

const RouterContext = createContext<RouterValue | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => window.location.pathname || '/');
  const [depth, setDepth] = useState(() => Number(window.history.state?.depth ?? 0));

  useEffect(() => {
    const onPop = () => {
      setPath(window.location.pathname || '/');
      setDepth(Number(window.history.state?.depth ?? 0));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback((to: string) => {
    if (to === window.location.pathname) return;
    const next = Number(window.history.state?.depth ?? 0) + 1;
    window.history.pushState({ depth: next }, '', to);
    setPath(to);
    setDepth(next);
  }, []);

  const replace = useCallback((to: string) => {
    const current = Number(window.history.state?.depth ?? 0);
    window.history.replaceState({ depth: current }, '', to);
    setPath(to);
    setDepth(current);
  }, []);

  const back = useCallback(() => {
    if (Number(window.history.state?.depth ?? 0) > 0) window.history.back();
    else {
      window.history.replaceState({ depth: 0 }, '', '/');
      setPath('/');
      setDepth(0);
    }
  }, []);

  const value = useMemo(() => ({ path, go, replace, back, depth }), [path, go, replace, back, depth]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter outside RouterProvider');
  return ctx;
}

/**
 * Matches "/a/:id" against the current path and returns the parameters, or
 * null when it does not match.
 */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    const seg = p[i];
    if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(s[i]);
    else if (seg !== s[i]) return null;
  }
  return params;
}
