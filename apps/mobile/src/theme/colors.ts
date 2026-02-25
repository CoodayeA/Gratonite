/**
 * Gratonite color palette — charcoal/gold design system
 */
export const colors = {
  // Backgrounds
  bg: {
    primary: '#2c2c3e',
    secondary: '#353348',
    tertiary: '#413d58',
    elevated: '#413d58',
    surface: '#353348',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },

  // Text
  text: {
    primary: '#e8e4e0',
    secondary: '#a8a4b8',
    muted: '#6e6a80',
    inverse: '#1a1a2e',
    link: '#d4af37',
  },

  // Brand
  brand: {
    primary: '#d4af37',
    secondary: '#e8c547',
    gradient: ['#d4af37', '#e8c547'] as const,
  },

  // Status
  status: {
    online: '#22c55e',
    idle: '#f59e0b',
    dnd: '#ef4444',
    offline: '#64748b',
  },

  // Accents
  accent: {
    success: '#6aea8a',
    warning: '#e8c547',
    error: '#e85a6e',
    info: '#a8a4b8',
  },

  // Strokes / borders
  stroke: {
    primary: '#4a4660',
    secondary: 'rgba(74, 70, 96, 0.5)',
    active: '#d4af37',
  },

  // Message-specific
  message: {
    self: '#3e3a5a',
    other: '#353348',
    mention: 'rgba(212, 175, 55, 0.1)',
    reply: 'rgba(212, 175, 55, 0.08)',
  },
} as const;

export type Colors = typeof colors;
