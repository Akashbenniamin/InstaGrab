import { X, Download, Server, Key, CheckCircle } from 'lucide-react';

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
          <h2 className="text-xl font-bold">Setup Guide</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>
        
        <div className="p-6 space-y-8">
          <p className="text-[var(--text-secondary)]">
            InstaGrab requires a small companion app running on your computer to handle downloads locally. This ensures high quality and avoids rate limits.
          </p>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full insta-gradient text-white flex items-center justify-center font-bold">1</div>
              <div>
                <h3 className="font-semibold text-lg flex items-center"><Download className="w-4 h-4 mr-2" /> Download</h3>
                <p className="text-[var(--text-secondary)] mt-1">Download the InstaGrab Helper installer for Windows.</p>
                <a 
                  href="https://github.com/Akashbenniamin/InstaGrab/releases/latest" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-block mt-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-insta-pink"
                >
                  Download Helper (EXE) ↗
                </a>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full insta-gradient text-white flex items-center justify-center font-bold">2</div>
              <div>
                <h3 className="font-semibold text-lg flex items-center"><Server className="w-4 h-4 mr-2" /> Install & Run</h3>
                <p className="text-[var(--text-secondary)] mt-1">Run the installer. The helper will start automatically and appear in your system tray (bottom right corner).</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full insta-gradient text-white flex items-center justify-center font-bold">3</div>
              <div>
                <h3 className="font-semibold text-lg flex items-center"><Key className="w-4 h-4 mr-2" /> Get Code</h3>
                <p className="text-[var(--text-secondary)] mt-1">Click the InstaGrab tray icon to view your secure 6-digit pairing code.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full insta-gradient text-white flex items-center justify-center font-bold">4</div>
              <div>
                <h3 className="font-semibold text-lg flex items-center"><CheckCircle className="w-4 h-4 mr-2" /> Pair</h3>
                <p className="text-[var(--text-secondary)] mt-1">Close this guide, click "Pair Now" on the main page, and enter your code.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
