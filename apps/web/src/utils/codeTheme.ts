export const CODE_THEMES = [
  { id: 'github-dark', label: 'GitHub Dark' },
  { id: 'monokai-sublime', label: 'Monokai' },
  { id: 'atom-one-dark', label: 'Atom One Dark' },
  { id: 'nord', label: 'Nord' },
  { id: 'vs2015', label: 'VS Code Dark' },
  { id: 'tokyo-night-dark', label: 'Tokyo Night' },
  { id: 'a11y-dark', label: 'Accessible Dark' },
] as const;

export type CodeThemeId = (typeof CODE_THEMES)[number]['id'];

const STORAGE_KEY = 'gratonite-code-theme';
const LINK_ID = 'hljs-theme-link';

export function getCodeTheme(): CodeThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && CODE_THEMES.some(t => t.id === stored)) return stored as CodeThemeId;
  } catch { /* ignore */ }
  return 'github-dark';
}

export function setCodeTheme(themeId: CodeThemeId) {
  localStorage.setItem(STORAGE_KEY, themeId);
  applyCodeTheme(themeId);
  window.dispatchEvent(new CustomEvent('gratonite:code-theme-changed', { detail: themeId }));
}

export function applyCodeTheme(themeId: CodeThemeId) {
  let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
  const href = `https://cdn.jsdelivr.net/npm/highlight.js@11/styles/${themeId}.min.css`;

  if (link) {
    link.href = href;
  } else {
    link = document.createElement('link');
    link.id = LINK_ID;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}
