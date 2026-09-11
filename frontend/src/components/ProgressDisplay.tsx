import { DownloadProgress } from '../types';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

interface Props {
  progress: DownloadProgress | null;
  onRetry?: () => void;
}



export function ProgressDisplay({ progress, onRetry }: Props) {
  if (!progress) return null;

  if (progress.state === 'error' || progress.state === 'cancelled') {
    return (
      <div className="w-full p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex flex-col items-center justify-center text-center space-y-2">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <h3 className="font-semibold text-red-700 dark:text-red-400">
          {progress.state === 'cancelled' ? 'Download Cancelled' : 'Download Failed'}
        </h3>
        <p className="text-sm text-red-600 dark:text-red-300">{progress.error || 'An unknown error occurred'}</p>
        {onRetry && progress.state !== 'cancelled' && (
          <button onClick={onRetry} className="mt-2 flex items-center text-sm text-red-600 dark:text-red-400 hover:underline font-medium">
            <RefreshCw className="w-4 h-4 mr-1" /> Try Again
          </button>
        )}
      </div>
    );
  }

  const isComplete = progress.state === 'complete';
  const displayProgress = progress.progress ?? 0;
  
  return (
    <div className="w-full p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm space-y-4">
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium text-sm text-[var(--text-secondary)] uppercase tracking-wider">
          {progress.state}
        </span>
        {progress.state === 'downloading' && (
          <span className="font-semibold">{Math.round(displayProgress)}%</span>
        )}
      </div>

      <div className="w-full h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden relative">
        <div 
          className={`h-full ${isComplete ? 'bg-green-500' : 'insta-gradient'} transition-all duration-300 ease-out`}
          style={{ 
            width: `${isComplete ? 100 : Math.max(5, displayProgress)}%`,
            ...(progress.state !== 'downloading' && !isComplete ? {
              animation: 'indeterminate 2s infinite linear',
              backgroundSize: '200% 100%'
            } : {})
          }}
        />
      </div>

      <div className="flex justify-between text-xs text-[var(--text-secondary)] h-4">
        <div>
          {progress.speed && <span>{progress.speed}</span>}
        </div>
        <div>
          {progress.eta && <span>ETA: {progress.eta}</span>}
        </div>
      </div>

      {progress.filename && (
        <div className="mt-4 pt-4 border-t border-[var(--border-color)] flex items-start space-x-3">
          <div className="mt-0.5">
            {isComplete ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-insta-pink border-t-transparent animate-spin" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" title={progress.filename}>
              {progress.filename}
            </p>
            {isComplete && progress.filepath && (
              <p className="text-xs text-[var(--text-secondary)] truncate mt-1" title={progress.filepath}>
                Saved to: {progress.filepath}
              </p>
            )}
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes indeterminate {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
