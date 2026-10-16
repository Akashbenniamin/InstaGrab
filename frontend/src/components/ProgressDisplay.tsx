import { DownloadProgress } from '../types';
import { AlertCircle, CheckCircle2, RefreshCw, X, FolderOpen, Loader2, Lock, Clock, WifiOff } from 'lucide-react';
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
          const isRateLimited = item.errorType === 'rate_limited' || 
            item.error?.toLowerCase().includes('rate-limit') || 
            item.error?.toLowerCase().includes('rate limit');

          const isPrivate = !isRateLimited && (
            item.errorType === 'private_content' || 
            item.error?.toLowerCase().includes('private') || 
            item.error?.toLowerCase().includes('age-restricted') ||
            (item.error?.toLowerCase().includes('login') && !item.error?.toLowerCase().includes('rate-limit'))
          );

          const isNetworkError = !isRateLimited && !isPrivate && (
            item.errorType === 'network' ||
            item.error?.toLowerCase().includes('failed to resolve') ||
            item.error?.toLowerCase().includes('getaddrinfo failed') ||
            item.error?.toLowerCase().includes('transporterror') ||
            item.error?.toLowerCase().includes('connection') ||
            item.error?.toLowerCase().includes('timed out') ||
            item.error?.toLowerCase().includes('network')
          );

          const isWarning = isRateLimited || isPrivate || isNetworkError;

          return (
            <div 
              key={item.id} 
              className={`w-full p-4 rounded-2xl shadow-xs relative ${
                isWarning
                  ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60'
                  : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60'
              }`}
            >
              {onDismiss && (
                <button 
                  onClick={() => onDismiss(item.id)}
                  className={`absolute top-3 right-3 p-1 rounded-md transition-colors ${
                    isWarning
                      ? 'text-amber-400 hover:text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                      : 'text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40'
                  }`}
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <div className="flex items-start gap-3">
                {isRateLimited ? (
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                ) : isPrivate ? (
                  <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                ) : isNetworkError ? (
                  <WifiOff className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0 pr-6">
                  <h4 className={`font-semibold text-sm ${
                    isWarning 
                      ? 'text-amber-800 dark:text-amber-300' 
                      : (isCancelled ? 'text-gray-700 dark:text-gray-300' : 'text-red-700 dark:text-red-400')
                  }`}>
                    {isCancelled 
                      ? 'Download Cancelled' 
                      : (isRateLimited 
                          ? 'Instagram Anonymous Rate-Limit (Public Post)' 
                          : (isPrivate 
                              ? 'Private or Follower-Restricted Post' 
                              : (isNetworkError ? 'Network Connection Glitch' : 'Download Failed')))}
                  </h4>
                  <p className={`text-xs mt-1 leading-relaxed ${
                    isWarning ? 'text-amber-700 dark:text-amber-300/90' : 'text-red-600 dark:text-red-300'
                  } break-words`}>
                    {item.error || (isCancelled ? 'Cancelled by user' : 'An error occurred during download')}
                  </p>
                  {isNetworkError && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-amber-100/60 dark:bg-amber-900/40 border border-amber-200/80 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-200 space-y-1">
                      <p className="font-semibold">💡 DNS or connection glitch detected:</p>
                      <p>Your network temporarily lost connection to the media server or DNS timed out. Click <strong>Try Again</strong> below to resume download.</p>
                    </div>
                  )}
                  {isRateLimited && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-amber-100/60 dark:bg-amber-900/40 border border-amber-200/80 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-200 space-y-1">
                      <p className="font-semibold">💡 This post is public! How to download it right now:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>Instagram temporarily throttled anonymous scraping requests from your network IP.</li>
                        <li>Open the post on Instagram in your browser and click the <strong>InstaGrab 1-Click Download button</strong> directly on the post — the video stream is already loaded in your browser and downloads instantly!</li>
                        <li>Alternatively, wait a couple of minutes for Instagram's anonymous query cooldown to reset.</li>
                      </ul>
                    </div>
                  )}
                  {isPrivate && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-amber-100/60 dark:bg-amber-900/40 border border-amber-200/80 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-200 space-y-1">
                      <p className="font-semibold">💡 How to download private or restricted posts:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>Make sure your account follows this user and has permission to view this post on Instagram.</li>
                        <li>Use the <strong>InstaGrab Chrome Extension</strong> while viewing the post in your browser to download directly.</li>
                      </ul>
                    </div>
                  )}
                  {item.filename && !isWarning && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1 truncate">
                      File: {item.filename}
                    </p>
                  )}
                  {onRetry && !isCancelled && (
                    <button 
                      onClick={() => onRetry(item)} 
                      className={`mt-2.5 inline-flex items-center text-xs hover:underline font-semibold ${
                        isWarning ? 'text-amber-700 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                      }`}
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
