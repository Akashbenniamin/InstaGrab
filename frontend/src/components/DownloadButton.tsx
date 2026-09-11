import { FormatType } from '../types';
import { Loader2, Music, Video } from 'lucide-react';

interface Props {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  formatType?: FormatType;
}

export function DownloadButton({ onClick, disabled, loading, formatType = 'video' }: Props) {
  const getButtonContent = () => {
    if (loading) {
      return (
        <>
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          <span>Starting Download...</span>
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

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        w-full py-4 px-6 rounded-2xl flex items-center justify-center text-lg font-semibold text-white transition-all transform active:scale-98 shadow-lg cursor-pointer
        ${disabled ? 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed opacity-70' : 'insta-gradient hover:opacity-95'}
      `}
    >
      {getButtonContent()}
    </button>
  );
}
