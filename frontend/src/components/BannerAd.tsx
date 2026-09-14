import React, { useEffect } from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';

interface BannerAdProps {
  slotId?: string;
  format?: 'leaderboard' | 'rectangle';
  className?: string;
}

export const BannerAd: React.FC<BannerAdProps> = ({
  slotId,
  format = 'leaderboard',
  className = ''
}) => {
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && (window as any).adsbygoogle) {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      }
    } catch (e) {}
  }, [slotId]);

  return (
    <div className={`w-full flex flex-col items-center my-4 select-none ${className}`}>
      {/* Subtle Ad Label */}
      <div className="w-full max-w-3xl flex items-center justify-between px-2 mb-1">
        <span className="text-[9px] font-bold tracking-widest text-[var(--text-secondary)] opacity-60 uppercase">
          Advertisement
        </span>
        <span className="text-[9px] text-[var(--text-secondary)] opacity-50">
          Sponsored
        </span>
      </div>

      {/* Ad Container */}
      <div 
        className={`w-full max-w-3xl rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xs overflow-hidden transition-all duration-200 hover:border-gray-400/50 ${
          format === 'leaderboard' ? 'p-3 sm:p-4 min-h-[72px] sm:min-h-[85px]' : 'p-4 min-h-[120px]'
        }`}
      >
        {slotId ? (
          <ins
            className="adsbygoogle block w-full text-center"
            style={{ display: 'block' }}
            data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
            data-ad-slot={slotId}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div 
                style={{
                  background: 'var(--status-bg)',
                  borderColor: 'var(--status-border)'
                }}
                className="w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0"
              >
                <Sparkles className="w-5 h-5 text-[var(--accent-color)]" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] flex items-center justify-center sm:justify-start gap-1.5">
                  <span>InstaGrab for Chrome</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-extrabold bg-[var(--badge-bg)] text-[var(--badge-text)] uppercase">
                    Free
                  </span>
                </h4>
                <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] mt-0.5">
                  1-Click downloads on Instagram, YouTube &amp; Pinterest + Right-click Save as PNG.
                </p>
              </div>
            </div>

            <a
              href="#extension-install"
              onClick={(e) => {
                e.preventDefault();
                const link = document.createElement('a');
                link.href = './instagrab-extension.zip';
                link.download = 'instagrab-extension.zip';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              style={{
                background: 'var(--btn-primary-bg)',
                color: 'var(--btn-primary-text)',
                boxShadow: 'var(--btn-primary-shadow)'
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-transform transform hover:scale-102 active:scale-98 cursor-pointer flex-shrink-0"
            >
              <span>Install Extension</span>
              <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
