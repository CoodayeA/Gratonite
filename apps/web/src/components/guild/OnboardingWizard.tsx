import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronLeft, Check, Sparkles, Users, BookOpen, MessageSquare, Plus, Trash2, Save } from 'lucide-react';
import { API_BASE, getAccessToken } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface OnboardingStep {
  id?: string;
  stepType: 'welcome' | 'roles' | 'rules' | 'intro';
  title: string;
  description: string | null;
  options: unknown;
  displayOrder: number;
}

const authHeaders = () => ({
  Authorization: `Bearer ${getAccessToken() ?? ''}`,
  'Content-Type': 'application/json',
});

const stepIcons: Record<string, React.ReactNode> = {
  welcome: <Sparkles className="w-6 h-6" />,
  roles: <Users className="w-6 h-6" />,
  rules: <BookOpen className="w-6 h-6" />,
  intro: <MessageSquare className="w-6 h-6" />,
};

// --- Wizard (shown to new members) ---
export default function OnboardingWizard({ guildId, guildName, onComplete }: {
  guildId: string;
  guildName: string;
  onComplete: () => void;
}) {
  const { addToast } = useToast();
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState<Record<string, unknown>>({});
  const [introText, setIntroText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/guilds/${guildId}/onboarding/config`, {
          credentials: 'include',
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setSteps(data.steps || []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [guildId]);

  const complete = async () => {
    try {
      const finalSelections = { ...selections };
      if (introText.trim()) finalSelections.intro = introText;

      await fetch(`${API_BASE}/guilds/${guildId}/onboarding/complete`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({ selections: finalSelections }),
      });
      addToast({ title: 'Welcome aboard!', variant: 'success' });
      onComplete();
    } catch {
      addToast({ title: 'Failed to complete onboarding', variant: 'error' });
    }
  };

  if (loading) return <div className="fixed inset-0 bg-gray-900/95 z-50 flex items-center justify-center text-white">Loading...</div>;
  if (steps.length === 0) { onComplete(); return null; }

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const options = Array.isArray(step?.options) ? step.options as Array<{ id: string; label: string; description?: string }> : [];

  return (
    <div className="fixed inset-0 bg-gray-900/95 z-50 flex items-center justify-center">
      <div className="w-full max-w-lg bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-gray-700">
          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
        </div>

        <div className="p-8">
          <div className="flex items-center gap-3 mb-2 text-indigo-400">
            {stepIcons[step.stepType] || <Sparkles className="w-6 h-6" />}
            <span className="text-xs uppercase tracking-wider text-gray-500">Step {currentStep + 1} of {steps.length}</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">{step.title}</h2>
          {step.description && <p className="text-gray-400 mb-6">{step.description}</p>}

          {/* Step content */}
          {step.stepType === 'welcome' && (
            <div className="text-center py-8">
              <h3 className="text-xl text-white mb-2">Welcome to {guildName}!</h3>
              <p className="text-gray-400">Let's get you set up.</p>
            </div>
          )}

          {step.stepType === 'roles' && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {options.map((opt) => {
                const selected = (selections.roles as string[] || []).includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      const current = (selections.roles as string[] || []);
                      setSelections(s => ({
                        ...s,
                        roles: selected ? current.filter((r: string) => r !== opt.id) : [...current, opt.id],
                      }));
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition ${selected ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-700 bg-gray-900 hover:border-gray-600'}`}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${selected ? 'bg-indigo-500 border-indigo-500' : 'border-gray-600'}`}>
                      {selected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="text-left">
                      <span className="text-white text-sm">{opt.label}</span>
                      {opt.description && <p className="text-gray-500 text-xs">{opt.description}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {step.stepType === 'rules' && (
            <div className="space-y-3">
              <div className="bg-gray-900 rounded-lg p-4 max-h-48 overflow-y-auto text-gray-300 text-sm whitespace-pre-wrap">
                {step.description || 'Please follow the server rules.'}
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!selections.rulesAccepted}
                  onChange={e => setSelections(s => ({ ...s, rulesAccepted: e.target.checked }))}
                  className="rounded border-gray-600 bg-gray-900"
                />
                I agree to the server rules
              </label>
            </div>
          )}

          {step.stepType === 'intro' && (
            <textarea
              value={introText}
              onChange={e => setIntroText(e.target.value)}
              placeholder="Introduce yourself..."
              className="w-full h-32 bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white text-sm resize-none"
            />
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => setCurrentStep(s => s - 1)}
              disabled={currentStep === 0}
              className="flex items-center gap-1 text-gray-400 hover:text-white disabled:invisible text-sm"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            {isLast ? (
              <button onClick={complete} className="flex items-center gap-1 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm">
                <Check className="w-4 h-4" /> Get Started
              </button>
            ) : (
              <button onClick={() => setCurrentStep(s => s + 1)} className="flex items-center gap-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Config Builder (for guild settings) ---
export function OnboardingConfig({ guildId }: { guildId: string }) {
  const { addToast } = useToast();
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/onboarding/config`, {
        credentials: 'include',
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setSteps(data.steps || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [guildId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const addStep = (stepType: OnboardingStep['stepType']) => {
    setSteps(prev => [...prev, {
      stepType,
      title: stepType === 'welcome' ? 'Welcome!' : stepType === 'roles' ? 'Pick your roles' : stepType === 'rules' ? 'Server Rules' : 'Introduce Yourself',
      description: null,
      options: [],
      displayOrder: prev.length,
    }]);
  };

  const removeStep = (index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, updates: Partial<OnboardingStep>) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const saveConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/onboarding/config`, {
        method: 'PUT',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({ steps: steps.map((s, i) => ({ ...s, displayOrder: i })) }),
      });
      if (res.ok) addToast({ title: 'Onboarding config saved', variant: 'success' });
      else addToast({ title: 'Failed to save config', variant: 'error' });
    } catch { addToast({ title: 'Failed to save config', variant: 'error' }); }
  };

  if (loading) return <div className="text-gray-400 p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">Onboarding Steps</h3>
        <button onClick={saveConfig} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm">
          <Save className="w-4 h-4" /> Save
        </button>
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="bg-gray-900 border border-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {stepIcons[step.stepType]}
                <span className="text-sm text-indigo-400 capitalize">{step.stepType}</span>
              </div>
              <button onClick={() => removeStep(i)} className="text-red-400 hover:text-red-300">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <input
              value={step.title}
              onChange={e => updateStep(i, { title: e.target.value })}
              placeholder="Step title"
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm mb-2"
            />
            <textarea
              value={step.description || ''}
              onChange={e => updateStep(i, { description: e.target.value || null })}
              placeholder="Description (optional)"
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm resize-none h-16"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['welcome', 'roles', 'rules', 'intro'] as const).map(type => (
          <button
            key={type}
            onClick={() => addStep(type)}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm border border-gray-700"
          >
            <Plus className="w-3 h-3" /> {type}
          </button>
        ))}
      </div>
    </div>
  );
}
