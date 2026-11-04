import { useEffect, useState } from 'react';

/** Wide screens get the desktop layout: side rail navigation and a right-hand detail panel. */
export const DESKTOP_QUERY = '(min-width: 960px)';

export function useMediaQuery(query: string): boolean {
  const read = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.(query)?.matches);
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [query]);
  return matches;
}

export const useIsDesktop = () => useMediaQuery(DESKTOP_QUERY);
