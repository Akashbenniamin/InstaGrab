import { useState } from 'react';
import { HistoryEntry } from '../types';
import { Clock, CheckCircle2, XCircle, Trash2, FolderOpen, AlertCircle } from 'lucide-react';
import { helperApi } from '../services/helperApi';

interface Props {
  history: HistoryEntry[];
  onClear: () => void;
}

export function DownloadHistory({ history, onClear }: Props) {
  const [viewError, setViewError] = useState<string | null>(null);

  const formatTime = (ts: number) => {
    try {
      const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
      const daysDifference = Math.round((ts - Date.now()) / (1000 * 60 * 60 * 24));
      
      if (daysDifference === 0) {
        const hoursDiff = Math.round((ts - Date.now()) / (1000 * 60 * 60));
        if (hoursDiff === 0) {
          const minDiff = Math.round((ts - Date.now()) / (1000 * 60));
          return rtf.format(minDiff, 'minute');
        }
        return rtf.format(hoursDiff, 'hour');
      }
      return rtf.format(daysDifference, 'day');
    } catch {
      return 'recently';
    }
  };

  const handleView = async (entry: HistoryEntry) => {
    setViewError(null);
    const opened = await helperApi.openFile(entry.filepath, entry.filename);
    if (!opened) {
      setViewError('Could not open file in Explorer. Ensure Desktop Engine is running.');
      setTimeout(() => setViewError(null), 4000);
    }
  };

  return (
    <div className="w-full rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden shadow-sm flex flex-col">
      {/* Header */}
      <div className="p-4 sm:px-5 sm:py-4 border-b border-[var(--border-color)] flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/30">
        <div className="flex items-center space-x-2.5 font-bold text-sm text-[var(--text-primary)]">
          <Clock className="w-4 h-4 text-insta-pink" />
          <span>Recent Downloads</span>
          <span className="bg-gray-200/70 dark:bg-gray-800 text-[11px] font-semibold py-0.5 px-2 rounded-full text-[var(--text-secondary)]">
            {history.length}
          </span>
        </div>
        {history.length > 0 && (
          <button 
            onClick={onClear}
            className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1 hover:underline cursor-pointer"
            title="Clear all history"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {viewError && (
        <div className="px-4 py-2 bg-red-500/10 text-red-500 text-[11px] flex items-center gap-1.5 border-b border-red-500/20">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{viewError}</span>
        </div>
      )}

      {/* Content */}
      {history.length === 0 ? (
        <div className="p-6 text-center text-xs text-[var(--text-secondary)] space-y-1">
          <p className="font-medium">No downloads yet</p>
          <p className="text-[11px] opacity-75">Your completed downloads will appear here with 1-click access to File Explorer.</p>
        </div>
      ) : (
        <div className="max-h-[460px] lg:max-h-[calc(100vh-280px)] overflow-y-auto divide-y divide-[var(--border-color)] scrollbar-thin">
          {history.map((entry) => (
            <div 
              key={entry.id} 
              className="p-3.5 sm:px-4 sm:py-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
            >
              {/* Left: Status icon & Title Link */}
              <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                {entry.success ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-[var(--text-primary)] hover:text-insta-pink hover:underline truncate block cursor-pointer transition-colors"
                    title={`Click to open source URL: ${entry.url}`}
                  >
                    {entry.filename || 'Untitled Download'}
                  </a>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    {formatTime(entry.timestamp)}
                  </p>
                </div>
              </div>

              {/* Right: View Button (opens in File Explorer) */}
              <button 
                onClick={() => handleView(entry)}
                className="inline-flex items-center gap-1 text-xs font-bold text-insta-pink hover:text-insta-purple hover:underline flex-shrink-0 px-2.5 py-1 rounded-lg hover:bg-insta-pink/10 transition-colors cursor-pointer"
                title="Open in Windows File Explorer"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>View</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
