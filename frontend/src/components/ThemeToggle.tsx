import { Sun, Moon } from 'lucide-react';
import { Theme } from '../hooks/useTheme';

interface Props {
  theme: Theme;
  toggleTheme: () => void;
}

export function ThemeToggle({ theme, toggleTheme }: Props) {
  const isDark = theme !== 'light';

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className="p-2 rounded-xl hover:bg-gray-200/70 dark:hover:bg-gray-800 transition-colors cursor-pointer text-gray-600 dark:text-gray-300"
    >
      {theme === 'light' ? (
        <Moon className="w-5 h-5" />
      ) : (
        <Sun className="w-5 h-5" />
      )}
    </button>
  );
}
