"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function ScrollReveal({
  children,
  className = "",
  delay = 0,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (visible) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -50px 0px", threshold: 0.01 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  const style = { "--sr-delay": `${delay}s` } as CSSProperties;

  return (
    <div
      ref={ref}
      className={`sr-reveal ${visible ? "is-visible" : ""} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
