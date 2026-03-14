/**
 * 132. Custom Profile Backgrounds — Choose or upload a profile background.
 */
import { useState, useEffect } from 'react';
import { Image, Check, Palette } from 'lucide-react';
import { api } from '../../lib/api';

const PRESET_BACKGROUNDS = [
  { id: 'none', name: 'None', value: '', preview: 'bg-gray-800' },
  { id: 'gradient-blue', name: 'Ocean', value: 'linear-gradient(135deg, #1e3a5f, #0f172a)', preview: 'bg-gradient-to-br from-blue-900 to-gray-900' },
  { id: 'gradient-purple', name: 'Nebula', value: 'linear-gradient(135deg, #4a1a6b, #1a0a2e)', preview: 'bg-gradient-to-br from-purple-900 to-gray-900' },
  { id: 'gradient-green', name: 'Forest', value: 'linear-gradient(135deg, #0d3320, #0f172a)', preview: 'bg-gradient-to-br from-green-900 to-gray-900' },
  { id: 'gradient-red', name: 'Ember', value: 'linear-gradient(135deg, #5c1a1a, #1a0a0a)', preview: 'bg-gradient-to-br from-red-900 to-gray-900' },
  { id: 'gradient-gold', name: 'Sunset', value: 'linear-gradient(135deg, #78350f, #1c1917)', preview: 'bg-gradient-to-br from-amber-900 to-gray-900' },
  { id: 'gradient-teal', name: 'Arctic', value: 'linear-gradient(135deg, #0d3d3d, #0a1e2e)', preview: 'bg-gradient-to-br from-teal-900 to-gray-900' },
  { id: 'gradient-pink', name: 'Sakura', value: 'linear-gradient(135deg, #5c1a3d, #1a0a1e)', preview: 'bg-gradient-to-br from-pink-900 to-gray-900' },
  { id: 'gradient-rainbow', name: 'Prismatic', value: 'linear-gradient(135deg, #4a1a6b, #1e3a5f, #0d3320)', preview: 'bg-gradient-to-br from-purple-900 via-blue-900 to-green-900' },
];

export default function ProfileBackground() {
  const [selected, setSelected] = useState('none');
  const [customUrl, setCustomUrl] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.profileBackground.get().then(d => {
      if (d.background) {
        const preset = PRESET_BACKGROUNDS.find(p => p.value === d.background);
        if (preset) setSelected(preset.id);
        else { setSelected('custom'); setCustomUrl(d.background); }
      }
    }).catch(() => {});
  }, []);

  const save = async () => {
    try {
      const bg = selected === 'custom' ? customUrl :
                 PRESET_BACKGROUNDS.find(p => p.id === selected)?.value || '';
      await api.profileBackground.set(bg);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <h3 className="text-white font-medium flex items-center gap-2 mb-4">
        <Palette className="w-5 h-5 text-pink-400" /> Profile Background
      </h3>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
        {PRESET_BACKGROUNDS.map(bg => (
          <button
            key={bg.id}
            onClick={() => setSelected(bg.id)}
            className={`relative rounded-lg border overflow-hidden transition-all ${
              selected === bg.id ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className={`aspect-video ${bg.preview}`} />
            <div className="p-1.5 bg-gray-800">
              <p className="text-xs text-white text-center">{bg.name}</p>
            </div>
            {selected === bg.id && (
              <div className="absolute top-1 right-1 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </button>
        ))}

        {/* Custom URL option */}
        <button
          onClick={() => setSelected('custom')}
          className={`relative rounded-lg border overflow-hidden transition-all ${
            selected === 'custom' ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <div className="aspect-video bg-gray-800 flex items-center justify-center">
            <Image className="w-6 h-6 text-gray-500" />
          </div>
          <div className="p-1.5 bg-gray-800">
            <p className="text-xs text-white text-center">Custom</p>
          </div>
          {selected === 'custom' && (
            <div className="absolute top-1 right-1 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
          )}
        </button>
      </div>

      {selected === 'custom' && (
        <input
          value={customUrl}
          onChange={e => setCustomUrl(e.target.value)}
          placeholder="Image URL for background..."
          className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-700 mb-3"
        />
      )}

      <button
        onClick={save}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded font-medium"
      >
        {saved ? 'Saved!' : 'Save Background'}
      </button>
    </div>
  );
}

/** Utility: get background style from stored value */
export function getProfileBackgroundStyle(background: string | null): React.CSSProperties {
  if (!background) return {};
  if (background.startsWith('linear-gradient') || background.startsWith('radial-gradient')) {
    return { background };
  }
  if (background.startsWith('http') || background.startsWith('/')) {
    return { backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  return {};
}
