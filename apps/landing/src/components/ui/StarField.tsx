"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  drift: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  colorIndex: number;
}

const DARK_COLORS = [
  "rgba(124, 58, 237,",   // purple
  "rgba(245, 158, 11,",   // gold
  "rgba(147, 197, 253,",  // blue
  "rgba(253, 230, 138,",  // yellow
  "rgba(255, 255, 255,",  // white
  "rgba(255, 255, 255,",  // white (weighted)
];

const LIGHT_COLORS = [
  "rgba(124, 58, 237,",   // purple
  "rgba(200, 130, 0,",    // darker gold
  "rgba(100, 140, 200,",  // muted blue
  "rgba(180, 160, 100,",  // muted warm
  "rgba(120, 100, 80,",   // warm gray
  "rgba(100, 80, 60,",    // dark warm
];

export function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: -1, y: -1 });
  const isDarkRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function checkDark() {
      isDarkRef.current = document.documentElement.classList.contains("dark");
    }

    function resize() {
      const w = window.innerWidth || document.documentElement.clientWidth || 1920;
      const h = window.innerHeight || document.documentElement.clientHeight || 1080;
      canvas!.width = w;
      canvas!.height = h;
    }

    function createStars() {
      const count = Math.floor((canvas!.width * canvas!.height) / 6000);
      starsRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * canvas!.width,
        y: Math.random() * canvas!.height,
        size: Math.random() * 2.2 + 0.4,
        opacity: Math.random() * 0.6 + 0.15,
        speed: Math.random() * 0.15 + 0.02,
        drift: (Math.random() - 0.5) * 0.3,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinkleOffset: Math.random() * Math.PI * 2,
        colorIndex: Math.floor(Math.random() * DARK_COLORS.length),
      }));
    }

    resize();
    createStars();
    checkDark();

    function handleResize() {
      resize();
      createStars();
    }

    function handleMouse(e: MouseEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    }

    // Watch for theme changes
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouse);

    let time = 0;

    function animate() {
      if (!ctx || !canvas) return;
      time += 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const dark = isDarkRef.current;
      const colors = dark ? DARK_COLORS : LIGHT_COLORS;
      // In light mode: fewer visible, much more subtle
      const opacityScale = dark ? 1 : 0.3;
      const glowScale = dark ? 1 : 0.4;

      for (const star of starsRef.current) {
        // Gentle drift
        star.y -= star.speed;
        star.x += star.drift;

        // Wrap around
        if (star.y < -5) {
          star.y = canvas.height + 5;
          star.x = Math.random() * canvas.width;
        }
        if (star.x < -5) star.x = canvas.width + 5;
        if (star.x > canvas.width + 5) star.x = -5;

        // Twinkle
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset);
        let alpha = (star.opacity + twinkle * 0.25) * opacityScale;
        alpha = Math.max(0.02, Math.min(dark ? 0.9 : 0.35, alpha));

        const color = colors[star.colorIndex];

        // Mouse proximity glow
        let sizeBoost = 0;
        if (mx >= 0) {
          const dx = star.x - mx;
          const dy = star.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            const proximity = 1 - dist / 150;
            sizeBoost = proximity * 2.5 * glowScale;
            alpha = Math.min(dark ? 1 : 0.5, alpha + proximity * 0.4 * glowScale);
          }
        }

        const finalSize = star.size + sizeBoost;

        // Draw star with glow
        if (finalSize > 1.2) {
          ctx.beginPath();
          ctx.arc(star.x, star.y, finalSize * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `${color} ${alpha * 0.12})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(star.x, star.y, finalSize, 0, Math.PI * 2);
        ctx.fillStyle = `${color} ${alpha})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
