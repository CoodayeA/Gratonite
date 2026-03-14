/**
 * 133. Seasonal Decorations — Snowfall, confetti, and other animated effects with toggle.
 */
import { useState, useEffect, useRef } from 'react';
import { Snowflake, PartyPopper, Leaf, Sun, Settings } from 'lucide-react';

type Season = 'winter' | 'spring' | 'summer' | 'autumn' | 'none';

const SEASON_CONFIG: Record<Exclude<Season, 'none'>, { icon: typeof Snowflake; label: string; particles: string[]; color: string }> = {
  winter: { icon: Snowflake, label: 'Snowfall', particles: ['\u2744', '\u2746', '\u2745', '\u00B7'], color: '#93c5fd' },
  spring: { icon: PartyPopper, label: 'Cherry Blossoms', particles: ['\uD83C\uDF38', '\uD83C\uDF3A', '\u2022', '\u00B7'], color: '#f9a8d4' },
  summer: { icon: Sun, label: 'Fireflies', particles: ['\u2728', '\u2727', '\u00B7'], color: '#fde047' },
  autumn: { icon: Leaf, label: 'Falling Leaves', particles: ['\uD83C\uDF42', '\uD83C\uDF41', '\uD83C\uDF43'], color: '#f59e0b' },
};

function ParticleCanvas({ season }: { season: Exclude<Season, 'none'> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const config = SEASON_CONFIG[season];
    const particles: Array<{ x: number; y: number; size: number; speed: number; char: string; opacity: number; drift: number }> = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create particles
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 8 + Math.random() * 12,
        speed: 0.3 + Math.random() * 1,
        char: config.particles[Math.floor(Math.random() * config.particles.length)],
        opacity: 0.3 + Math.random() * 0.5,
        drift: (Math.random() - 0.5) * 0.5,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.y += p.speed;
        p.x += p.drift + Math.sin(p.y * 0.01) * 0.3;

        if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
        if (p.x > canvas.width) p.x = 0;
        if (p.x < 0) p.x = canvas.width;

        ctx.globalAlpha = p.opacity;
        ctx.font = `${p.size}px sans-serif`;
        ctx.fillText(p.char, p.x, p.y);
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [season]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}

export default function SeasonalDecorations() {
  const [season, setSeason] = useState<Season>(() => {
    const saved = localStorage.getItem('seasonal-decoration');
    return (saved as Season) || 'none';
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem('seasonal-decoration', season);
  }, [season]);

  return (
    <>
      {season !== 'none' && <ParticleCanvas season={season} />}

      {showSettings && (
        <div className="p-4 bg-gray-900 rounded-lg">
          <h3 className="text-white font-medium flex items-center gap-2 mb-3">
            <Snowflake className="w-5 h-5 text-blue-400" /> Seasonal Decorations
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSeason('none')}
              className={`p-3 rounded-lg border text-left ${season === 'none' ? 'bg-indigo-900/30 border-indigo-600' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
            >
              <p className="text-sm text-white font-medium">None</p>
              <p className="text-xs text-gray-500">No effects</p>
            </button>
            {(Object.entries(SEASON_CONFIG) as [Exclude<Season, 'none'>, typeof SEASON_CONFIG[keyof typeof SEASON_CONFIG]][]).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button
                  key={key}
                  onClick={() => setSeason(key)}
                  className={`p-3 rounded-lg border text-left ${season === key ? 'bg-indigo-900/30 border-indigo-600' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                    <p className="text-sm text-white font-medium">{cfg.label}</p>
                  </div>
                  <p className="text-xs text-gray-500 capitalize">{key} theme</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="fixed bottom-4 right-4 p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-full border border-gray-700 z-50"
        title="Seasonal decorations"
        style={{ display: showSettings ? 'none' : 'flex' }}
      >
        <Snowflake className="w-4 h-4" />
      </button>
    </>
  );
}

/** Standalone settings panel (for embedding in settings page) */
export function SeasonalDecorationSettings() {
  const [season, setSeason] = useState<Season>(() => {
    const saved = localStorage.getItem('seasonal-decoration');
    return (saved as Season) || 'none';
  });

  const handleChange = (s: Season) => {
    setSeason(s);
    localStorage.setItem('seasonal-decoration', s);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm text-gray-300 flex items-center gap-1">
        <Snowflake className="w-4 h-4" /> Seasonal Effects
      </label>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => handleChange('none')}
          className={`px-3 py-1.5 text-sm rounded ${season === 'none' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'}`}
        >
          Off
        </button>
        {(Object.entries(SEASON_CONFIG) as [Exclude<Season, 'none'>, typeof SEASON_CONFIG[keyof typeof SEASON_CONFIG]][]).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => handleChange(key)}
            className={`px-3 py-1.5 text-sm rounded capitalize ${season === key ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'}`}
          >
            {cfg.label}
          </button>
        ))}
      </div>
    </div>
  );
}
