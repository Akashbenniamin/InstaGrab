import { useState, useEffect } from 'react';

export type Theme = 'system' | 'dark' | 'light' | 'creators' | 'cyberpunk' | 'sunset' | 'oled';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('insta_dl_theme') as Theme;
    if (['system', 'dark', 'light', 'creators', 'cyberpunk', 'sunset', 'oled'].includes(saved)) {
      return saved;
    }
    return 'system';
  });

  useEffect(() => {
    localStorage.setItem('insta_dl_theme', theme);

    const applyTheme = () => {
      const classesToRemove = ['dark', 'light', 'creators', 'cyberpunk', 'sunset', 'oled'];
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

  const toggleTheme = () => {
    // Quick toggle between dark and light
    setTheme(prev => {
      if (prev === 'light') return 'dark';
      return 'light';
    });
  };

  return { theme, setTheme, toggleTheme };
}

