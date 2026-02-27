import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

const ONBOARDING_COMPLETED_KEY = 'gratonite_onboarding_completed';

/* ── CSS variable design tokens ─────────────────────────────────────── */
const V = {
  bgElevated: 'var(--bg-elevated, #353348)',
  stroke: 'var(--stroke, #4a4660)',
  accent: 'var(--accent, #d4af37)',
  text: 'var(--text, #e8e4e0)',
  textMuted: 'var(--text-muted, #a8a4b8)',
  textFaint: 'var(--text-faint, #6e6a80)',
  radiusXl: 'var(--radius-xl, 16px)',
  fontDisplay: 'var(--font-display, inherit)',
} as const;

/* ── Inline style objects ───────────────────────────────────────────── */

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: 'onboarding-fade-in 300ms ease forwards',
} as React.CSSProperties;

const backdropStyle = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.7)',
  backdropFilter: 'blur(6px)',
} as React.CSSProperties;

const cardStyle = {
  position: 'relative',
  width: '90%',
  maxWidth: 460,
  background: V.bgElevated,
  border: `1px solid ${V.stroke}`,
  borderRadius: V.radiusXl,
  padding: '40px 36px 28px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 16,
  textAlign: 'center',
  boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4)',
  animation: 'onboarding-card-in 350ms ease forwards',
} as React.CSSProperties;

const iconStyle = {
  fontSize: 48,
  lineHeight: 1,
} as React.CSSProperties;

const titleStyle = {
  fontFamily: V.fontDisplay,
  fontSize: '1.5rem',
  fontWeight: 700,
  color: V.text,
  margin: 0,
} as React.CSSProperties;

const descriptionStyle = {
  fontSize: '0.9rem',
  color: V.textMuted,
  lineHeight: 1.55,
  margin: 0,
  maxWidth: 380,
} as React.CSSProperties;

const dotsStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 8,
} as React.CSSProperties;

const dotBase = {
  width: 10,
  height: 10,
  borderRadius: '50%',
  border: 'none',
  background: V.stroke,
  cursor: 'pointer',
  padding: 0,
  transition: 'background 0.15s ease, transform 0.15s ease',
} as React.CSSProperties;

const dotActive = {
  ...dotBase,
  background: V.accent,
  transform: 'scale(1.25)',
  boxShadow: '0 0 8px rgba(212, 175, 55, 0.4)',
} as React.CSSProperties;

const actionsStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  marginTop: 12,
} as React.CSSProperties;

const actionsRightStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
} as React.CSSProperties;

const stepCounterStyle = {
  fontSize: '0.75rem',
  color: V.textFaint,
  marginTop: 4,
} as React.CSSProperties;

interface OnboardingStep {
  title: string;
  description: string;
  icon: string;
}

const STEPS: OnboardingStep[] = [
  {
    title: 'Welcome to Gratonite',
    description:
      'Your new home for communities, voice, and identity. Let us show you around the key features.',
    icon: '\u2728',
  },
  {
    title: 'Create a Portal',
    description:
      'Portals are your community spaces. Create one for your friends, team, or interest group and customize it with channels and roles.',
    icon: '\uD83C\uDF00',
  },
  {
    title: 'Send a Message',
    description:
      'Chat in channels, DMs, or group conversations. Use markdown, attach files, react with emoji, and pin important messages.',
    icon: '\uD83D\uDCAC',
  },
  {
    title: 'Add Friends',
    description:
      'Find people by username and build your friend list. See who is online, start DMs, or invite them to your portals.',
    icon: '\uD83D\uDC65',
  },
  {
    title: 'Discover & Customize',
    description:
      'Browse the Discover page for portals, bots, and themes. Visit the Shop to personalize your avatar, nameplate, and profile effects.',
    icon: '\uD83D\uDE80',
  },
];

export function OnboardingOverlay() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hoveredDot, setHoveredDot] = useState<number | null>(null);

  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_COMPLETED_KEY);
    if (!completed) {
      setVisible(true);
    }
  }, []);

  const handleComplete = useCallback(() => {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    setVisible(false);
  }, []);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
      navigate('/discover');
    }
  }, [currentStep, handleComplete, navigate]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  useEffect(() => {
    if (!visible) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleSkip();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handleBack();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, handleSkip, handleNext, handleBack]);

  if (!visible) return null;

  const step = STEPS[currentStep]!;
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-label="Onboarding tutorial">
      <div style={backdropStyle} onClick={handleSkip} />
      <div style={cardStyle}>
        <div style={iconStyle}>{step.icon}</div>
        <h2 style={titleStyle}>{step.title}</h2>
        <p style={descriptionStyle}>{step.description}</p>

        <div style={dotsStyle} role="group" aria-label="Step indicator">
          {STEPS.map((_, index) => (
            <button
              key={index}
              type="button"
              style={
                index === currentStep
                  ? dotActive
                  : hoveredDot === index
                    ? { ...dotBase, background: V.textMuted }
                    : dotBase
              }
              onClick={() => setCurrentStep(index)}
              onMouseEnter={() => setHoveredDot(index)}
              onMouseLeave={() => setHoveredDot(null)}
              aria-label={`Go to step ${index + 1}`}
              aria-current={index === currentStep ? 'step' : undefined}
            />
          ))}
        </div>

        <div style={actionsStyle}>
          <Button variant="ghost" onClick={handleSkip}>
            Skip
          </Button>
          <div style={actionsRightStyle}>
            {currentStep > 0 && (
              <Button variant="ghost" onClick={handleBack}>
                Back
              </Button>
            )}
            <Button variant="primary" onClick={handleNext}>
              {isLastStep ? 'Get Started' : 'Next'}
            </Button>
          </div>
        </div>

        <div style={stepCounterStyle}>
          {currentStep + 1} / {STEPS.length}
        </div>
      </div>
    </div>
  );
}
