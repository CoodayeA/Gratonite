import { useContext } from 'react';
import ActivationContext, { ActivationContextType } from '../contexts/ActivationContext';

export function useActivationContext(): ActivationContextType {
  const ctx = useContext(ActivationContext);
  if (!ctx) {
    throw new Error('useActivationContext must be used within ActivationProvider');
  }
  return ctx;
}
