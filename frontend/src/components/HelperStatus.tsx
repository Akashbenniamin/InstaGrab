import { useState } from 'react';
import { HelperStatus as IHelperStatus } from '../types';
import { Download, Play, HelpCircle, Loader2 } from 'lucide-react';

interface Props {
  status: IHelperStatus;
  onSetupClick: () => void;
  onPairClick: () => void;
}

export function launchDesktopHelper() {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = 'instagrab://launch';
  document.body.appendChild(iframe);
  setTimeout(() => {
    try {
      document.body.removeChild(iframe);
    } catch {
      // Ignored
    }
  }, 3000);
}

export function HelperStatus({ status, onSetupClick, onPairClick }: Props) {
  const [isLaunching, setIsLaunching] = useState(false);

  const handleLaunchClick = () => {
    setIsLaunching(true);
    launchDesktopHelper();
    // Reset launching status after 4s
    setTimeout(() => setIsLaunching(false), 4000);
  };

  if (status.connected && status.paired) {
    return (
      <div className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 text-sm">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
        </span>
        <span className="text-green-700 dark:text-green-400 font-semibold">Local downloader connected</span>
        {status.version && <span className="text-green-600/70 dark:text-green-500/70 text-xs ml-1">v{status.version}</span>}
      </div>
    );
  }

  if (status.connected && !status.paired) {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between py-3 px-4 rounded-xl bg-pink-50 dark:bg-pink-900/10 border border-pink-200 dark:border-pink-900/30 text-sm gap-3">
        <div className="flex items-center space-x-2 text-pink-700 dark:text-pink-400 font-medium">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-pink-500"></span>
          </span>
          <span>Helper detected — connecting...</span>
        </div>
        <button 
          onClick={onPairClick}
          className="px-3 py-1.5 insta-gradient text-white rounded-lg font-semibold transition-opacity text-xs hover:opacity-90 cursor-pointer"
        >
          Connect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col py-3.5 px-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-sm gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 font-medium">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>Local Helper Not Detected</span>
        </div>
        <button 
          onClick={onSetupClick}
          className="text-xs text-[var(--text-secondary)] hover:text-insta-pink flex items-center gap-1 transition-colors"
          title="View full installation and setup guide"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Guide</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
        {/* 1-Click Launch button */}
        <button 
          onClick={handleLaunchClick}
          disabled={isLaunching}
          className="w-full sm:w-auto flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-insta-pink text-xs font-semibold text-[var(--text-primary)] hover:text-insta-pink shadow-xs transition-all cursor-pointer"
          title="Run the helper application if already installed on your PC"
        >
          {isLaunching ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-insta-pink" />
              <span>Starting Helper...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-insta-pink fill-insta-pink" />
              <span>Launch Helper App</span>
            </>
          )}
        </button>

        {/* 1-Click Install button */}
        <a 
          href="https://github.com/Akashbenniamin/InstaGrab/releases/latest"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl insta-gradient text-white text-xs font-semibold hover:opacity-90 shadow-xs transition-all text-center"
          title="Download the Windows installer directly from the website"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install Helper (EXE)</span>
        </a>
      </div>
    </div>
  );
}
