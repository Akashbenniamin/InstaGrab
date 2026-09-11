import { Download, Settings } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { Theme } from '../hooks/useTheme';

interface Props {
  theme: Theme;
  toggleTheme: () => void;
  onOpenSettings: () => void;
}

export function Header({ theme, toggleTheme, onOpenSettings }: Props) {
  return (
    <header className="flex items-center justify-between py-6">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl insta-gradient flex items-center justify-center shadow-md">
          <Download className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">InstaGrab</h1>
          <p className="text-xs text-[var(--text-secondary)] hidden sm:block">
            Instagram, YouTube & Pinterest Downloader • 1-Time Setup • Free Forever
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-1.5">
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-xl hover:bg-gray-200/70 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300 cursor-pointer"
          title="Settings (Download Folder, Themes & Options)"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
      </div>
    </header>
  );
}
