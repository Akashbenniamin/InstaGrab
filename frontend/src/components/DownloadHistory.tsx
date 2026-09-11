import { HistoryEntry } from '../types';
import { Clock, CheckCircle2, XCircle, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface Props {
  history: HistoryEntry[];
  onClear: () => void;
}

export function DownloadHistory({ history, onClear }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  
  if (history.length === 0) return null;

  const displayHistory = history.slice(0, 10);
  
  const formatTime = (ts: number) => {
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
  };

  return (
    <div className="w-full mt-8 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center space-x-2 font-semibold">
          <Clock className="w-5 h-5 text-gray-500" />
          <span>Recent Downloads</span>
          <span className="bg-gray-100 dark:bg-gray-800 text-xs py-0.5 px-2 rounded-full">{history.length}</span>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {isOpen && (
        <div className="border-t border-[var(--border-color)]">
          <ul className="divide-y divide-[var(--border-color)]">
            {displayHistory.map((entry) => (
              <li key={entry.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                <div className="flex items-center space-x-3 overflow-hidden">
                  {entry.success ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" title={entry.filename}>
                      {entry.filename}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {formatTime(entry.timestamp)}
                    </p>
                  </div>
                </div>
                <a 
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-insta-pink hover:underline ml-4 flex-shrink-0"
                >
                  View Original
                </a>
              </li>
            ))}
          </ul>
          
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-t border-[var(--border-color)] flex justify-center">
            <button 
              onClick={onClear}
              className="flex items-center text-sm text-red-500 hover:text-red-600 font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear History
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
