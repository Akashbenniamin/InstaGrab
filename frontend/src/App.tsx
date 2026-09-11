import { useState, useEffect } from 'react';
import { useTheme } from './hooks/useTheme';
import { useHelperConnection } from './hooks/useHelperConnection';
import { useDownload } from './hooks/useDownload';
import { validateMediaUrl } from './services/urlValidator';
import { getHistory, clearHistory } from './services/downloadHistory';
import { HistoryEntry, FormatType, VideoQuality, AudioQuality } from './types';

import { Header } from './components/Header';
import { UrlInput } from './components/UrlInput';
import { DownloadOptions } from './components/DownloadOptions';
import { DownloadButton } from './components/DownloadButton';
import { ProgressDisplay } from './components/ProgressDisplay';
import { HelperStatus as HelperStatusComponent } from './components/HelperStatus';
import { SetupGuide } from './components/SetupGuide';
import { DownloadHistory } from './components/DownloadHistory';
import { PrivacyNotice } from './components/PrivacyNotice';
import { MobileNotice } from './components/MobileNotice';
import { SettingsModal } from './components/SettingsModal';

import { Zap } from 'lucide-react';

function App() {
  const { theme, setTheme, toggleTheme } = useTheme();
  const { status, pair } = useHelperConnection();
  const { 
    downloads, 
    isSubmitting, 
    startDownload, 
    cancelDownload, 
    dismissDownload, 
    clearCompleted 
  } = useDownload();
  
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [formatType, setFormatType] = useState<FormatType>('video');
  const [videoQuality, setVideoQuality] = useState<VideoQuality>('best');
  const [audioQuality, setAudioQuality] = useState<AudioQuality>('best');
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [quickMode, setQuickMode] = useState(() => localStorage.getItem('insta_dl_quick_mode') === 'true');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(getHistory());
  }, [downloads]); // Refresh history whenever downloads update

  const toggleQuickMode = () => {
    setQuickMode(prev => {
      const next = !prev;
      localStorage.setItem('insta_dl_quick_mode', String(next));
      return next;
    });
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setUrlError('');
  };

  const handleDownload = async (overrideUrl?: string) => {
    const inputUrl = (overrideUrl || url).trim();
    if (!status.connected) {
      setIsSetupOpen(true);
      return;
    }
    
    // Auto-pair silently if not paired yet or if token is missing
    if (!status.paired || !localStorage.getItem('insta_dl_token')) {
      const paired = await pair('auto');
      if (!paired) {
        setIsSetupOpen(true);
        return;
      }
    }

    const { valid, error, normalized } = validateMediaUrl(inputUrl);
    if (!valid) {
      setUrlError(error || 'Please enter a valid Instagram, YouTube, or Pinterest URL');
      return;
    }

    const targetUrl = normalized!;
    const quality = formatType === 'video' ? videoQuality : audioQuality;

    await startDownload(targetUrl, formatType, quality);
  };

  const handlePasteText = (pastedText: string) => {
    if (!quickMode) return;
    const { valid } = validateMediaUrl(pastedText);
    if (valid) {
      // Immediate download upon pasting when quick mode is active
      setTimeout(() => {
        handleDownload(pastedText);
      }, 50);
    }
  };

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)]">
      <div className="max-w-6xl mx-auto px-4 pb-12 sm:px-6 lg:px-8">
        <Header 
          theme={theme} 
          toggleTheme={toggleTheme} 
          onOpenSettings={() => setIsSettingsOpen(true)} 
        />
        
        <div className="mt-8 flex flex-col lg:flex-row gap-8 items-start">
          {/* Left Column: Recent Downloads (Sticky on desktop, utilizing free empty space) */}
          <aside className="w-full lg:w-80 lg:sticky lg:top-8 order-2 lg:order-1 flex-shrink-0">
            <DownloadHistory 
              history={history}
              onClear={handleClearHistory}
            />
          </aside>

          {/* Right / Main Column: Downloader Card & Active Jobs Queue */}
          <main className="flex-1 w-full max-w-2xl mx-auto order-1 lg:order-2 space-y-6">
            <MobileNotice isConnected={status.connected} />
            
            <div className="bg-[var(--bg-card)] rounded-3xl p-4 sm:p-8 shadow-sm border border-[var(--border-color)]">
              <div className="space-y-6">
                <UrlInput 
                  value={url}
                  onChange={handleUrlChange}
                  onSubmit={() => handleDownload()}
                  onPasteText={handlePasteText}
                  disabled={isSubmitting}
                  error={urlError}
                />

                <DownloadOptions
                  formatType={formatType}
                  onFormatChange={setFormatType}
                  videoQuality={videoQuality}
                  onVideoQualityChange={setVideoQuality}
                  audioQuality={audioQuality}
                  onAudioQualityChange={setAudioQuality}
                  disabled={isSubmitting}
                />
                
                <div className="space-y-2">
                  <DownloadButton 
                    onClick={() => handleDownload()}
                    disabled={!url || !!urlError}
                    loading={isSubmitting}
                    formatType={formatType}
                  />

                  {/* Quick Mode Toggle */}
                  <div className="flex items-center justify-between px-1">
                    <button
                      type="button"
                      onClick={toggleQuickMode}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                        quickMode
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-xs'
                          : 'bg-transparent border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                      title="When active, pasting a link automatically starts the download immediately"
                    >
                      <Zap className={`w-3.5 h-3.5 ${quickMode ? 'fill-amber-500 text-amber-500' : 'text-gray-400'}`} />
                      <span>Quick Mode: {quickMode ? 'ON' : 'OFF'}</span>
                    </button>

                    {quickMode && (
                      <span className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1 animate-in fade-in">
                        ⚡ Auto-downloads on paste
                      </span>
                    )}
                  </div>
                </div>

                <HelperStatusComponent 
                  status={status}
                  onSetupClick={() => setIsSetupOpen(true)}
                  onPairClick={() => pair('auto')}
                />
              </div>
            </div>

            {/* Active Concurrent Downloads Queue */}
            <ProgressDisplay 
              downloads={downloads}
              onCancel={cancelDownload}
              onDismiss={dismissDownload}
              onClearCompleted={clearCompleted}
              onRetry={(item) => {
                dismissDownload(item.id);
                // If the user had a failed download, auto-refill or retry
              }}
            />

            <PrivacyNotice />
          </main>
        </div>
      </div>
      
      <SetupGuide 
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        status={status}
      />
    </div>
  );
}

export default App;
