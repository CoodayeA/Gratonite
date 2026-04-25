import React, { createContext, useState, useEffect } from 'react';

export interface TrustCardState {
  visible: Record<string, boolean>;
  dismissCard: (cardId: string) => void;
  showCard: (cardId: string) => void;
}

const TrustCardContext = createContext<TrustCardState | undefined>(undefined);

export function TrustCardProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState<Record<string, boolean>>({
    'dm-encryption': true,
    'federation-intro': true,
    'privacy-controls': true,
  });

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('trust-card-visibility');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) {
          setVisible(prev => ({ ...prev, ...parsed }));
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('trust-card-visibility', JSON.stringify(visible));
    } catch (err) {
      console.warn('Failed to save trust card visibility:', err);
    }
  }, [visible]);

  const dismissCard = (cardId: string) => {
    setVisible(prev => ({ ...prev, [cardId]: false }));
  };

  const showCard = (cardId: string) => {
    setVisible(prev => ({ ...prev, [cardId]: true }));
  };

  return (
    <TrustCardContext.Provider value={{ visible, dismissCard, showCard }}>
      {children}
    </TrustCardContext.Provider>
  );
}

export function useTrustCards(): TrustCardState {
  const ctx = React.useContext(TrustCardContext);
  if (!ctx) {
    throw new Error('useTrustCards must be used within TrustCardProvider');
  }
  return ctx;
}
