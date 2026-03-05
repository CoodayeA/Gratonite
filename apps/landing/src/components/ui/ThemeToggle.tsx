"use client";

import { useState, useEffect } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  // Sync state with the actual DOM class after hydration
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      suppressHydrationWarning
      className="w-10 h-10 rounded-lg neo-border-2 neo-shadow-sm neo-shadow-hover bg-surface flex items-center justify-center text-lg cursor-pointer transition-all"
    >
      {dark ? (
        <span role="img" aria-label="Sun">
          &#9728;&#65039;
        </span>
      ) : (
        <span role="img" aria-label="Moon">
          &#127769;
        </span>
      )}
    </button>
  );
}
