import React from 'react';
import { FormatType, VideoQuality, AudioQuality } from '../types';
import { Video, Music, Sparkles, Check } from 'lucide-react';

interface Props {
  formatType: FormatType;
  onFormatChange: (format: FormatType) => void;
  videoQuality: VideoQuality;
  onVideoQualityChange: (quality: VideoQuality) => void;
  audioQuality: AudioQuality;
  onAudioQualityChange: (quality: AudioQuality) => void;
  disabled?: boolean;
}

export const DownloadOptions: React.FC<Props> = ({
  formatType,
  onFormatChange,
  videoQuality,
  onVideoQualityChange,
  audioQuality,
  onAudioQualityChange,
  disabled = false,
}) => {
  const videoQualityOptions: { id: VideoQuality; label: string; sublabel: string; recommended?: boolean }[] = [
    { id: 'best', label: 'Highest Quality', sublabel: 'Auto (Best available)', recommended: true },
    { id: '1080p', label: '1080p', sublabel: 'Full HD' },
    { id: '720p', label: '720p', sublabel: 'HD' },
    { id: '480p', label: '480p', sublabel: 'Standard' },
    { id: '360p', label: '360p', sublabel: 'Compact' },
  ];

  const audioQualityOptions: { id: AudioQuality; label: string; sublabel: string; recommended?: boolean }[] = [
    { id: 'best', label: 'Highest (320 kbps)', sublabel: 'Studio Quality', recommended: true },
    { id: '192k', label: '192 kbps', sublabel: 'High Quality' },
    { id: '128k', label: '128 kbps', sublabel: 'Standard MP3' },
  ];

  return (
    <div className="space-y-4 pt-2">
      {/* Format Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold tracking-wider text-[var(--text-secondary)] uppercase">
          Format
        </label>
        <div className="grid grid-cols-2 gap-3 p-1 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)]">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onFormatChange('video')}
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
              formatType === 'video'
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Video className="w-4 h-4 text-insta-pink" />
            <span>MP4 Video</span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onFormatChange('audio')}
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
              formatType === 'audio'
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Music className="w-4 h-4 text-insta-purple" />
            <span>MP3 Audio</span>
          </button>
        </div>
      </div>

      {/* Quality Options */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold tracking-wider text-[var(--text-secondary)] uppercase">
            Quality
          </label>
          <span className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            {formatType === 'video' ? 'Best Quality Selected by default' : '320 kbps MP3 by default'}
          </span>
        </div>

        {formatType === 'video' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {videoQualityOptions.map((opt) => {
              const isSelected = videoQuality === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onVideoQualityChange(opt.id)}
                  className={`relative flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-insta-pink bg-pink-50/40 dark:bg-pink-950/20 text-[var(--text-primary)] shadow-sm'
                      : 'border-[var(--border-color)] bg-[var(--bg-main)] hover:border-gray-400 dark:hover:border-gray-600 text-[var(--text-secondary)]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
                      {opt.label}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-insta-pink" />}
                  </div>
                  <span className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    {opt.sublabel}
                  </span>
                  {opt.recommended && (
                    <span className="absolute -top-2 right-2 px-1.5 py-0.2 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-[9px] font-bold rounded-full shadow-xs">
                      AUTO
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {audioQualityOptions.map((opt) => {
              const isSelected = audioQuality === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onAudioQualityChange(opt.id)}
                  className={`relative flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-insta-purple bg-purple-50/40 dark:bg-purple-950/20 text-[var(--text-primary)] shadow-sm'
                      : 'border-[var(--border-color)] bg-[var(--bg-main)] hover:border-gray-400 dark:hover:border-gray-600 text-[var(--text-secondary)]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
                      {opt.label}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-insta-purple" />}
                  </div>
                  <span className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    {opt.sublabel}
                  </span>
                  {opt.recommended && (
                    <span className="absolute -top-2 right-2 px-1.5 py-0.2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-[9px] font-bold rounded-full shadow-xs">
                      BEST
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
