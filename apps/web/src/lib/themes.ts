// apps/web/src/lib/themes.ts
// Single source of truth for all theme data and utilities.

export type ThemeVars = {
  '--bg': string;
  '--bg-elevated': string;
  '--bg-soft': string;
  '--bg-float': string;
  '--bg-input': string;
  '--stroke': string;
  '--accent': string;
  '--accent-2': string;
  '--text': string;
  '--text-muted': string;
  '--text-faint': string;
};

export type Theme = {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  tags: string[];
  vars: ThemeVars;
};

export const BUILT_IN_THEMES: Theme[] = [
  {
    id: 'default-dark',
    name: 'Gratonite Dark',
    description: 'The classic Gratonite dark purple theme.',
    author: 'Gratonite',
    version: '1.0.0',
    tags: ['dark', 'purple', 'official'],
    vars: {
      '--bg': '#2c2c3e',
      '--bg-elevated': '#353348',
      '--bg-soft': '#413d58',
      '--bg-float': '#25243a',
      '--bg-input': '#25243a',
      '--stroke': '#4a4660',
      '--accent': '#d4af37',
      '--accent-2': '#e8c547',
      '--text': '#e8e4e0',
      '--text-muted': '#a8a4b8',
      '--text-faint': '#6e6a80',
    },
  },
  {
    id: 'midnight-blue',
    name: 'Midnight Blue',
    description: 'Deep navy blues for a calm, oceanic feel.',
    author: 'Gratonite',
    version: '1.0.0',
    tags: ['dark', 'blue', 'calm'],
    vars: {
      '--bg': '#0f1629',
      '--bg-elevated': '#1a2240',
      '--bg-soft': '#243050',
      '--bg-float': '#0c1220',
      '--bg-input': '#0c1220',
      '--stroke': '#2a3a60',
      '--accent': '#4a9fff',
      '--accent-2': '#6ab8ff',
      '--text': '#dce8ff',
      '--text-muted': '#8aa8d0',
      '--text-faint': '#4a6090',
    },
  },
  {
    id: 'forest-green',
    name: 'Forest',
    description: 'Earthy dark greens with warm amber accents.',
    author: 'Gratonite',
    version: '1.0.0',
    tags: ['dark', 'green', 'nature'],
    vars: {
      '--bg': '#131f17',
      '--bg-elevated': '#1a2e1e',
      '--bg-soft': '#223a27',
      '--bg-float': '#0f1a12',
      '--bg-input': '#0f1a12',
      '--stroke': '#2a4a30',
      '--accent': '#6ac47a',
      '--accent-2': '#8ad896',
      '--text': '#d8eed8',
      '--text-muted': '#88b090',
      '--text-faint': '#4a7050',
    },
  },
  {
    id: 'ember',
    name: 'Ember',
    description: 'Warm volcanic reds and orange highlights.',
    author: 'Gratonite',
    version: '1.0.0',
    tags: ['dark', 'red', 'warm'],
    vars: {
      '--bg': '#1f1410',
      '--bg-elevated': '#2e1e18',
      '--bg-soft': '#3d2820',
      '--bg-float': '#180f0c',
      '--bg-input': '#180f0c',
      '--stroke': '#5a3028',
      '--accent': '#ff6b35',
      '--accent-2': '#ff8c5a',
      '--text': '#ffeedd',
      '--text-muted': '#c09080',
      '--text-faint': '#705040',
    },
  },
  {
    id: 'neon-cyber',
    name: 'Neon Cyber',
    description: 'Pure black with electric neon cyan accents.',
    author: 'Gratonite',
    version: '1.0.0',
    tags: ['dark', 'neon', 'cyber'],
    vars: {
      '--bg': '#080808',
      '--bg-elevated': '#111111',
      '--bg-soft': '#1a1a1a',
      '--bg-float': '#050505',
      '--bg-input': '#050505',
      '--stroke': '#2a2a2a',
      '--accent': '#00ffcc',
      '--accent-2': '#00e6b8',
      '--text': '#e8fff8',
      '--text-muted': '#60a090',
      '--text-faint': '#304840',
    },
  },
  {
    id: 'lavender',
    name: 'Lavender',
    description: 'Soft lavender purples with rose gold accents.',
    author: 'Gratonite',
    version: '1.0.0',
    tags: ['dark', 'purple', 'soft'],
    vars: {
      '--bg': '#1e1b2e',
      '--bg-elevated': '#272440',
      '--bg-soft': '#312d52',
      '--bg-float': '#181526',
      '--bg-input': '#181526',
      '--stroke': '#3d3860',
      '--accent': '#c9a0dc',
      '--accent-2': '#e0b8f0',
      '--text': '#f0ecff',
      '--text-muted': '#9888b8',
      '--text-faint': '#504870',
    },
  },
  {
    id: 'ocean-deep',
    name: 'Ocean Deep',
    description: 'Dark teal depths with aquamarine highlights.',
    author: 'Gratonite',
    version: '1.0.0',
    tags: ['dark', 'teal', 'calm'],
    vars: {
      '--bg': '#0d1f22',
      '--bg-elevated': '#142e32',
      '--bg-soft': '#1c3c40',
      '--bg-float': '#0a181c',
      '--bg-input': '#0a181c',
      '--stroke': '#1e4a50',
      '--accent': '#2dd4bf',
      '--accent-2': '#4ee8d4',
      '--text': '#d0f0ec',
      '--text-muted': '#70a8a0',
      '--text-faint': '#305850',
    },
  },
  {
    id: 'crimson-rose',
    name: 'Crimson Rose',
    description: 'Deep crimson with pink-rose accents.',
    author: 'Gratonite',
    version: '1.0.0',
    tags: ['dark', 'red', 'rose'],
    vars: {
      '--bg': '#1f0d14',
      '--bg-elevated': '#2e1220',
      '--bg-soft': '#3d182c',
      '--bg-float': '#180a10',
      '--bg-input': '#180a10',
      '--stroke': '#5a1e38',
      '--accent': '#ff6b8a',
      '--accent-2': '#ff8fa8',
      '--text': '#ffeef3',
      '--text-muted': '#c07088',
      '--text-faint': '#703048',
    },
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    description: 'Warm amber and orange sunset tones.',
    author: 'Gratonite',
    version: '1.0.0',
    tags: ['dark', 'amber', 'warm'],
    vars: {
      '--bg': '#1f1608',
      '--bg-elevated': '#2e2010',
      '--bg-soft': '#3d2c18',
      '--bg-float': '#181008',
      '--bg-input': '#181008',
      '--stroke': '#5a3c10',
      '--accent': '#f5a623',
      '--accent-2': '#f7bc4e',
      '--text': '#fff8e8',
      '--text-muted': '#c09060',
      '--text-faint': '#705030',
    },
  },
  {
    id: 'arctic-aurora',
    name: 'Arctic Aurora',
    description: 'Icy blues with aurora green shimmer.',
    author: 'Gratonite',
    version: '1.0.0',
    tags: ['dark', 'blue', 'aurora'],
    vars: {
      '--bg': '#0a0f1e',
      '--bg-elevated': '#0f1830',
      '--bg-soft': '#162040',
      '--bg-float': '#080c18',
      '--bg-input': '#080c18',
      '--stroke': '#1a2a50',
      '--accent': '#78d8b0',
      '--accent-2': '#96e8c8',
      '--text': '#e0f8f0',
      '--text-muted': '#5898a8',
      '--text-faint': '#284858',
    },
  },
  {
    id: 'mono-night',
    name: 'Mono Night',
    description: 'Pure monochrome with silver highlights.',
    author: 'Gratonite',
    version: '1.0.0',
    tags: ['dark', 'mono', 'minimal'],
    vars: {
      '--bg': '#0f0f0f',
      '--bg-elevated': '#1a1a1a',
      '--bg-soft': '#252525',
      '--bg-float': '#0a0a0a',
      '--bg-input': '#0a0a0a',
      '--stroke': '#333333',
      '--accent': '#c8c8c8',
      '--accent-2': '#e0e0e0',
      '--text': '#f5f5f5',
      '--text-muted': '#888888',
      '--text-faint': '#444444',
    },
  },
  {
    id: 'violet-storm',
    name: 'Violet Storm',
    description: 'Electric violet with high-contrast neon purple.',
    author: 'Gratonite',
    version: '1.0.0',
    tags: ['dark', 'purple', 'violet', 'electric'],
    vars: {
      '--bg': '#0f0818',
      '--bg-elevated': '#180c28',
      '--bg-soft': '#221038',
      '--bg-float': '#0a0512',
      '--bg-input': '#0a0512',
      '--stroke': '#38188a',
      '--accent': '#9b59ff',
      '--accent-2': '#b47eff',
      '--text': '#f0e8ff',
      '--text-muted': '#9068c8',
      '--text-faint': '#503880',
    },
  },
];

// ─── Allowed keys for localStorage validation ─────────────────────────────

const VALID_THEME_KEYS = new Set<string>([
  '--bg', '--bg-elevated', '--bg-soft', '--bg-float', '--bg-input',
  '--stroke', '--accent', '--accent-2', '--text', '--text-muted', '--text-faint',
]);

// ─── Module-level applied ID tracker ─────────────────────────────────────

let _appliedThemeId: string | null = null;

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Apply a theme by writing its CSS vars to document.documentElement inline
 * styles and persisting the selection to localStorage.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  for (const key of VALID_THEME_KEYS) root.style.removeProperty(key);
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
  _appliedThemeId = theme.id;
  try {
    localStorage.setItem('gratonite_theme', JSON.stringify({ id: theme.id, vars: theme.vars }));
  } catch {
    // storage full or blocked — not fatal
  }
}

/**
 * Read the persisted theme from localStorage and apply it.
 * Called once at app startup so themes survive page reload.
 * Safe to call multiple times (idempotent).
 */
export function loadSavedTheme(): void {
  try {
    const saved = localStorage.getItem('gratonite_theme');
    if (!saved) return;
    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object') return;
    const p = parsed as Record<string, unknown>;
    if (typeof p['vars'] !== 'object' || !p['vars']) return;
    const vars = p['vars'] as Record<string, unknown>;
    const root = document.documentElement;
    for (const [key, value] of Object.entries(vars)) {
      if (VALID_THEME_KEYS.has(key) && typeof value === 'string' && value.length < 50) {
        root.style.setProperty(key, value);
      }
    }
    if (typeof p['id'] === 'string') {
      const known = BUILT_IN_THEMES.find(t => t.id === p['id']);
      if (known) _appliedThemeId = known.id;
    }
  } catch {
    // corrupt data — ignore
  }
}

/**
 * Returns the id of the currently applied theme, or null if none.
 * Used by UI to highlight the active theme card.
 */
export function getCurrentThemeId(): string | null {
  return _appliedThemeId;
}
