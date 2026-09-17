import { useSyncExternalStore } from 'react';

// Match the phone/short-landscape layout, including keyboard users at that size.
export const DIRECT_CARDS_QUERY = '(max-width: 767px), (orientation: landscape) and (max-height: 600px)';
const snapshot = () => typeof window !== 'undefined' && (window.matchMedia?.(DIRECT_CARDS_QUERY).matches ?? false);
const serverSnapshot = () => false;
function subscribe(notify: () => void) {
  const media = window.matchMedia?.(DIRECT_CARDS_QUERY);
  media?.addEventListener('change', notify);
  return () => media?.removeEventListener('change', notify);
}

export function useDirectCards() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
