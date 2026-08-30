import React, { useCallback, useMemo, useRef } from 'react';
import {
  CardRegistryContext,
  type RegistryId,
} from './CardRegistryContext.js';

type RegistryMap = Map<RegistryId, HTMLElement>;

export type { RegistryId } from './CardRegistryContext.js';

export const CardRegistryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mapRef = useRef<RegistryMap>(new Map());

  const register = useCallback((id: RegistryId, el: HTMLElement | null) => {
    if (!id) return;
    if (el) {
      mapRef.current.set(id, el);
    } else {
      mapRef.current.delete(id);
    }
  }, []);

  const getRect = useCallback((id: RegistryId): DOMRect | null => {
    const el = mapRef.current.get(id);
    return el ? el.getBoundingClientRect() : null;
  }, []);

  const getElement = useCallback((id: RegistryId): HTMLElement | null => (
    mapRef.current.get(id) ?? null
  ), []);

  const has = useCallback((id: RegistryId) => mapRef.current.has(id), []);

  const value = useMemo(() => ({ register, getElement, getRect, has }), [register, getElement, getRect, has]);

  return (
    <CardRegistryContext.Provider value={value}>
      {children}
    </CardRegistryContext.Provider>
  );
};
