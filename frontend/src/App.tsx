import { useState, useEffect } from 'react';
import { useTheme } from './hooks/useTheme';
import { useHelperConnection } from './hooks/useHelperConnection';
import { useDownload } from './hooks/useDownload';
import { validateMediaUrl } from './services/urlValidator';
import { getHistory, clearHistory } from './services/downloadHistory';
import { HistoryEntry, FormatType, VideoQuality, AudioQuality, CarouselMediaItem } from './types';

import { Header } from './components/Header';
import { UrlInput } from './components/UrlInput';
import { DownloadOptions } from './components/DownloadOptions';
import { DownloadButton } from './components/DownloadButton';
import { ProgressDisplay } from './components/ProgressDisplay';
import { HelperStatus as HelperStatusComponent } from './components/HelperStatus';
import { SetupGuide } from './components/SetupGuide';
import { DownloadHistory } from './components/DownloadHistory';
import { MediaPreview } from './components/MediaPreview';
import { CarouselGallery } from './components/CarouselGallery';
import { MobileNotice } from './components/MobileNotice';
import { SettingsModal } from './components/SettingsModal';
import { BannerAd } from './components/BannerAd';

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
  const [detectedMediaType, setDetectedMediaType] = useState<string | undefined>(undefined);
  const [carouselMedia, setCarouselMedia] = useState<CarouselMediaItem[] | null>(null);

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
    if (!value.trim()) {
      setDetectedMediaType(undefined);
      setCarouselMedia(null);
    } else {
      const val = validateMediaUrl(value.trim());
      if (val.valid) {
        setDetectedMediaType(val.contentType);
      } else {
        setDetectedMediaType(undefined);
        setCarouselMedia(null);
      }
    }
  };

  const handleDownload = async (overrideUrl?: string, options?: { itemIndex?: number; asZip?: boolean }) => {
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
    const downloadOptions = options || (detectedMediaType === 'carousel' ? { asZip: true } : undefined);

    await startDownload(targetUrl, formatType, quality, downloadOptions);
  };

  const handleDownloadItem = (itemIndex: number) => {
    handleDownload(undefined, { itemIndex });
  };

  const handleDownloadAllZip = () => {
    handleDownload(undefined, { asZip: true });
  };

  const handleDownloadAllOneByOne = () => {
    handleDownload(undefined, { asZip: false });
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

        {/* Top Header Leaderboard Ad Banner */}
        <BannerAd format="leaderboard" className="mt-1 mb-2" />
        
        <div className="mt-4 flex flex-col lg:flex-row gap-7 items-start">
          {/* Left Column: Recent Downloads (Sticky on desktop) */}
          <aside className="w-full lg:w-72 lg:sticky lg:top-8 order-2 lg:order-1 flex-shrink-0">
            <DownloadHistory 
              history={history}
              onClear={handleClearHistory}
            />
          </aside>

          {/* Right / Main Column: Downloader Card & Active Jobs Queue */}
          <main className="flex-1 w-full max-w-3xl mx-auto order-1 lg:order-2 space-y-6">
            <MobileNotice isConnected={status.connected} />
            
            <div className="bg-[var(--bg-card)] rounded-3xl p-4 sm:p-6 shadow-sm border border-[var(--border-color)]">
              <div className="space-y-4">
                {/* 1. URL Input Bar */}
                <UrlInput 
                  value={url}
                  onChange={handleUrlChange}
                  onSubmit={() => handleDownload()}
                  onPasteText={handlePasteText}
                  disabled={isSubmitting}
                  error={urlError}
                />

                {/* 2. Responsive 2-Column: Controls (Left) + Media Preview (Right) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch pt-1">
                  {/* Left Column: Format, Quality, Download Button, Revamped Quick Mode */}
                  <div className="md:col-span-7 flex flex-col justify-between space-y-3">
                    <DownloadOptions
                      formatType={formatType}
                      onFormatChange={setFormatType}
                      videoQuality={videoQuality}
                      onVideoQualityChange={setVideoQuality}
                      audioQuality={audioQuality}
                      onAudioQualityChange={setAudioQuality}
                      disabled={isSubmitting}
                    />

                    <div className="space-y-2 pt-1">
                      <DownloadButton 
                        onClick={() => handleDownload()}
                        disabled={!url || !!urlError}
                        loading={isSubmitting}
                        formatType={formatType}
                        mediaType={detectedMediaType}
                        carouselCount={carouselMedia?.length}
                      />

                      {/* Revamped Quick Mode Switch Tile */}
                      <button
                        type="button"
                        onClick={toggleQuickMode}
                        style={quickMode ? {
                          background: 'var(--quick-mode-bg)',
                          borderColor: 'var(--quick-mode-border)',
                          color: 'var(--quick-mode-text)'
                        } : undefined}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                          quickMode
                            ? 'shadow-2xs font-semibold'
                            : 'bg-[var(--bg-main)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-gray-400'
                        }`}
                        title="When active, pasting a valid link automatically starts the download immediately"
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <div 
                            style={quickMode ? {
                              background: 'var(--accent-color)',
                              color: '#ffffff'
                            } : undefined}
                            className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                              quickMode ? '' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'
                            }`}
                          >
                            <Zap className="w-3 h-3 fill-current" />
                          </div>
                          <span>Quick Mode: Auto-download</span>
                        </div>

                        {/* Smooth Toggle Switch Indicator */}
                        <div 
                          style={quickMode ? { background: 'var(--accent-color)' } : undefined}
                          className={`w-8 h-4.5 rounded-full p-0.5 transition-colors relative flex items-center ${
                            quickMode ? '' : 'bg-gray-300 dark:bg-gray-700'
                          }`}
                        >
                          <div 
                            className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-transform transform ${
                              quickMode ? 'translate-x-3.5' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Live Thumbnail & Media Preview */}
                  <div className="md:col-span-5 flex flex-col">
                    <MediaPreview 
                      url={url} 
                      onMediaDetected={({ mediaType, carouselMedia: detectedCarousel }) => {
                        if (mediaType) setDetectedMediaType(mediaType);
                        if (detectedCarousel && detectedCarousel.length > 0) {
                          setCarouselMedia(detectedCarousel);
                        } else {
                          setCarouselMedia(null);
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Carousel Media Cards Gallery */}
                {carouselMedia && carouselMedia.length > 0 && (
                  <CarouselGallery
                    items={carouselMedia}
                    onDownloadItem={handleDownloadItem}
                    onDownloadAllZip={handleDownloadAllZip}
                    onDownloadAllImages={handleDownloadAllOneByOne}
                    isDownloading={isSubmitting}
                  />
                )}

                {/* 3. Engine Status Banner */}
                <div className="pt-1">
                  <HelperStatusComponent 
                    status={status}
                    onSetupClick={() => setIsSetupOpen(true)}
                    onPairClick={() => pair('auto')}
                  />
                </div>
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
              }}
            />

            {/* Bottom Leaderboard Ad Banner */}
            <BannerAd format="leaderboard" className="pt-2" />
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
