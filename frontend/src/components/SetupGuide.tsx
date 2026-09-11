import { X, Download, Server, CheckCircle } from 'lucide-react';

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
          <h2 className="text-xl font-bold">Quick Setup Guide</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>
        
        <div className="p-6 space-y-8">
          <p className="text-[var(--text-secondary)]">
            InstaGrab requires a small companion helper running locally on your computer to download videos directly to your device with zero rate limits.
          </p>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full insta-gradient text-white flex items-center justify-center font-bold">1</div>
              <div>
                <h3 className="font-semibold text-lg flex items-center"><Download className="w-4 h-4 mr-2" /> Download Helper</h3>
                <p className="text-[var(--text-secondary)] mt-1">Get the InstaGrab Helper for Windows.</p>
                <a 
                  href="https://github.com/Akashbenniamin/InstaGrab/releases/latest" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-block mt-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-insta-pink"
                >
                  Download Helper (EXE) ↗
                </a>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full insta-gradient text-white flex items-center justify-center font-bold">2</div>
              <div>
                <h3 className="font-semibold text-lg flex items-center"><Server className="w-4 h-4 mr-2" /> Run Helper</h3>
                <p className="text-[var(--text-secondary)] mt-1">Run the helper application. It runs silently in your Windows system tray (near the clock).</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full insta-gradient text-white flex items-center justify-center font-bold">3</div>
              <div>
                <h3 className="font-semibold text-lg flex items-center"><CheckCircle className="w-4 h-4 mr-2" /> Automatic Connection</h3>
                <p className="text-[var(--text-secondary)] mt-1">Once the helper is running, this website connects automatically. Paste any link and start downloading!</p>
              </div>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl insta-gradient text-white font-semibold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Got It!
          </button>
        </div>
      </div>
    </div>
  );
}
