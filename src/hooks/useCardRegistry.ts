import { useContext } from 'react';
import {
  CardRegistryContext,
  type CardRegistryContextType,
} from '../context/CardRegistryContext.js';

export function useCardRegistry(): CardRegistryContextType {
  const context = useContext(CardRegistryContext);
  if (!context) throw new Error('useCardRegistry must be used within CardRegistryProvider');
  return context;
}
