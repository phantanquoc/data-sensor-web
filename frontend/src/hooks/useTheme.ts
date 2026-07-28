import { useCallback, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage unavailable (private mode, etc.)
  }
  return 'dark';
}

function applyTheme(theme: Theme): void {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

/* ---------------------------------------------------------------------------
 * Shared external store — a single source of truth for the theme so every
 * component (Overview button, FleetLineChart, StageProgress, ...) updates in
 * the same render. Using per-hook useState meant only the component that
 * toggled re-rendered; charts that read the theme in JS (Recharts grid/tick
 * colors) kept the stale value until a full reload.
 * ------------------------------------------------------------------------- */
let currentTheme: Theme = getStoredTheme();
const listeners = new Set<() => void>();

// Apply once at module load so the DOM matches the stored theme immediately.
applyTheme(currentTheme);

function setThemeInternal(next: Theme): void {
  if (next === currentTheme) return;
  currentTheme = next;
  applyTheme(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // localStorage unavailable
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Theme {
  return currentTheme;
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setTheme = useCallback((t: Theme) => {
    setThemeInternal(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeInternal(currentTheme === 'dark' ? 'light' : 'dark');
  }, []);

  return { theme, toggleTheme, setTheme } as const;
}
