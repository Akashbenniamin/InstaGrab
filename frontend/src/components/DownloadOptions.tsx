import React from 'react';
import { FormatType, VideoQuality, AudioQuality } from '../types';
import { Video, Music, Check } from 'lucide-react';

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
    <div className="space-y-3">
      {/* Format Selector (Clean, No redundant label) */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)]">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onFormatChange('video')}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            formatType === 'video'
              ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs border border-[var(--border-color)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Video 
            className="w-4 h-4 transition-colors" 
            style={{ color: formatType === 'video' ? 'var(--accent-color)' : 'currentColor' }} 
          />
          <span>MP4 Video</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onFormatChange('audio')}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            formatType === 'audio'
              ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs border border-[var(--border-color)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Music 
            className="w-4 h-4 transition-colors" 
            style={{ color: formatType === 'audio' ? 'var(--accent-color)' : 'currentColor' }} 
          />
          <span>MP3 Audio</span>
        </button>
      </div>

      {/* Quality Options (No redundant label or default quality text) */}
      <div>
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
                  style={isSelected ? {
                    borderColor: 'var(--accent-color)',
                    background: 'var(--badge-bg)'
                  } : undefined}
                  className={`relative flex flex-col items-start p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'text-[var(--text-primary)] shadow-xs font-semibold'
                      : 'border-[var(--border-color)] bg-[var(--bg-main)] hover:border-gray-400 dark:hover:border-gray-600 text-[var(--text-secondary)]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
                      {opt.label}
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5" style={{ color: 'var(--accent-color)' }} />
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    {opt.sublabel}
                  </span>
                  {opt.recommended && (
                    <span 
                      style={{
                        background: 'var(--btn-primary-bg)',
                        color: 'var(--btn-primary-text)'
                      }}
                      className="absolute -top-2 right-2 px-1.5 py-0.2 text-[9px] font-bold rounded-full shadow-xs uppercase"
                    >
                      Auto
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
                  style={isSelected ? {
                    borderColor: 'var(--accent-color)',
                    background: 'var(--badge-bg)'
                  } : undefined}
                  className={`relative flex flex-col items-start p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'text-[var(--text-primary)] shadow-xs font-semibold'
                      : 'border-[var(--border-color)] bg-[var(--bg-main)] hover:border-gray-400 dark:hover:border-gray-600 text-[var(--text-secondary)]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
                      {opt.label}
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5" style={{ color: 'var(--accent-color)' }} />
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    {opt.sublabel}
                  </span>
                  {opt.recommended && (
                    <span 
                      style={{
                        background: 'var(--btn-primary-bg)',
                        color: 'var(--btn-primary-text)'
                      }}
                      className="absolute -top-2 right-2 px-1.5 py-0.2 text-[9px] font-bold rounded-full shadow-xs uppercase"
                    >
                      Best
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
