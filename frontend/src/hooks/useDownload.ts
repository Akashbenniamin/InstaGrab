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
  const isPollingRef = useRef(false);
  const downloadsRef = useRef<DownloadProgress[]>([]);
  downloadsRef.current = downloads;
  const processedTerminalJobsRef = useRef<Set<string>>(new Set());

  const pollActiveDownloads = useCallback(async () => {
    if (isPollingRef.current) return;

    // Find active downloads that need polling from ref (pure read, outside setState)
    const active = downloadsRef.current.filter(d => 
      !['complete', 'error', 'cancelled'].includes(d.state) && !d.id.startsWith('temp_')
    );

    if (active.length === 0) return;

    isPollingRef.current = true;
    try {
      for (const job of active) {
        try {
          const status = await helperApi.getDownloadStatus(job.id);
          if (!status || !status.state) continue;
          const originalUrl = urlMapRef.current.get(job.id) || '';

          // 1. Update job in state
          setDownloads(prevList => {
            return prevList.map(item => {
              if (item.id !== job.id) return item;

              return {
                ...item,
                state: status.state,
                progress: typeof status.progress === 'number' && !isNaN(status.progress) ? status.progress : item.progress,
                speed: status.speed || item.speed,
                eta: status.eta || item.eta,
                filename: status.filename || item.filename,
                filepath: status.filepath || item.filepath,
                error: status.error,
                errorType: status.errorType as any
              };
            });
          });

          // 2. Handle completion or error ONCE per job ID
          if (['complete', 'error', 'cancelled'].includes(status.state) && !processedTerminalJobsRef.current.has(job.id)) {
            processedTerminalJobsRef.current.add(job.id);

            if (status.state === 'complete' && (status.filename || (status.files && status.files.length > 0))) {
              const displayFilename = status.filename || (status.files ? status.files[0] : 'Downloaded Media');
              try {
                addEntry({
                  id: job.id,
                  url: originalUrl,
                  filename: displayFilename,
                  filepath: status.filepath,
                  timestamp: Date.now(),
                  success: true
                });
              } catch {}

              // Stream file(s) directly to browser download manager safely
              if (status.files && status.files.length > 1) {
                status.files.forEach((fname, idx) => {
                  setTimeout(() => {
                    helperApi.triggerBrowserDownload(fname);
                  }, idx * 400);
                });
              } else if (status.filename) {
                helperApi.triggerBrowserDownload(status.filename);
              }

              // Automatically remove finished task from bottom queue after 4 seconds
              setTimeout(() => {
                setDownloads(current => current.filter(d => d.id !== job.id));
              }, 4000);
            } else if (status.state === 'error') {
              try {
                addEntry({
                  id: job.id,
                  url: originalUrl,
                  filename: status.filename || 'Failed Download',
                  timestamp: Date.now(),
                  success: false
                });
              } catch {}
            }
          }
        } catch (err) {
          console.warn(`Polling error for ${job.id}:`, err);
        }
      }
    } finally {
      isPollingRef.current = false;
    }
  }, []);

  useEffect(() => {
    pollingRef.current = setInterval(pollActiveDownloads, 1500);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pollActiveDownloads]);

  const startDownload = async (
    url: string, 
    formatType: string = 'video', 
    quality: string = 'best',
    options?: { itemIndex?: number; asZip?: boolean }
  ) => {
    setIsSubmitting(true);
    const tempId = 'temp_' + Date.now();
    
    // Add placeholder in active downloads
    const newJob: DownloadProgress = {
      id: tempId,
      state: 'validating',
      progress: 0,
      filename: options?.asZip 
        ? 'Packaging carousel as ZIP...' 
        : (options?.itemIndex !== undefined 
          ? `Fetching slide #${options.itemIndex + 1}...` 
          : 'Initializing download...')
    };
    
    setDownloads(prev => [newJob, ...prev]);

    try {
      const downloadId = await helperApi.startDownload(url, formatType, quality, options);
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
