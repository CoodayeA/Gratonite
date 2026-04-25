import React, { createContext, useState, useEffect } from 'react';

export interface ActivationTask {
  id: 'send_message' | 'join_guild' | 'read_dm' | 'enable_2fa';
  label: string;
  description: string;
  completed: boolean;
  hint?: string;
}

export interface ActivationContextType {
  tasks: ActivationTask[];
  completionPercent: number;
  markTaskComplete: (taskId: ActivationTask['id']) => void;
  dismissChecklist: () => void;
  isDismissed: boolean;
}

const ActivationContext = createContext<ActivationContextType | undefined>(undefined);

export function ActivationProvider({ children }: { children: React.ReactNode }) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [tasks, setTasks] = useState<ActivationTask[]>([
    { id: 'send_message', label: 'Send a message', description: 'Participate in any channel', completed: false },
    { id: 'join_guild', label: 'Join a guild', description: 'Explore community servers', completed: false },
    { id: 'read_dm', label: 'Read a DM', description: 'End-to-end encrypted messaging', completed: false },
    { id: 'enable_2fa', label: 'Enable 2FA', description: 'Secure your account', completed: false },
  ]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('activation-state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate structure
        if (parsed.tasks && Array.isArray(parsed.tasks)) {
          const validTasks = parsed.tasks.filter((t: any) => 
            t.id && t.label && t.description && typeof t.completed === 'boolean'
          );
          if (validTasks.length > 0) {
            setTasks(validTasks);
          }
        }
        if (typeof parsed.dismissed === 'boolean') {
          setIsDismissed(parsed.dismissed);
        }
      } catch (err) {
        console.error('Failed to load activation state:', err);
        // Silently fall back to default state
      }
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('activation-state', JSON.stringify({ tasks, dismissed: isDismissed }));
    } catch (err) {
      console.warn('Failed to save activation state:', err);
      // In a real app, you might emit a toast notification here
    }
  }, [tasks, isDismissed]);

  const completionPercent = Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100);

  const markTaskComplete = (taskId: ActivationTask['id']) => {
    setTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, completed: true } : t))
    );
  };

  const dismissChecklist = () => setIsDismissed(true);

  return (
    <ActivationContext.Provider value={{ tasks, completionPercent, markTaskComplete, dismissChecklist, isDismissed }}>
      {children}
    </ActivationContext.Provider>
  );
}

export default ActivationContext;
