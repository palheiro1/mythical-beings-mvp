import { createContext } from 'react';

export type RegistryId = string;

export type CardRegistryContextType = {
  register: (id: RegistryId, el: HTMLElement | null) => void;
  getElement: (id: RegistryId) => HTMLElement | null;
  getRect: (id: RegistryId) => DOMRect | null;
  has: (id: RegistryId) => boolean;
};

export const CardRegistryContext = createContext<CardRegistryContextType | null>(null);
