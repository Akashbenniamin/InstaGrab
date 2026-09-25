import React, { useState, useEffect } from 'react';
import { Play, Image as ImageIcon, Video, Loader2, Layers, Bookmark, Sparkles, Film, ChevronLeft, ChevronRight, Music } from 'lucide-react';
import { helperApi } from '../services/helperApi';
import { validateMediaUrl } from '../services/urlValidator';
import { CarouselMediaItem } from '../types';

interface Props {
  url: string;
  onMediaDetected?: (info: { 
    mediaType?: string; 
    contentType?: string; 
    title?: string;
    carouselMedia?: CarouselMediaItem[];
    itemCount?: number;
  }) => void;
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
    carousel_media?: CarouselMediaItem[];
    item_count?: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ytId, setYtId] = useState<string | null>(null);
  const [detectedContentType, setDetectedContentType] = useState<string | undefined>(undefined);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    setIsPlaying(false);
    setActiveSlide(0);
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
        mediaType: val.contentType === 'story' ? 'story' : (val.contentType === 'highlight' ? 'highlight' : (val.contentType === 'reel' ? 'reel' : (val.contentType === 'audio' ? 'audio' : undefined)))
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
    } else if (val.platform === 'envato') {
      setYtId(null);
      setInfo({
        title: 'Envato Audio / SFX Track',
        platform: 'envato',
        media_type: 'audio'
      });
    } else {
      setYtId(null);
      setInfo(null);
    }

    // 2. Fetch full metadata from local helper
    let isCancelled = false;
    setLoading(true);

    helperApi.getMediaInfo(trimmed).then(res => {
      if (!isCancelled && res && !res.error) {
        const resolvedMediaType = res.media_type || (val.contentType === 'story' ? 'story' : (val.contentType === 'highlight' ? 'highlight' : (val.contentType === 'reel' ? 'reel' : (val.contentType === 'audio' ? 'audio' : 'video'))));
        setActiveSlide(0);
        setInfo(prev => ({
          ...prev,
          title: res.title || prev?.title || 'Media Post',
          thumbnail: res.thumbnail || prev?.thumbnail,
          duration: res.duration,
          uploader: res.uploader,
          platform: res.platform || val.platform,
          playable_url: res.playable_url,
          media_type: resolvedMediaType,
          carousel_media: res.carousel_media,
          item_count: res.item_count
        }));

        if (onMediaDetected) {
          onMediaDetected({
            mediaType: resolvedMediaType,
            contentType: val.contentType,
            title: res.title,
            carouselMedia: res.carousel_media,
            itemCount: res.item_count
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

  const formatDuration = (seconds?: any) => {
    const num = Number(seconds);
    if (!seconds || isNaN(num) || num <= 0) return '';
    const mins = Math.floor(num / 60);
    const secs = Math.floor(num % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getMediaBadge = () => {
    const type = info?.media_type || detectedContentType;
    if (type === 'audio' || type === 'sfx' || info?.platform === 'envato') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-emerald-600 to-lime-600 text-white shadow-xs">
          <Music className="w-2.5 h-2.5" /> Envato Audio
        </span>
      );
    }
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

  const hasCarousel = Boolean(info?.carousel_media && Array.isArray(info.carousel_media) && info.carousel_media.length > 1);
  const safeSlideIndex = hasCarousel ? Math.max(0, Math.min(activeSlide, info!.carousel_media!.length - 1)) : 0;
  const currentSlideItem = hasCarousel ? info!.carousel_media![safeSlideIndex] : null;
  const displayThumbnail = currentSlideItem?.thumbnail || info?.thumbnail;
  const isPhoto = currentSlideItem ? (currentSlideItem.media_type === 'photo') : (info?.media_type === 'photo');
  const isAudio = info?.media_type === 'audio' || info?.platform === 'envato';

  // Blank placeholder state
  if (!url.trim() || (!info?.thumbnail && !info?.playable_url && !isAudio && !loading)) {
    return (
      <div className="h-full min-h-[160px] rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-main)]/50 p-4 flex flex-col items-center justify-center text-center">
        <div className="w-10 h-10 rounded-2xl bg-[var(--badge-bg)] flex items-center justify-center mb-2 shadow-2xs">
          <Video className="w-5 h-5" style={{ color: 'var(--accent-color)' }} />
        </div>
        <p className="text-xs font-bold text-[var(--text-primary)]">Live Media Preview</p>
        <p className="text-[11px] text-[var(--text-secondary)] mt-1 max-w-[220px]">
          Paste any Instagram, YouTube, Pinterest, or Envato Audio / SFX link
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col rounded-2xl border border-[var(--border-color)] bg-[var(--bg-main)] overflow-hidden shadow-2xs">
      {/* Video / Audio / Thumbnail Container */}
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
          ) : isAudio && info?.playable_url ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-4 bg-gradient-to-br from-gray-900 via-emerald-950/60 to-gray-900">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-pulse">
                <Music className="w-5 h-5" />
              </div>
              <audio
                src={info.playable_url}
                controls
                autoPlay
                className="w-full max-w-[260px] h-9"
              />
            </div>
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
            {displayThumbnail ? (
              <img
                src={displayThumbnail}
                alt={info?.title || 'Media thumbnail'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  if (ytId && e.currentTarget.src.includes('maxresdefault')) {
                    e.currentTarget.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
                  }
                }}
              />
            ) : isAudio ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-emerald-950/50 to-gray-900 text-emerald-400 gap-2">
                <Music className="w-9 h-9 opacity-60" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/70">320kbps MP3 Audio</span>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-500">
                <ImageIcon className="w-8 h-8 opacity-40" />
              </div>
            )}

            {/* Play Button Overlay (When video or audio stream is playable and NOT a static photo) */}
            {!isPhoto && (ytId || info?.playable_url) && (
              <button
                type="button"
                onClick={() => setIsPlaying(true)}
                className="absolute inset-0 m-auto w-11 h-11 rounded-full flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 cursor-pointer shadow-lg backdrop-blur-xs"
                style={{
                  background: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-text)'
                }}
                title={isAudio ? "Play Audio Preview" : "Play Video Preview"}
              >
                <Play className="w-5 h-5 ml-0.5 fill-current" />
              </button>
            )}

            {/* Auto-recognized Media Type Badge */}
            <div className="absolute top-2 right-2 z-10">
              {getMediaBadge()}
            </div>

            {/* Carousel Previous / Next Arrows and Slide Counter */}
            {hasCarousel && info?.carousel_media && (
              <>
                <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-xs text-white text-[10px] font-mono font-bold">
                  {safeSlideIndex + 1} / {info.carousel_media.length}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSlide(prev => (prev > 0 ? prev - 1 : info.carousel_media!.length - 1));
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-xs transition-transform active:scale-90 cursor-pointer shadow-md z-10"
                  title="Previous slide"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSlide(prev => (prev < info.carousel_media!.length - 1 ? prev + 1 : 0));
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-xs transition-transform active:scale-90 cursor-pointer shadow-md z-10"
                  title="Next slide"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Dot Indicators */}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-10">
                  {info.carousel_media.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSlide(i);
                      }}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        i === safeSlideIndex ? 'w-3.5 bg-white shadow-xs' : 'w-1.5 bg-white/50 hover:bg-white/80'
                      }`}
                      title={`Slide ${i + 1}`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Duration Badge */}
            {!hasCarousel && info?.duration ? (
              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/80 text-white text-[10px] font-mono font-bold tracking-tight">
                {formatDuration(info.duration)}
              </span>
            ) : null}

            {loading && (
              <div className="absolute top-2 left-2 p-1 rounded-md bg-black/60 backdrop-blur-xs text-white z-20">
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
