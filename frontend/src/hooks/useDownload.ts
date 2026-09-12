import { useState, useEffect, useCallback, useRef } from 'react';
import { DownloadProgress } from '../types';
import { helperApi } from '../services/helperApi';
import { addEntry } from '../services/downloadHistory';

export function useDownload() {
  const [downloads, setDownloads] = useState<DownloadProgress[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Track original URLs for each download ID
  const urlMapRef = useRef<Map<string, string>>(new Map());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollActiveDownloads = useCallback(async () => {
    setDownloads(currentDownloads => {
      // Find active downloads that need polling
      const active = currentDownloads.filter(d => 
        !['complete', 'error', 'cancelled'].includes(d.state) && !d.id.startsWith('temp_')
      );

      if (active.length === 0) return currentDownloads;

      // Poll each active download asynchronously
      active.forEach(async (job) => {
        try {
          const status = await helperApi.getDownloadStatus(job.id);
          const originalUrl = urlMapRef.current.get(job.id) || '';

          setDownloads(prevList => {
            return prevList.map(item => {
              if (item.id !== job.id) return item;

              const updated: DownloadProgress = {
                ...item,
                state: status.state,
                progress: status.progress,
                speed: status.speed,
                eta: status.eta,
                filename: status.filename,
                filepath: status.filepath,
                error: status.error,
                errorType: status.errorType as any
              };

              // If newly transitioned to complete/error, record to history
              if (['complete', 'error', 'cancelled'].includes(status.state) && !['complete', 'error', 'cancelled'].includes(item.state)) {
                if (status.state === 'complete' && status.filename) {
                  addEntry({
                    id: job.id,
                    url: originalUrl,
                    filename: status.filename,
                    filepath: status.filepath,
                    timestamp: Date.now(),
                    success: true
                  });

                  // Stream file directly to browser download manager (same as extension)
                  helperApi.triggerBrowserDownload(status.filename);

                  // Automatically remove finished task from bottom section after 3.5 seconds
                  setTimeout(() => {
                    setDownloads(current => current.filter(d => d.id !== job.id));
                  }, 3500);
                } else if (status.state === 'error') {
                  addEntry({
                    id: job.id,
                    url: originalUrl,
                    filename: status.filename || 'Failed Download',
                    timestamp: Date.now(),
                    success: false
                  });
                }
              }

              return updated;
            });
          });
        } catch (err) {
          console.error(`Failed to poll status for ${job.id}:`, err);
        }
      });

      return currentDownloads;
    });
  }, []);

  useEffect(() => {
    pollingRef.current = setInterval(pollActiveDownloads, 1500);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pollActiveDownloads]);

  const startDownload = async (url: string, formatType: string = 'video', quality: string = 'best') => {
    setIsSubmitting(true);
    const tempId = 'temp_' + Date.now();
    
    // Add placeholder in active downloads
    const newJob: DownloadProgress = {
      id: tempId,
      state: 'validating',
      progress: 0,
      filename: 'Initializing download...'
    };
    
    setDownloads(prev => [newJob, ...prev]);

    try {
      const downloadId = await helperApi.startDownload(url, formatType, quality);
      urlMapRef.current.set(downloadId, url);

      setDownloads(prev => prev.map(d => d.id === tempId ? {
        ...d,
        id: downloadId,
        state: 'connecting',
        filename: 'Connecting to source...'
      } : d));
      
    } catch (error: any) {
      if (error.message === 'UNAUTHORIZED') {
        localStorage.removeItem('insta_dl_token');
        setDownloads(prev => prev.map(d => d.id === tempId ? {
          ...d,
          state: 'error',
          errorType: 'helper_offline',
          error: 'Authorization refreshed. Please click Try Again.'
        } : d));
      } else {
        setDownloads(prev => prev.map(d => d.id === tempId ? {
          ...d,
          state: 'error',
          errorType: 'network',
          error: error.message || 'Failed to start download'
        } : d));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelDownload = async (id: string) => {
    try {
      await helperApi.cancelDownload(id);
      setDownloads(prev => prev.map(d => d.id === id ? { ...d, state: 'cancelled' } : d));
    } catch (e) {
      console.error('Failed to cancel:', e);
    }
  };

  const dismissDownload = (id: string) => {
    setDownloads(prev => prev.filter(d => d.id !== id));
  };

  const clearCompleted = () => {
    setDownloads(prev => prev.filter(d => !['complete', 'error', 'cancelled'].includes(d.state)));
  };

  return { 
    downloads, 
    isSubmitting, 
    startDownload, 
    cancelDownload, 
    dismissDownload, 
    clearCompleted 
  };
}
