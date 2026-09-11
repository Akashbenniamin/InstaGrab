import { useState, useEffect, useCallback, useRef } from 'react';
import { DownloadProgress } from '../types';
import { helperApi } from '../services/helperApi';
import { addEntry } from '../services/downloadHistory';

export function useDownload() {
  const [downloadState, setDownloadState] = useState<DownloadProgress | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const pollStatus = useCallback(async (id: string, originalUrl: string) => {
    try {
      const status = await helperApi.getDownloadStatus(id);
      
      setDownloadState(prev => {
        if (!prev || prev.id !== id) return prev;
        return {
          ...prev,
          state: status.state,
          progress: status.progress,
          speed: status.speed,
          eta: status.eta,
          filename: status.filename,
          filepath: status.filepath,
          error: status.error,
          errorType: status.errorType as any
        };
      });

      if (['complete', 'error', 'cancelled'].includes(status.state)) {
        clearPolling();
        
        if (status.state === 'complete' && status.filename) {
          addEntry({
            id,
            url: originalUrl,
            filename: status.filename,
            timestamp: Date.now(),
            success: true
          });
        } else if (status.state === 'error') {
          addEntry({
            id,
            url: originalUrl,
            filename: 'Failed Download',
            timestamp: Date.now(),
            success: false
          });
        }
      }
    } catch (error) {
      // Don't transition to error immediately on poll failure, might just be transient
      console.error('Failed to poll status:', error);
    }
  }, []);

  const startDownload = async (url: string, formatType: string = 'video', quality: string = 'best') => {
    try {
      setDownloadState({ id: 'pending', state: 'validating' });
      const downloadId = await helperApi.startDownload(url, formatType, quality);
      
      setDownloadState({ id: downloadId, state: 'connecting' });
      
      clearPolling();
      pollingRef.current = setInterval(() => pollStatus(downloadId, url), 1500);
      
    } catch (error: any) {
      if (error.message === 'UNAUTHORIZED') {
        localStorage.removeItem('insta_dl_token');
        setDownloadState({ id: 'error', state: 'error', errorType: 'helper_offline', error: 'Authorization refreshed. Please click Try Again.' });
      } else {
        setDownloadState({ id: 'error', state: 'error', errorType: 'network', error: error.message });
      }
    }
  };

  const cancelDownload = async () => {
    if (downloadState && downloadState.id !== 'pending' && downloadState.id !== 'error') {
      try {
        await helperApi.cancelDownload(downloadState.id);
        clearPolling();
        setDownloadState(prev => prev ? { ...prev, state: 'cancelled' } : null);
      } catch (error) {
        console.error('Failed to cancel:', error);
      }
    }
  };

  const reset = () => {
    clearPolling();
    setDownloadState(null);
  };

  useEffect(() => {
    return clearPolling;
  }, []);

  return { downloadState, startDownload, cancelDownload, reset };
}
