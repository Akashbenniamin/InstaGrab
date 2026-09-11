import { Download } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export function Header({ theme, toggleTheme }: Props) {
  return (
    <header className="flex items-center justify-between py-6">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl insta-gradient flex items-center justify-center shadow-md">
          <Download className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">InstaGrab</h1>
          <p className="text-xs text-[var(--text-secondary)] hidden sm:block">
            Decentralized Instagram & YouTube Downloader (MP4 / MP3)
          </p>
        </div>
      </div>
      <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
    </header>
  );
}
