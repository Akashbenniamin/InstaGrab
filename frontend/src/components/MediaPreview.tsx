import React, { useState, useEffect } from 'react';
import { Play, Image as ImageIcon, Video, Loader2, Layers, Bookmark, Sparkles, Film } from 'lucide-react';
import { helperApi } from '../services/helperApi';
import { validateMediaUrl } from '../services/urlValidator';

interface Props {
  url: string;
  onMediaDetected?: (info: { mediaType?: string; contentType?: string; title?: string }) => void;
}

export const MediaPreview: React.FC<Props> = ({ url, onMediaDetected }) => {
  const [info, setInfo] = useState<{
    title?: string;
    thumbnail?: string;
    duration?: number;
    uploader?: string;
    platform?: string;
    playable_url?: string | null;
    media_type?: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ytId, setYtId] = useState<string | null>(null);
  const [detectedContentType, setDetectedContentType] = useState<string | undefined>(undefined);

  useEffect(() => {
    setIsPlaying(false);
    const trimmed = url.trim();
    if (!trimmed) {
      setInfo(null);
      setYtId(null);
      setDetectedContentType(undefined);
      return;
    }

    const val = validateMediaUrl(trimmed);
    if (!val.valid) {
      setInfo(null);
      setYtId(null);
      setDetectedContentType(undefined);
      return;
    }

    setDetectedContentType(val.contentType);
    if (onMediaDetected) {
      onMediaDetected({
        contentType: val.contentType,
        mediaType: val.contentType === 'story' ? 'story' : (val.contentType === 'highlight' ? 'highlight' : (val.contentType === 'reel' ? 'reel' : undefined))
      });
    }

    // 1. YouTube instant client-side thumbnail & ID extraction
    if (val.platform === 'youtube') {
      const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
      const id = match ? match[1] : null;
      setYtId(id);
      if (id) {
        setInfo({
          title: val.contentType === 'shorts' ? 'YouTube Short' : 'YouTube Video',
          thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
          platform: 'youtube',
          media_type: val.contentType === 'shorts' ? 'shorts' : 'video'
        });
      }
    } else {
      setYtId(null);
      setInfo(null);
    }

    // 2. Fetch full metadata from local helper
    let isCancelled = false;
    setLoading(true);

    helperApi.getMediaInfo(trimmed).then(res => {
      if (!isCancelled && res && !res.error) {
        const resolvedMediaType = res.media_type || (val.contentType === 'story' ? 'story' : (val.contentType === 'highlight' ? 'highlight' : (val.contentType === 'reel' ? 'reel' : 'video')));
        setInfo(prev => ({
          ...prev,
          title: res.title || prev?.title || 'Media Post',
          thumbnail: res.thumbnail || prev?.thumbnail,
          duration: res.duration,
          uploader: res.uploader,
          platform: res.platform || val.platform,
          playable_url: res.playable_url,
          media_type: resolvedMediaType
        }));

        if (onMediaDetected) {
          onMediaDetected({
            mediaType: resolvedMediaType,
            contentType: val.contentType,
            title: res.title
          });
        }
      }
    }).finally(() => {
      if (!isCancelled) setLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [url]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getMediaBadge = () => {
    const type = info?.media_type || detectedContentType;
    if (type === 'story') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-xs">
          <Sparkles className="w-2.5 h-2.5" /> Story
        </span>
      );
    }
    if (type === 'highlight') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-xs">
          <Bookmark className="w-2.5 h-2.5" /> Highlight
        </span>
      );
    }
    if (type === 'reel') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-fuchsia-600 to-rose-600 text-white shadow-xs">
          <Film className="w-2.5 h-2.5" /> Reel
        </span>
      );
    }
    if (type === 'carousel') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs">
          <Layers className="w-2.5 h-2.5" /> Carousel / Album
        </span>
      );
    }
    if (type === 'photo') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs">
          <ImageIcon className="w-2.5 h-2.5" /> Photo
        </span>
      );
    }
    if (type === 'shorts') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white shadow-xs">
          <Film className="w-2.5 h-2.5" /> Shorts
        </span>
      );
    }
    if (info?.platform === 'pinterest') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-700 text-white shadow-xs">
          Pin
        </span>
      );
    }
    return null;
  };

  const isPhoto = info?.media_type === 'photo';

  // Blank placeholder state
  if (!url.trim() || (!info?.thumbnail && !loading)) {
    return (
      <div className="h-full min-h-[160px] rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-main)]/50 p-4 flex flex-col items-center justify-center text-center">
        <div className="w-10 h-10 rounded-2xl bg-[var(--badge-bg)] flex items-center justify-center mb-2 shadow-2xs">
          <Video className="w-5 h-5" style={{ color: 'var(--accent-color)' }} />
        </div>
        <p className="text-xs font-bold text-[var(--text-primary)]">Live Media Preview</p>
        <p className="text-[11px] text-[var(--text-secondary)] mt-1 max-w-[220px]">
          Paste any Instagram Reel, Photo, Story, Highlight, YouTube Video, or Pinterest Pin
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col rounded-2xl border border-[var(--border-color)] bg-[var(--bg-main)] overflow-hidden shadow-2xs">
      {/* Video / Thumbnail Container */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
        {isPlaying ? (
          ytId ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1`}
              title={info?.title || 'Video Player'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          ) : info?.playable_url ? (
            <video
              src={info.playable_url}
              controls
              autoPlay
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-white text-xs">Playback not supported for this source</div>
          )
        ) : (
          <>
            {info?.thumbnail ? (
              <img
                src={info.thumbnail}
                alt={info.title || 'Media thumbnail'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  if (ytId && e.currentTarget.src.includes('maxresdefault')) {
                    e.currentTarget.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
                  }
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-500">
                <ImageIcon className="w-8 h-8 opacity-40" />
              </div>
            )}

            {/* Play Button Overlay (Only when video stream is playable and NOT a static photo) */}
            {!isPhoto && (ytId || info?.playable_url) && (
              <button
                type="button"
                onClick={() => setIsPlaying(true)}
                className="absolute inset-0 m-auto w-11 h-11 rounded-full flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 cursor-pointer shadow-lg backdrop-blur-xs"
                style={{
                  background: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-text)'
                }}
                title="Play Video Preview"
              >
                <Play className="w-5 h-5 ml-0.5 fill-current" />
              </button>
            )}

            {/* Auto-recognized Media Type Badge */}
            <div className="absolute top-2 right-2">
              {getMediaBadge()}
            </div>

            {/* Duration Badge */}
            {info?.duration ? (
              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/80 text-white text-[10px] font-mono font-bold tracking-tight">
                {formatDuration(info.duration)}
              </span>
            ) : null}

            {loading && (
              <div className="absolute top-2 left-2 p-1 rounded-md bg-black/60 backdrop-blur-xs text-white">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Info strip below media */}
      <div className="p-3 flex flex-col justify-between flex-1 gap-1.5">
        <div>
          <h4 className="text-xs font-bold text-[var(--text-primary)] line-clamp-1 leading-snug">
            {info?.title || 'Processing media link...'}
          </h4>
          {info?.uploader && (
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-1">
              {info.uploader}
            </p>
          )}
        </div>

        {isPlaying && (
          <button
            type="button"
            onClick={() => setIsPlaying(false)}
            className="self-start text-[10px] font-bold underline cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            ← Close Player
          </button>
        )}
      </div>
    </div>
  );
};
