import React, { useState } from 'react';
import { CarouselMediaItem } from '../types';
import { Layers, Download, Image as ImageIcon, Video, Archive, Loader2, Check } from 'lucide-react';

interface Props {
  items: CarouselMediaItem[];
  onDownloadItem: (itemIndex: number) => void;
  onDownloadAllZip: () => void;
  onDownloadAllImages: () => void;
  isDownloading?: boolean;
}

export const CarouselGallery: React.FC<Props> = ({
  items,
  onDownloadItem,
  onDownloadAllZip,
  onDownloadAllImages,
  isDownloading = false
}) => {
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);
  const [downloadedIndices, setDownloadedIndices] = useState<Set<number>>(new Set());

  const handleSingleDownload = (index: number) => {
    setDownloadingIndex(index);
    onDownloadItem(index);
    setTimeout(() => {
      setDownloadedIndices(prev => new Set(prev).add(index));
      setDownloadingIndex(null);
    }, 1500);
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
      {/* Header bar with bulk action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-500 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              Carousel Slides
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--badge-bg)] text-[var(--text-secondary)]">
                {items.length} media items
              </span>
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Download individual slides or get the full collection
            </p>
          </div>
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Download All as ZIP (Recommended) */}
          <button
            type="button"
            onClick={onDownloadAllZip}
            disabled={isDownloading}
            style={{
              background: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-text)'
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all transform hover:opacity-95 active:scale-97 cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
            title="Package all carousel photos & videos into a single .ZIP archive"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Download All as .ZIP</span>
          </button>

          {/* Download All as Images (One by one) */}
          <button
            type="button"
            onClick={onDownloadAllImages}
            disabled={isDownloading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)] hover:border-gray-400 dark:hover:border-gray-600 transition-all transform active:scale-97 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            title="Download every item sequentially one by one"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download All (One by one)</span>
          </button>
        </div>
      </div>

      {/* Grid of Slide Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {items.map((item) => {
          const isItemDownloading = downloadingIndex === item.index;
          const isItemDownloaded = downloadedIndices.has(item.index);

          return (
            <div
              key={item.index}
              className="group relative flex flex-col rounded-xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-main)] hover:border-gray-400 dark:hover:border-gray-600 transition-all shadow-2xs"
            >
              {/* Image / Thumbnail Container */}
              <div className="relative aspect-square bg-black/20 overflow-hidden flex items-center justify-center">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={`Slide #${item.index + 1}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 opacity-30 text-[var(--text-secondary)]" />
                )}

                {/* Top-Left: Slide Index Badge */}
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-white text-[10px] font-mono font-bold">
                  #{item.index + 1}
                </span>

                {/* Top-Right: Media Type Badge */}
                <span className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-1 backdrop-blur-xs text-white ${
                  item.media_type === 'video' ? 'bg-fuchsia-600/90' : 'bg-teal-700/90'
                }`}>
                  {item.media_type === 'video' ? (
                    <>
                      <Video className="w-2.5 h-2.5" /> Video
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-2.5 h-2.5" /> Photo
                    </>
                  )}
                </span>
              </div>

              {/* Individual Card Download Button */}
              <div className="p-2 bg-[var(--bg-card)]">
                <button
                  type="button"
                  onClick={() => handleSingleDownload(item.index)}
                  disabled={isDownloading || isItemDownloading}
                  className={`w-full py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isItemDownloaded
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-[var(--bg-main)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-gray-400 dark:hover:border-gray-600 active:scale-95'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                  title={`Download slide #${item.index + 1}`}
                >
                  {isItemDownloading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : isItemDownloaded ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span>Downloaded</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3 h-3" />
                      <span>Download #{item.index + 1}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
