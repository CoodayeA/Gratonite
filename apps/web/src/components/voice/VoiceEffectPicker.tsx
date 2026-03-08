import { useState, useEffect, useCallback } from 'react';
import { Mic, Volume2, Play, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface VoiceEffect {
  id: string;
  name: string;
  description: string;
}

interface VoiceSettings {
  userId: string;
  activeEffect: string | null;
  effectVolume: number;
}

const EFFECT_ICONS: Record<string, string> = {
  robot: '🤖',
  deep: '🎵',
  helium: '🎈',
  echo: '🔊',
  reverb: '🏛️',
  whisper: '🤫',
  radio: '📻',
};

interface VoiceEffectPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onEffectChange?: (effect: string | null) => void;
}

export default function VoiceEffectPicker({ isOpen, onClose, onEffectChange }: VoiceEffectPickerProps) {
  const { addToast } = useToast();
  const [effects, setEffects] = useState<VoiceEffect[]>([]);
  const [settings, setSettings] = useState<VoiceSettings | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [effectsList, currentSettings] = await Promise.all([
        api.get('/voice/effects') as Promise<VoiceEffect[]>,
        api.get('/users/@me/voice-settings') as Promise<VoiceSettings>,
      ]);
      setEffects(effectsList);
      setSettings(currentSettings);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen, fetchData]);

  const selectEffect = async (effectId: string | null) => {
    setSaving(true);
    try {
      const updated = await api.put('/users/@me/voice-settings', {
        activeEffect: effectId,
        effectVolume: settings?.effectVolume ?? 100,
      }) as VoiceSettings;
      setSettings(updated);
      onEffectChange?.(effectId);
      addToast({ title: effectId ? `${effectId.charAt(0).toUpperCase() + effectId.slice(1)} effect enabled` : 'Effect disabled', variant: 'success' });
    } catch {
      addToast({ title: 'Failed to update voice effect', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const updateVolume = async (vol: number) => {
    if (!settings) return;
    setSettings(prev => prev ? { ...prev, effectVolume: vol } : null);
    try {
      await api.put<VoiceSettings>('/users/@me/voice-settings', {
        activeEffect: settings.activeEffect,
        effectVolume: vol,
      });
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-full mb-2 left-0 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-white">Voice Effects</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3">
        {/* Effect Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {effects.map(effect => {
            const isActive = settings?.activeEffect === effect.id;
            return (
              <button
                key={effect.id}
                onClick={() => selectEffect(isActive ? null : effect.id)}
                disabled={saving}
                className={`p-2.5 rounded-lg text-left transition-colors ${
                  isActive
                    ? 'bg-indigo-600 border border-indigo-500'
                    : 'bg-gray-700 border border-gray-600 hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{EFFECT_ICONS[effect.id] || '🎤'}</span>
                  <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-300'}`}>{effect.name}</span>
                </div>
                <p className={`text-xs ${isActive ? 'text-indigo-200' : 'text-gray-500'}`}>{effect.description}</p>
              </button>
            );
          })}
        </div>

        {/* Volume Slider */}
        {settings?.activeEffect && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
            <Volume2 className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="range"
              min={0}
              max={100}
              value={settings.effectVolume}
              onChange={e => updateVolume(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-gray-400 w-8 text-right">{settings.effectVolume}%</span>
          </div>
        )}

        {/* Active effect indicator */}
        {settings?.activeEffect && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-indigo-400">
              Active: {EFFECT_ICONS[settings.activeEffect]} {settings.activeEffect.charAt(0).toUpperCase() + settings.activeEffect.slice(1)}
            </span>
            <button
              onClick={() => selectEffect(null)}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Disable
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
