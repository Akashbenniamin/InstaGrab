import { X, Download, Server, CheckCircle, Cpu, Zap, Archive } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function SetupGuide({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--overlay-bg)] backdrop-blur-sm">
      <div className="bg-[var(--bg-card)] rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto border border-[var(--border-color)]">
        <div className="sticky top-0 bg-[var(--bg-card)] flex justify-between items-center p-4 border-b border-[var(--border-color)] z-10">
          <div>
            <h2 className="text-lg font-bold">1-Time Setup • Use Free Forever</h2>
            <p className="text-xs text-[var(--text-secondary)]">InstaGrab Desktop Downloader</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Benchmarks highlight */}
          <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] space-y-2">
            <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-insta-pink" />
              Ultra-Lightweight Desktop Engine
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Unlike web scrapers that hit cloud rate-limits and charge monthly subscriptions, InstaGrab runs as a tiny local engine on your PC. It sleeps silently in the background and only wakes up when you click Download.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <Cpu className="w-3.5 h-3.5 text-green-500" />
                <span><strong>0.0% CPU</strong> in background</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span><strong>~28 MB RAM</strong> in sleep mode</span>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-5">
            <div className="flex gap-3.5">
              <div className="flex-shrink-0 w-7 h-7 rounded-full insta-gradient text-white flex items-center justify-center font-bold text-xs">1</div>
              <div className="space-y-2 flex-1">
                <h3 className="font-semibold text-sm flex items-center">
                  <Download className="w-4 h-4 mr-1.5 text-insta-pink" /> 
                  Download for Windows
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Click below to immediately start downloading the Windows application.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a 
                    href="https://github.com/Akashbenniamin/InstaGrab/releases/latest/download/InstaGrab-Helper-Setup-1.0.0.exe" 
                    download="InstaGrab-Helper-Setup-1.0.0.exe"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 insta-gradient text-white rounded-lg text-xs font-bold hover:opacity-95 transition-all shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Windows Installer (.exe)</span>
                  </a>

                  <a 
                    href="https://github.com/Akashbenniamin/InstaGrab/releases/latest/download/InstaGrab-Portable-Windows.zip" 
                    download="InstaGrab-Portable-Windows.zip"
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-[var(--text-primary)]"
                  >
                    <Archive className="w-3.5 h-3.5 text-insta-purple" />
                    <span>Portable (.zip)</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="flex gap-3.5">
              <div className="flex-shrink-0 w-7 h-7 rounded-full insta-gradient text-white flex items-center justify-center font-bold text-xs">2</div>
              <div>
                <h3 className="font-semibold text-sm flex items-center">
                  <Server className="w-4 h-4 mr-1.5 text-insta-purple" /> 
                  Run InstaGrab Once
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Launch the application. It sits in your Windows system tray (near the clock) using 0% CPU.
                </p>
              </div>
            </div>

            <div className="flex gap-3.5">
              <div className="flex-shrink-0 w-7 h-7 rounded-full insta-gradient text-white flex items-center justify-center font-bold text-xs">3</div>
              <div>
                <h3 className="font-semibold text-sm flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1.5 text-green-500" /> 
                  Download Anything Free Forever
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  This website connects automatically! Paste any link from Instagram, YouTube, or Pinterest and download in full quality.
                </p>
              </div>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl insta-gradient text-white font-semibold text-sm hover:opacity-95 transition-opacity cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
