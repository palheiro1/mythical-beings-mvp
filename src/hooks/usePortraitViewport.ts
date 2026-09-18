import { useSyncExternalStore } from 'react';

export const PORTRAIT_PHONE_QUERY = '(max-width: 767px) and (orientation: portrait)';
const snapshot = () => typeof window !== 'undefined' && (window.matchMedia?.(PORTRAIT_PHONE_QUERY).matches ?? false);
const serverSnapshot = () => false;
function subscribe(notify: () => void) {
  const media = window.matchMedia?.(PORTRAIT_PHONE_QUERY);
  media?.addEventListener('change', notify);
  return () => media?.removeEventListener('change', notify);
}

export function usePortraitViewport() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
