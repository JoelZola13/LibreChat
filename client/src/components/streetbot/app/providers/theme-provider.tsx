/**
 * Theme provider that bridges LibreChat's class-based theme (dark/light on <html>)
 * with the streetbot design system (data-theme attribute for glassmorphism.css).
 */
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
});

function detectTheme(): Theme {
  return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, _setTheme] = useState<Theme>(detectTheme);

  // Wrap setTheme to also update <html> class + data-theme attribute
  const setTheme = (next: Theme) => {
    _setTheme(next);
    const html = document.documentElement;
    html.classList.remove('dark', 'light');
    html.classList.add(next);
    html.setAttribute('data-theme', next);
    // Persist to localStorage so LibreChat's own ThemeContext stays in sync on reload
    try { localStorage.setItem('theme', next); } catch {}
  };

  useEffect(() => {
    // Observe LibreChat's dark/light class on <html> and sync data-theme attribute
    const sync = () => {
      const detected = detectTheme();
      _setTheme(detected);
      document.documentElement.setAttribute('data-theme', detected);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
