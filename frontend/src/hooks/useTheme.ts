import { useState, useEffect, useCallback } from 'react';
import { helperApi } from '../services/helperApi';

export type Theme = 'system' | 'creators' | 'dark' | 'light' | 'cyberpunk' | 'sunset' | 'oled' | 'emerald';

const VALID_THEMES: Theme[] = ['system', 'creators', 'dark', 'light', 'cyberpunk', 'sunset', 'oled', 'emerald'];

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('insta_dl_theme') as Theme;
      if (VALID_THEMES.includes(saved)) {
        return saved;
      }
    } catch {}
    return 'sunset'; // Sunset Amber default
  });

  // Synchronize with local helper daemon config (survives Brave wiping site data / localStorage)
  useEffect(() => {
    let isMounted = true;
    helperApi.getConfig().then(cfg => {
      if (!isMounted || !cfg) return;
      if (cfg.theme && VALID_THEMES.includes(cfg.theme as Theme)) {
        try {
          const local = localStorage.getItem('insta_dl_theme');
          if (!local || local !== cfg.theme) {
            localStorage.setItem('insta_dl_theme', cfg.theme);
            setThemeState(cfg.theme as Theme);
          }
        } catch {
          setThemeState(cfg.theme as Theme);
        }
      }
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('insta_dl_theme', newTheme);
    } catch {}
    // Also persist to helper engine config on disk so Brave restarting won't lose it
    helperApi.updateConfig({ theme: newTheme }).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('insta_dl_theme', theme);
    } catch {}

    const applyTheme = () => {
      const classesToRemove = ['dark', 'light', 'creators', 'cyberpunk', 'sunset', 'oled', 'emerald'];
      document.documentElement.classList.remove(...classesToRemove);

      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const effectiveTheme = theme === 'system' ? (isSystemDark ? 'dark' : 'light') : theme;

      if (effectiveTheme === 'light') {
        document.documentElement.classList.add('light');
      } else if (effectiveTheme === 'creators') {
        document.documentElement.classList.add('creators');
      } else {
        // Apply dark base for tailwind dark: modifiers, plus the specific theme class
        document.documentElement.classList.add('dark');
        if (effectiveTheme !== 'dark') {
          document.documentElement.classList.add(effectiveTheme);
        }
      }
    };

    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    // Quick toggle between light and sunset amber
    setThemeState(prev => {
      const next: Theme = prev === 'light' ? 'sunset' : 'light';
      try {
        localStorage.setItem('insta_dl_theme', next);
      } catch {}
      helperApi.updateConfig({ theme: next }).catch(() => {});
      return next;
    });
  }, []);

  return { theme, setTheme, toggleTheme };
}

