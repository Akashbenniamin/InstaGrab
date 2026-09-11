import { useState } from 'react';
import { HelperStatus as IHelperStatus } from '../types';
import { Download, Play, HelpCircle, Loader2, Cpu, Zap, ChevronDown, Archive } from 'lucide-react';

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
  const [showOptions, setShowOptions] = useState(false);

  const handleLaunchClick = () => {
    setIsLaunching(true);
    launchDesktopHelper();
    setTimeout(() => setIsLaunching(false), 4000);
  };

  // Connected state
  if (status.connected && status.paired) {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between py-3 px-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 text-sm gap-2">
        <div className="flex items-center space-x-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-green-700 dark:text-green-400 font-semibold">InstaGrab Downloader Active</span>
          {status.version && <span className="text-green-600/70 dark:text-green-500/70 text-xs ml-1">v{status.version}</span>}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-green-700/80 dark:text-green-400/80 font-medium">
          <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> 0% Idle CPU</span>
          <span>•</span>
          <span>~28 MB RAM</span>
        </div>
      </div>
    );
  }

  // Connecting state
  if (status.connected && !status.paired) {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between py-3 px-4 rounded-xl bg-pink-50 dark:bg-pink-900/10 border border-pink-200 dark:border-pink-900/30 text-sm gap-3">
        <div className="flex items-center space-x-2 text-pink-700 dark:text-pink-400 font-medium">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-pink-500"></span>
          </span>
          <span>Downloader detected — connecting...</span>
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

  // Not connected / 1-time setup banner
  return (
    <div className="flex flex-col p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/80 text-sm gap-3.5 shadow-xs">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-[var(--text-primary)]">
              InstaGrab Desktop Downloader
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-400">
              1-Time Setup • Free Forever
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Runs locally on your PC. No cloud bandwidth limits, no subscription fees.
          </p>
        </div>

        <button 
          onClick={onSetupClick}
          className="text-xs text-[var(--text-secondary)] hover:text-insta-pink flex items-center gap-1 transition-colors p-1"
          title="View full setup info"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Info</span>
        </button>
      </div>

      {/* Lightweight benchmark stats */}
      <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] text-center text-xs">
        <div>
          <div className="font-bold text-[var(--text-primary)]">0.0%</div>
          <div className="text-[10px] text-[var(--text-secondary)]">Idle CPU Usage</div>
        </div>
        <div className="border-x border-[var(--border-color)]">
          <div className="font-bold text-[var(--text-primary)]">~28 MB</div>
          <div className="text-[10px] text-[var(--text-secondary)]">Idle RAM (Sleep)</div>
        </div>
        <div>
          <div className="font-bold text-[var(--text-primary)] flex items-center justify-center gap-0.5 text-insta-pink">
            <Zap className="w-3 h-3" /> Direct
          </div>
          <div className="text-[10px] text-[var(--text-secondary)]">Max Speed to Disk</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {/* Direct 1-Click Download for Windows (.exe) - Automatically starts download directly! */}
          <a 
            href="https://github.com/Akashbenniamin/InstaGrab/releases/latest/download/InstaGrab-Helper-Setup-1.0.0.exe"
            download="InstaGrab-Helper-Setup-1.0.0.exe"
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl insta-gradient text-white text-xs font-bold hover:opacity-95 shadow-sm transition-all cursor-pointer text-center"
            title="Direct 1-click download of the Windows installer without opening GitHub"
          >
            <Download className="w-4 h-4" />
            <span>Download for Windows (.exe)</span>
          </a>

          {/* 1-Click Launch if already installed */}
          <button 
            onClick={handleLaunchClick}
            disabled={isLaunching}
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-insta-pink text-xs font-semibold text-[var(--text-primary)] hover:text-insta-pink shadow-xs transition-all cursor-pointer"
            title="Already installed? Click to launch InstaGrab immediately"
          >
            {isLaunching ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-insta-pink" />
                <span>Launching...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-insta-pink fill-insta-pink" />
                <span>Already Installed? Launch</span>
              </>
            )}
          </button>
        </div>

        {/* More options toggle */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1 transition-colors"
          >
            <span>Other formats (Portable ZIP)</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showOptions ? 'rotate-180' : ''}`} />
          </button>

          {showOptions && (
            <div className="mt-2 p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)] flex items-center gap-1">
                <Archive className="w-3.5 h-3.5 text-insta-purple" />
                Windows Portable (No Install Required)
              </span>
              <a
                href="https://github.com/Akashbenniamin/InstaGrab/releases/latest/download/InstaGrab-Portable-Windows.zip"
                download="InstaGrab-Portable-Windows.zip"
                className="font-bold text-insta-pink hover:underline"
              >
                Download (.zip)
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
