import { useState, useEffect, useRef, useCallback } from 'react';

type Season = 'winter' | 'spring' | 'summer' | 'autumn' | 'halloween' | 'newyear' | null;

function getCurrentSeason(): Season {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const day = now.getDate();

  // Special events first
  if (month === 9 && day >= 25) return 'halloween'; // Oct 25-31
  if (month === 11 && day === 31) return 'newyear';
  if (month === 0 && day === 1) return 'newyear';

  // Seasons
  if (month >= 11 || month <= 1) return 'winter';  // Dec-Feb
  if (month >= 2 && month <= 4) return 'spring';   // Mar-May
  if (month >= 5 && month <= 7) return 'summer';   // Jun-Aug
  if (month >= 8 && month <= 10) return 'autumn';  // Sep-Nov

  return null;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
  char?: string;
}

const PARTICLE_COUNT = 25;

export default function SeasonalOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const [enabled, setEnabled] = useState(true);
  const [season, setSeason] = useState<Season>(null);

  useEffect(() => {
    const stored = localStorage.getItem('gratonite-seasonal-effects');
    if (stored === 'false') setEnabled(false);
    setSeason(getCurrentSeason());
  }, []);

  const initParticles = useCallback((s: Season, w: number, h: number) => {
    const particles: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const base: Particle = {
        x: Math.random() * w,
        y: Math.random() * h - h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: 0.5 + Math.random() * 1,
        size: 3 + Math.random() * 5,
        opacity: 0.4 + Math.random() * 0.5,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 2,
      };

      if (s === 'autumn') base.char = ['🍂', '🍁', '🍃'][Math.floor(Math.random() * 3)];
      else if (s === 'spring') base.char = ['🌸', '🌺', '💮'][Math.floor(Math.random() * 3)];
      else if (s === 'halloween') base.char = ['🦇', '🎃', '👻'][Math.floor(Math.random() * 3)];
      else if (s === 'newyear') base.char = ['🎆', '🎇', '✨'][Math.floor(Math.random() * 3)];

      particles.push(base);
    }
    return particles;
  }, []);

  useEffect(() => {
    if (!enabled || !season) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    particlesRef.current = initParticles(season, canvas.width, canvas.height);

    const draw = () => {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        // Wrap around
        if (p.y > canvas.height + 20) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
        if (p.x < -20) p.x = canvas.width + 20;
        if (p.x > canvas.width + 20) p.x = -20;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;

        if (p.char) {
          ctx.font = `${p.size * 2.5}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.char, 0, 0);
        } else if (season === 'winter') {
          // Snowflake
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (season === 'summer') {
          // Sun ray particle
          ctx.fillStyle = '#ffd700';
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.8, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    // Pause when tab not visible
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animFrameRef.current);
      } else {
        animFrameRef.current = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, season, initParticles]);

  if (!enabled || !season) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        pointerEvents: 'none',
      }}
    />
  );
}
