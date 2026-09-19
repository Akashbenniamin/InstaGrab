import { useState } from 'react';
import { HistoryEntry } from '../types';
import { Clock, Trash2, FolderOpen, AlertCircle, Download, Music, Video, Image as ImageIcon, Archive } from 'lucide-react';
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

  const getMediaBadge = (entry: HistoryEntry) => {
    const name = (entry.filename || '').toLowerCase();
    if (entry.isAudio || name.endsWith('.mp3') || name.endsWith('.m4a') || name.includes('[audio]')) {
      return { label: 'MP3', icon: <Music className="w-3 h-3 text-purple-500" />, color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' };
    }
    if (entry.isZip || name.endsWith('.zip')) {
      return { label: 'ZIP', icon: <Archive className="w-3 h-3 text-amber-500" />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' };
    }
    if (entry.isImage || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
      return { label: 'IMG', icon: <ImageIcon className="w-3 h-3 text-emerald-500" />, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' };
    }
    return { label: 'MP4', icon: <Video className="w-3 h-3 text-blue-500" />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' };
  };

  return (
    <div className="w-full rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden shadow-sm flex flex-col">
      {/* Header */}
      <div className="p-4 sm:px-5 sm:py-4 border-b border-[var(--border-color)] flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/30">
        <div className="flex items-center space-x-2.5 font-bold text-sm text-[var(--text-primary)]">
          <Clock className="w-4 h-4" style={{ color: 'var(--accent-color)' }} />
          <span>Recent Downloads</span>
          <span 
            style={{
              background: 'var(--badge-bg)',
              color: 'var(--badge-text)'
            }}
            className="text-[11px] font-bold py-0.5 px-2 rounded-full"
          >
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
          {history.map((entry) => {
            const media = getMediaBadge(entry);
            return (
              <div 
                key={entry.id} 
                className="p-3.5 sm:px-4 sm:py-3 flex items-center justify-between gap-3 hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
              >
                {/* Left: Format badge & Title Link */}
                <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${media.color}`} title={media.label}>
                    {media.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    {entry.url ? (
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-[var(--text-primary)] hover:underline truncate block cursor-pointer transition-colors"
                        title={`Click to open source URL: ${entry.url}`}
                      >
                        {entry.filename || 'Untitled Download'}
                      </a>
                    ) : (
                      <span 
                        className="text-xs font-semibold text-[var(--text-primary)] truncate block"
                        title={entry.filename}
                      >
                        {entry.filename || 'Untitled Download'}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] mt-0.5">
                      <span>{formatTime(entry.timestamp)}</span>
                      {entry.sizeFormatted && (
                        <>
                          <span>•</span>
                          <span className="font-medium">{entry.sizeFormatted}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions (Browser Download + File Explorer) */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {entry.success && entry.filename && (
                    <button
                      type="button"
                      onClick={() => helperApi.triggerBrowserDownload(entry.filename)}
                      style={{ color: 'var(--accent-color)' }}
                      className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      title="Download file to browser"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button 
                    type="button"
                    onClick={() => handleView(entry)}
                    style={{ color: 'var(--accent-color)' }}
                    className="inline-flex items-center gap-1 text-xs font-bold hover:underline px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    title="Open in Windows File Explorer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>View</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

