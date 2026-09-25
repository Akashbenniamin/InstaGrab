import { ClipboardPaste, X, Play, Camera, Pin, Music } from 'lucide-react';
import { useRef } from 'react';
import { validateMediaUrl } from '../services/urlValidator';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  error?: string;
  onPasteText?: (text: string) => void;
}

export function UrlInput({ value, onChange, onSubmit, disabled, error, onPasteText }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSubmit();
    }
  };

  const handlePasteClick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text);
      if (onPasteText && text) onPasteText(text);
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
    }
  };

  const handleNativePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (text && onPasteText) {
      onPasteText(text);
    }
  };

  const detection = value.trim() ? validateMediaUrl(value) : null;

  return (
    <div className="w-full flex flex-col space-y-2">
      <div className="relative flex items-center w-full">
        <button
          type="button"
          onClick={handlePasteClick}
          disabled={disabled}
          className="absolute left-3.5 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
          title="Paste from clipboard"
        >
          <ClipboardPaste className="w-5 h-5" />
        </button>
        
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handleNativePaste}
          disabled={disabled}
          placeholder="Paste Instagram, YouTube, Pinterest, or Envato Audio link..."
          className={`w-full py-3.5 pl-12 pr-28 text-base sm:text-lg rounded-2xl bg-[var(--bg-main)] border ${error ? 'border-red-500' : 'border-[var(--border-color)]'} focus:outline-none focus:border-[var(--accent-color)] transition-all shadow-xs`}
        />
        
        <div className="absolute right-3 flex items-center gap-1.5">
          {/* Platform Badge when detected - Harmonized with active theme */}
          {detection && detection.valid && (
            <div 
              style={{
                background: 'var(--badge-bg)',
                color: 'var(--badge-text)',
                borderColor: 'var(--badge-border)'
              }}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border shadow-2xs transition-colors"
            >
              {detection.platform === 'instagram' ? (
                <>
                  <Camera className="w-3.5 h-3.5" style={{ color: 'var(--accent-color)' }} />
                  <span className="capitalize">{detection.contentType === 'reel' ? 'Reel' : (detection.contentType || 'Instagram')}</span>
                </>
              ) : detection.platform === 'youtube' ? (
                <>
                  <Play className="w-3.5 h-3.5" style={{ color: 'var(--accent-color)', fill: 'var(--accent-color)' }} />
                  <span>{detection.contentType === 'shorts' ? 'Shorts' : 'YouTube'}</span>
                </>
              ) : detection.platform === 'envato' ? (
                <>
                  <Music className="w-3.5 h-3.5" style={{ color: 'var(--accent-color)' }} />
                  <span>Envato Audio</span>
                </>
              ) : (
                <>
                  <Pin className="w-3.5 h-3.5" style={{ color: 'var(--accent-color)' }} />
                  <span>Pinterest</span>
                </>
              )}
            </div>
          )}

          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              disabled={disabled}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors disabled:opacity-50 cursor-pointer"
              title="Clear input"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-red-500 text-xs pl-2">{error}</p>}
    </div>
  );
}
