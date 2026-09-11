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

function App() {
  const { theme, toggleTheme } = useTheme();
  const { status, pair } = useHelperConnection();
  const { downloadState, startDownload, reset } = useDownload();
  
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [formatType, setFormatType] = useState<FormatType>('video');
  const [videoQuality, setVideoQuality] = useState<VideoQuality>('best');
  const [audioQuality, setAudioQuality] = useState<AudioQuality>('best');
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(getHistory());
  }, [downloadState?.state]); // Refresh history when download finishes

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setUrlError('');
    if (downloadState?.state === 'error' || downloadState?.state === 'complete' || downloadState?.state === 'cancelled') {
      reset();
    }
  };

  const handleDownload = async () => {
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

    const { valid, error, normalized } = validateMediaUrl(url);
    if (!valid) {
      setUrlError(error || 'Please enter a valid Instagram, YouTube, or Pinterest URL');
      return;
    }

    const quality = formatType === 'video' ? videoQuality : audioQuality;
    startDownload(normalized!, formatType, quality);
  };

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
  };

  const isLoading = downloadState !== null && 
                   downloadState.state !== 'complete' && 
                   downloadState.state !== 'error' && 
                   downloadState.state !== 'cancelled';

  return (
    <div className="min-h-screen bg-[var(--bg-main)]">
      <div className="max-w-[640px] mx-auto px-4 pb-12 sm:px-6 lg:px-8">
        <Header theme={theme} toggleTheme={toggleTheme} />
        
        <main className="mt-8 space-y-6">
          <MobileNotice isConnected={status.connected} />
          
          <div className="bg-[var(--bg-card)] rounded-3xl p-4 sm:p-8 shadow-sm border border-[var(--border-color)]">
            <div className="space-y-6">
              <UrlInput 
                value={url}
                onChange={handleUrlChange}
                onSubmit={handleDownload}
                disabled={isLoading}
                error={urlError}
              />

              <DownloadOptions
                formatType={formatType}
                onFormatChange={setFormatType}
                videoQuality={videoQuality}
                onVideoQualityChange={setVideoQuality}
                audioQuality={audioQuality}
                onAudioQualityChange={setAudioQuality}
                disabled={isLoading}
              />
              
              <DownloadButton 
                onClick={handleDownload}
                disabled={!url || !!urlError}
                loading={isLoading}
                state={downloadState?.state || 'idle'}
                formatType={formatType}
              />

              <HelperStatusComponent 
                status={status}
                onSetupClick={() => setIsSetupOpen(true)}
                onPairClick={() => pair('auto')}
              />
            </div>
          </div>

          <ProgressDisplay 
            progress={downloadState} 
            onRetry={handleDownload}
          />
          
          <DownloadHistory 
            history={history}
            onClear={handleClearHistory}
          />

          <PrivacyNotice />
        </main>
      </div>
      
      <SetupGuide 
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
      />
    </div>
  );
}

export default App;
