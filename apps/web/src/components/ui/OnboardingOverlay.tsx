import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

const ONBOARDING_COMPLETED_KEY = 'gratonite_onboarding_completed';

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
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="Onboarding tutorial">
      <div className="onboarding-backdrop" onClick={handleSkip} />
      <div className="onboarding-card">
        <div className="onboarding-icon">{step.icon}</div>
        <h2 className="onboarding-title">{step.title}</h2>
        <p className="onboarding-description">{step.description}</p>

        <div className="onboarding-dots" role="group" aria-label="Step indicator">
          {STEPS.map((_, index) => (
            <button
              key={index}
              type="button"
              className={`onboarding-dot ${index === currentStep ? 'onboarding-dot-active' : ''}`}
              onClick={() => setCurrentStep(index)}
              aria-label={`Go to step ${index + 1}`}
              aria-current={index === currentStep ? 'step' : undefined}
            />
          ))}
        </div>

        <div className="onboarding-actions">
          <Button variant="ghost" onClick={handleSkip}>
            Skip
          </Button>
          <div className="onboarding-actions-right">
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

        <div className="onboarding-step-counter">
          {currentStep + 1} / {STEPS.length}
        </div>
      </div>
    </div>
  );
}
