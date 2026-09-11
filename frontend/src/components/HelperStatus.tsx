import { HelperStatus as IHelperStatus } from '../types';
import { ShieldAlert } from 'lucide-react';

interface Props {
  status: IHelperStatus;
  onSetupClick: () => void;
  onPairClick: () => void;
}

export function HelperStatus({ status, onSetupClick, onPairClick }: Props) {
  if (status.connected && status.paired) {
    return (
      <div className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 text-sm">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
        </span>
        <span className="text-green-700 dark:text-green-400 font-medium">Local downloader connected</span>
        {status.version && <span className="text-green-600/70 dark:text-green-500/70 text-xs ml-2">v{status.version}</span>}
      </div>
    );
  }

  if (status.connected && !status.paired) {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between py-3 px-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 text-sm gap-3">
        <div className="flex items-center space-x-2 text-yellow-700 dark:text-yellow-400 font-medium">
          <ShieldAlert className="w-4 h-4" />
          <span>Helper detected but not paired</span>
        </div>
        <button 
          onClick={onPairClick}
          className="px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/40 hover:bg-yellow-200 dark:hover:bg-yellow-800/60 text-yellow-800 dark:text-yellow-300 rounded-lg font-semibold transition-colors text-xs"
        >
          Pair Now
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between py-3 px-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-sm gap-3">
      <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400 font-medium">
        <div className="w-3 h-3 rounded-full bg-gray-400 dark:bg-gray-600" />
        <span>Local downloader not detected</span>
      </div>
      <button 
        onClick={onSetupClick}
        className="text-insta-pink hover:text-insta-purple font-semibold transition-colors"
      >
        View Setup Guide
      </button>
    </div>
  );
}
