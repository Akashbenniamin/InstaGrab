import { DownloadProgress } from '../types';
import { AlertCircle, CheckCircle2, RefreshCw, X, FolderOpen, Loader2 } from 'lucide-react';
import { helperApi } from '../services/helperApi';

interface Props {
  downloads: DownloadProgress[];
  onCancel?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onClearCompleted?: () => void;
  onRetry?: (item: DownloadProgress) => void;
}

export function ProgressDisplay({ downloads, onCancel, onDismiss, onClearCompleted, onRetry }: Props) {
  if (!downloads || downloads.length === 0) return null;

  const handleOpenFile = async (filepath?: string, filename?: string) => {
    await helperApi.openFile(filepath, filename);
  };

  const formatSpeed = (speed?: any) => {
    if (!speed) return '';
    const str = typeof speed === 'string' ? speed : String(speed);
    return str
      .replace(/MiB\/s/gi, 'MB/s')
      .replace(/KiB\/s/gi, 'KB/s')
      .replace(/GiB\/s/gi, 'GB/s')
      .replace(/B\/s/gi, 'B/s');
  };

  const activeCount = downloads.filter(d => !['complete', 'error', 'cancelled'].includes(d.state)).length;
  const completedCount = downloads.length - activeCount;

  return (
    <div className="w-full space-y-4">
      {downloads.length > 1 && (
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] px-1">
          <span>Active Downloads ({activeCount} running{completedCount > 0 ? `, ${completedCount} finished` : ''})</span>
          {completedCount > 0 && onClearCompleted && (
            <button 
              onClick={onClearCompleted}
              className="text-insta-pink hover:underline cursor-pointer"
            >
              Clear Finished
            </button>
          )}
        </div>
      )}

      {downloads.map((item) => {
        const isComplete = item.state === 'complete';
        const isFailed = item.state === 'error';
        const isCancelled = item.state === 'cancelled';
        const isActive = !isComplete && !isFailed && !isCancelled;
        const rawProgress = typeof item.progress === 'number' && !isNaN(item.progress) ? item.progress : 0;
        const displayProgress = Math.max(0, Math.min(100, rawProgress));

        if (isFailed || isCancelled) {
          return (
            <div 
              key={item.id} 
              className="w-full p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 shadow-xs relative"
            >
              {onDismiss && (
                <button 
                  onClick={() => onDismiss(item.id)}
                  className="absolute top-3 right-3 p-1 rounded-md text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 pr-6">
                  <h4 className="font-semibold text-sm text-red-700 dark:text-red-400">
                    {isCancelled ? 'Download Cancelled' : 'Download Failed'}
                  </h4>
                  <p className="text-xs text-red-600 dark:text-red-300 mt-0.5 break-words">
                    {item.error || (isCancelled ? 'Cancelled by user' : 'An error occurred during download')}
                  </p>
                  {item.filename && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1 truncate">
                      File: {item.filename}
                    </p>
                  )}
                  {onRetry && !isCancelled && (
                    <button 
                      onClick={() => onRetry(item)} 
                      className="mt-2 inline-flex items-center text-xs text-red-600 dark:text-red-400 hover:underline font-semibold"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Try Again
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        }

        return (
          <div 
            key={item.id} 
            className="w-full p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs space-y-3 relative"
          >
            {/* Top row: State & percentage & dismiss/cancel */}
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                  isComplete ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                }`}>
                  {isActive && <Loader2 className="w-2.5 h-2.5 animate-spin text-purple-600 dark:text-purple-400" />}
                  {item.state === 'extracting' ? 'Extracting' : item.state === 'processing' ? 'Processing' : item.state}
                </span>
                {!isFailed && !isCancelled && (
                  <span className="font-bold text-[var(--text-primary)]">
                    {isComplete ? '100%' : `${Math.round(displayProgress)}%`}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isActive && onCancel && (
                  <button 
                    onClick={() => onCancel(item.id)}
                    className="text-xs text-red-500 hover:underline cursor-pointer font-medium"
                  >
                    Cancel
                  </button>
                )}
                {isComplete && onDismiss && (
                  <button 
                    onClick={() => onDismiss(item.id)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar with Continuous Active Shimmer Animation */}
            <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden relative shadow-inner">
              <div 
                className={`h-full ${isComplete ? 'bg-green-500' : 'insta-gradient'} transition-all duration-300 ease-out relative`}
                style={{ 
                  width: `${isComplete ? 100 : Math.max(5, displayProgress)}%`,
                  ...(isActive ? {
                    backgroundSize: '200% 100%',
                    animation: 'indeterminate 2s infinite linear',
                  } : {})
                }}
              >
                {isActive && (
                  <div 
                    className="absolute inset-0 opacity-45 pointer-events-none"
                    style={{
                      backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.6s infinite linear'
                    }}
                  />
                )}
              </div>
            </div>

            {/* Speed & ETA / Stage Status */}
            <div className="flex justify-between text-[11px] text-[var(--text-secondary)]">
              <div>
                {item.speed ? (
                  <span>{formatSpeed(item.speed)}</span>
                ) : item.state === 'extracting' ? (
                  <span>Extracting media metadata...</span>
                ) : item.state === 'processing' ? (
                  <span>Converting &amp; finalizing media...</span>
                ) : null}
              </div>
              <div>{item.eta && <span>ETA: {item.eta}</span>}</div>
            </div>

            {/* Filename & Saved path */}
            {item.filename && (
              <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5 min-w-0">
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-insta-pink border-t-transparent animate-spin flex-shrink-0" />
                  )}
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate" title={item.filename}>
                    {item.filename}
                  </p>
                </div>

                {isComplete && (item.filepath || item.filename) && (
                  <button
                    onClick={() => handleOpenFile(item.filepath, item.filename)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-insta-pink hover:underline flex-shrink-0 cursor-pointer"
                    title="Open in File Explorer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>View in Folder</span>
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes indeterminate {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}
