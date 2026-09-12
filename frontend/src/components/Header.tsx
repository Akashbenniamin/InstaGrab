import { Settings } from 'lucide-react';
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
      <div className="flex items-center space-x-3.5">
        <div 
          style={{
            background: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-text)',
            boxShadow: 'var(--btn-primary-shadow)'
          }}
          className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 transform hover:scale-105"
        >
          {/* Revamped Universal Media Logo Mark */}
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
            <path d="M12 12v9" />
            <path d="m8 17 4 4 4-4" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">InstaGrab</h1>
            <span 
              style={{
                background: 'var(--badge-bg)',
                color: 'var(--badge-text)',
                borderColor: 'var(--badge-border)'
              }}
              className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border shadow-2xs"
            >
              Universal
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] hidden sm:block font-medium">
            Universal Media Downloader • Instagram, YouTube & Pinterest
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
