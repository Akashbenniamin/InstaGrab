import { FormatType } from '../types';
import { Loader2, Music, Video, Image as ImageIcon, Layers, Sparkles, Bookmark } from 'lucide-react';

interface Props {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  formatType?: FormatType;
  mediaType?: string;
  carouselCount?: number;
}

export function DownloadButton({ onClick, disabled, loading, formatType = 'video', mediaType, carouselCount }: Props) {
  const getButtonContent = () => {
    if (loading) {
      return (
        <>
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          <span>Starting Download...</span>
        </>
      );
    }

    if (formatType === 'audio') {
      return (
        <>
          <Music className="w-5 h-5 mr-2" />
          <span>Download Audio (MP3)</span>
        </>
      );
    }

    if (mediaType === 'photo') {
      return (
        <>
          <ImageIcon className="w-5 h-5 mr-2" />
          <span>Download Photo</span>
        </>
      );
    }

    if (mediaType === 'carousel') {
      return (
        <>
          <Layers className="w-5 h-5 mr-2" />
          <span>Download All as .ZIP {carouselCount ? `(${carouselCount})` : ''}</span>
        </>
      );
    }

    if (mediaType === 'story') {
      return (
        <>
          <Sparkles className="w-5 h-5 mr-2" />
          <span>Download Story</span>
        </>
      );
    }

    if (mediaType === 'highlight') {
      return (
        <>
          <Bookmark className="w-5 h-5 mr-2" />
          <span>Download Highlight</span>
        </>
      );
    }

    if (mediaType === 'reel') {
      return (
        <>
          <Video className="w-5 h-5 mr-2" />
          <span>Download Reel (MP4)</span>
        </>
      );
    }

    return (
      <>
        <Video className="w-5 h-5 mr-2" />
        <span>Download Video (MP4)</span>
      </>
    );
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        background: disabled ? undefined : 'var(--btn-primary-bg)',
        color: disabled ? undefined : 'var(--btn-primary-text)',
        boxShadow: disabled ? undefined : 'var(--btn-primary-shadow)'
      }}
      className={`
        w-full py-4 px-6 rounded-2xl flex items-center justify-center text-lg font-semibold transition-all transform active:scale-98 cursor-pointer
        ${disabled ? 'bg-gray-300 text-gray-500 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed opacity-60' : 'hover:opacity-95 hover:brightness-105'}
      `}
    >
      {getButtonContent()}
    </button>
  );
}
