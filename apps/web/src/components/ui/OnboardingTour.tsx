import { useState, useEffect } from 'react';
import { X, ChevronRight, Palette, Plus, User, Circle, CheckCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useTheme } from './ThemeProvider';

type Step = {
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: string;
};

const STEPS: Step[] = [
  {
    title: 'Pick a Theme',
    description: 'Gratonite has 30+ beautiful themes. Head to Discover -> Themes to find your style.',
    icon: <Palette size={32} style={{ color: 'var(--accent-primary)' }} />,
    action: 'Go to Discover',
  },
  {
    title: 'Join or Create a Server',
    description: 'Servers are where communities live. Click the + button in the sidebar to create one, or use an invite link to join.',
    icon: <Plus size={32} style={{ color: 'var(--accent-primary)' }} />,
  },
  {
    title: 'Customize Your Profile',
    description: 'Add a bio, avatar, and profile banner to make your profile shine.',
    icon: <User size={32} style={{ color: 'var(--accent-primary)' }} />,
    action: 'Open Settings',
  },
  {
    title: 'Set Your Status',
    description: "Let friends know what you're up to. Click your avatar at the bottom of the sidebar.",
    icon: <Circle size={32} style={{ color: '#3ba55c' }} />,
  },
  {
    title: "You're all set!",
    description: "Welcome to Gratonite! You've earned 100 bonus coins for completing the tour.",
    icon: <CheckCircle size={32} style={{ color: '#3ba55c' }} />,
  },
];

const STORAGE_KEY = 'gratonite_tour_complete';

export function OnboardingTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const { setTheme } = useTheme();

  // Suppress unused variable warning — setTheme is available for step actions
  void setTheme;

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      // Final step — grant completion reward
      localStorage.setItem(STORAGE_KEY, '1');
      try { await api.post('/users/@me/onboarding-complete', {}); } catch {}
      onClose();
    }
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 2000,
    }}>
      <div style={{
        background: 'var(--bg-primary)', border: '1px solid var(--stroke)',
        borderRadius: 'var(--radius-xl)', width: '400px', padding: '32px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
        boxShadow: 'var(--shadow-panel)',
        position: 'relative',
      }}>
        <button onClick={() => { localStorage.setItem(STORAGE_KEY, '1'); onClose(); }} style={{
          position: 'absolute' as const, top: '16px', right: '16px',
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
        }}>
          <X size={18} />
        </button>

        {/* Icon */}
        <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: '50%' }}>
          {current.icon}
        </div>

        {/* Content */}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {current.title}
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {current.description}
          </p>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? '20px' : '8px', height: '8px',
              borderRadius: '4px', transition: 'all 0.3s',
              background: i === step ? 'var(--accent-primary)' : i < step ? 'var(--accent-primary-alpha)' : 'var(--stroke)',
            }} />
          ))}
        </div>

        {/* Actions */}
        <button onClick={handleNext} style={{
          padding: '10px 24px', background: 'var(--accent-primary)', color: 'white',
          border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
          fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px',
          width: '100%', justifyContent: 'center',
        }}>
          {isLast ? 'Claim Reward' : (
            <>
              {current.action ?? 'Next'}
              <ChevronRight size={16} />
            </>
          )}
        </button>

        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
          Step {step + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
}

// Export a hook to check if tour should be shown
export function useShouldShowTour() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      // Show after a short delay
      const t = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(t);
    }
  }, []);
  return { show, dismiss: () => { localStorage.setItem(STORAGE_KEY, '1'); setShow(false); } };
}
