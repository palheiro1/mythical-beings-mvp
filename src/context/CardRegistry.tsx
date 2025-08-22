import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';

export type RegistryId = string;

type RegistryMap = Map<RegistryId, HTMLElement>;

type CardRegistryContextType = {
  register: (id: RegistryId, el: HTMLElement | null) => void;
  getRect: (id: RegistryId) => DOMRect | null;
  has: (id: RegistryId) => boolean;
};

const CardRegistryContext = createContext<CardRegistryContextType | null>(null);

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

  const has = useCallback((id: RegistryId) => mapRef.current.has(id), []);

  const value = useMemo(() => ({ register, getRect, has }), [register, getRect, has]);

  return (
    <CardRegistryContext.Provider value={value}>
      {children}
    </CardRegistryContext.Provider>
  );
};

export function useCardRegistry(): CardRegistryContextType {
  const ctx = useContext(CardRegistryContext);
  if (!ctx) throw new Error('useCardRegistry must be used within CardRegistryProvider');
  return ctx;
}
