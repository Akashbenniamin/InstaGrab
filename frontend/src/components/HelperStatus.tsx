import { useState } from 'react';
import { HelperStatus as IHelperStatus } from '../types';
import { Download, Play, HelpCircle, Loader2, Cpu, Zap } from 'lucide-react';

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
    try { document.body.removeChild(iframe); } catch {}
  }, 2000);
}

export function HelperStatus({ status, onSetupClick, onPairClick }: Props) {
  const [isLaunching, setIsLaunching] = useState(false);

  const handleLaunchClick = () => {
    setIsLaunching(true);
    launchDesktopHelper();
    setTimeout(() => setIsLaunching(false), 4000);
  };

  // Connected state
  if (status.connected && status.paired) {
    return (
      <div 
        style={{
          background: 'var(--status-active-bg)',
          borderColor: 'var(--status-active-border)',
          color: 'var(--status-active-text)'
        }}
        className="flex flex-col sm:flex-row items-center justify-between py-3 px-4 rounded-2xl border text-sm gap-2 transition-all"
      >
        <div className="flex items-center space-x-2.5">
          <span className="relative flex h-3 w-3">
            <span 
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: 'var(--status-active-dot)' }}
            ></span>
            <span 
              className="relative inline-flex rounded-full h-3 w-3"
              style={{ background: 'var(--status-active-dot)' }}
            ></span>
          </span>
          <span className="font-bold tracking-tight">InstaGrab Engine Active</span>
          {status.version && <span className="opacity-80 text-xs ml-1">v{status.version}</span>}
        </div>
        <div className="flex items-center gap-2 text-[11px] opacity-90 font-medium">
          <span className="flex items-center gap-1"><Cpu className="w-3.5 h-3.5" /> 0% Idle CPU</span>
          <span>•</span>
          <span>~28 MB RAM</span>
        </div>
      </div>
    );
  }

  // Connecting state
  if (status.connected && !status.paired) {
    return (
      <div 
        style={{
          background: 'var(--badge-bg)',
          borderColor: 'var(--badge-border)',
          color: 'var(--badge-text)'
        }}
        className="flex flex-col sm:flex-row items-center justify-between py-3 px-4 rounded-2xl border text-sm gap-3"
      >
        <div className="flex items-center space-x-2 font-medium">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--accent-color)' }}></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: 'var(--accent-color)' }}></span>
          </span>
          <span>Engine detected — pairing...</span>
        </div>
        <button 
          onClick={onPairClick}
          style={{
            background: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-text)',
            boxShadow: 'var(--btn-primary-shadow)'
          }}
          className="px-3.5 py-1.5 rounded-xl font-bold transition-all text-xs hover:opacity-90 cursor-pointer"
        >
          Connect
        </button>
      </div>
    );
  }

  // Not connected / 1-time setup banner
  return (
    <div className="flex flex-col p-4 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)] text-sm gap-3.5 shadow-xs">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-[var(--text-primary)]">
              InstaGrab Desktop Downloader
            </h3>
            <span 
              style={{
                background: 'var(--badge-bg)',
                color: 'var(--badge-text)',
                borderColor: 'var(--badge-border)'
              }}
              className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
            >
              1-Time Setup • Free Forever
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Runs locally on your PC. No cloud bandwidth limits, no subscription fees.
          </p>
        </div>

        <button 
          onClick={onSetupClick}
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-color)] flex items-center gap-1 transition-colors p-1"
          title="View full setup info"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Info</span>
        </button>
      </div>

      {/* Lightweight benchmark stats */}
      <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center text-xs">
        <div>
          <div className="font-bold text-[var(--text-primary)]">0.0%</div>
          <div className="text-[10px] text-[var(--text-secondary)]">Idle CPU Usage</div>
        </div>
        <div className="border-x border-[var(--border-color)]">
          <div className="font-bold text-[var(--text-primary)]">~28 MB</div>
          <div className="text-[10px] text-[var(--text-secondary)]">Idle RAM (Sleep)</div>
        </div>
        <div>
          <div 
            style={{ color: 'var(--accent-color)' }}
            className="font-bold flex items-center justify-center gap-0.5"
          >
            <Zap className="w-3 h-3" /> Direct
          </div>
          <div className="text-[10px] text-[var(--text-secondary)]">Max Speed to Disk</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {/* Direct 1-Click Download for Windows (.exe) */}
          <a 
            href="https://github.com/Akashbenniamin/InstaGrab/releases/latest/download/InstaGrab-Helper-Setup.exe"
            download="InstaGrab-Helper-Setup.exe"
            style={{
              background: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-text)',
              boxShadow: 'var(--btn-primary-shadow)'
            }}
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold hover:opacity-95 shadow-sm transition-all cursor-pointer text-center"
            title="Direct 1-click download of the Windows installer without opening GitHub"
          >
            <Download className="w-4 h-4" />
            <span>Download for Windows (.exe)</span>
          </a>

          {/* 1-Click Launch if already installed */}
          <button 
            onClick={handleLaunchClick}
            disabled={isLaunching}
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--accent-color)] text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--accent-color)] shadow-xs transition-all cursor-pointer"
            title="Already installed? Click to launch InstaGrab immediately"
          >
            {isLaunching ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent-color)' }} />
                <span>Launching...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" style={{ color: 'var(--accent-color)', fill: 'var(--accent-color)' }} />
                <span>Already Installed? Launch</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
