import { DownloadState, FormatType } from '../types';
import { Loader2, Check, Music, Video } from 'lucide-react';

interface Props {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  state: DownloadState;
  formatType?: FormatType;
}

export function DownloadButton({ onClick, disabled, loading, state, formatType = 'video' }: Props) {
  const getButtonContent = () => {
    if (state === 'complete') {
      return (
        <>
          <Check className="w-6 h-6 mr-2" />
          Downloaded ✓
        </>
      );
    }
    if (loading) {
      let text = 'Processing...';
      if (state === 'validating' || state === 'connecting') text = 'Connecting...';
      if (state === 'extracting') text = 'Extracting media...';
      if (state === 'downloading') text = 'Downloading...';
      if (state === 'processing') text = formatType === 'audio' ? 'Converting to MP3...' : 'Muxing MP4...';
      
      return (
        <>
          <Loader2 className="w-6 h-6 mr-2 animate-spin" />
          {text}
        </>
      );
    }
    return (
      <>
        {formatType === 'audio' ? (
          <Music className="w-5 h-5 mr-2" />
        ) : (
          <Video className="w-5 h-5 mr-2" />
        )}
        <span>{formatType === 'audio' ? 'Download Audio (MP3)' : 'Download Video (MP4)'}</span>
      </>
    );
  };

  const isComplete = state === 'complete';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading || isComplete}
      className={`
        w-full py-4 px-6 rounded-2xl flex items-center justify-center text-lg font-semibold text-white transition-all transform active:scale-98 shadow-lg cursor-pointer
        ${isComplete ? 'bg-green-500' : disabled ? 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed opacity-70' : 'insta-gradient hover:opacity-95'}
      `}
    >
      {getButtonContent()}
    </button>
  );
}
