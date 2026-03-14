/**
 * OnboardingFlowEditor — Item 105: Multi-step server onboarding flow builder
 * Visual editor for configuring interests -> roles -> channels onboarding steps.
 */
import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, GripVertical, ArrowUp, ArrowDown, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';

interface OnboardingStep {
  id?: string;
  stepType: string;
  title: string;
  description: string;
  options: any[];
  displayOrder: number;
}

interface Props {
  guildId: string;
  roles: Array<{ id: string; name: string }>;
  channels: Array<{ id: string; name: string }>;
  addToast: (t: any) => void;
}

const STEP_TYPES = [
  { value: 'welcome', label: 'Welcome Message', desc: 'Show a welcome screen to new members' },
  { value: 'interests', label: 'Choose Interests', desc: 'Let members pick interests for role assignment' },
  { value: 'roles', label: 'Select Roles', desc: 'Let members choose roles to join' },
  { value: 'channels', label: 'Subscribe to Channels', desc: 'Let members pick channels to follow' },
  { value: 'rules', label: 'Accept Rules', desc: 'Require members to accept server rules' },
];

export const OnboardingFlowEditor = ({ guildId, roles, channels, addToast }: Props) => {
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.onboarding.getConfig(guildId).then((data: any) => {
      setSteps(data?.steps || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [guildId]);

  const addStep = (type: string) => {
    const typeInfo = STEP_TYPES.find(t => t.value === type);
    setSteps(prev => [...prev, {
      stepType: type,
      title: typeInfo?.label || type,
      description: typeInfo?.desc || '',
      options: [],
      displayOrder: prev.length,
    }]);
  };

  const updateStep = (index: number, updates: Partial<OnboardingStep>) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const removeStep = (index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, displayOrder: i })));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= steps.length) return;
    const newSteps = [...steps];
    [newSteps[index], newSteps[newIdx]] = [newSteps[newIdx], newSteps[index]];
    setSteps(newSteps.map((s, i) => ({ ...s, displayOrder: i })));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.onboarding.setConfig(guildId, { steps });
      addToast({ title: 'Onboarding flow saved', variant: 'success' });
    } catch { addToast({ title: 'Failed to save', variant: 'error' }); }
    finally { setSaving(false); }
  };

  const inputStyle = { padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', width: '100%', boxSizing: 'border-box' as const };

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div>
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Onboarding Flow</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
        Design a multi-step onboarding experience for new members.
      </p>

      {/* Step flow preview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ padding: '6px 14px', borderRadius: '20px', background: 'var(--accent-primary)', color: '#000', fontSize: '12px', fontWeight: 600 }}>
              {i + 1}. {step.title}
            </div>
            {i < steps.length - 1 && <ChevronRight size={14} color="var(--text-muted)" />}
          </div>
        ))}
        {steps.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No steps configured yet.</span>}
      </div>

      {/* Steps editor */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        {steps.map((step, i) => (
          <div key={i} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <GripVertical size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', background: 'rgba(82,109,245,0.1)', padding: '2px 8px', borderRadius: '4px' }}>STEP {i + 1}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{step.stepType}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                <button onClick={() => moveStep(i, -1)} disabled={i === 0} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', opacity: i === 0 ? 0.3 : 1 }}><ArrowUp size={14} /></button>
                <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', opacity: i === steps.length - 1 ? 0.3 : 1 }}><ArrowDown size={14} /></button>
                <button onClick={() => removeStep(i)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}><Trash2 size={14} /></button>
              </div>
            </div>
            <input type="text" value={step.title} onChange={e => updateStep(i, { title: e.target.value })} placeholder="Step title" style={{ ...inputStyle, marginBottom: '8px' }} />
            <textarea value={step.description} onChange={e => updateStep(i, { description: e.target.value })} placeholder="Description..." rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
        ))}
      </div>

      {/* Add step */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {STEP_TYPES.map(type => (
          <button key={type.value} onClick={() => addStep(type.value)} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
            borderRadius: '8px', border: '1px dashed var(--stroke)', background: 'transparent',
            color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px',
          }}><Plus size={12} /> {type.label}</button>
        ))}
      </div>

      <button onClick={save} disabled={saving} style={{
        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px',
        borderRadius: '8px', background: 'var(--accent-primary)', border: 'none',
        color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: '14px',
      }}><Save size={14} /> {saving ? 'Saving...' : 'Save Flow'}</button>
    </div>
  );
};

export default OnboardingFlowEditor;
