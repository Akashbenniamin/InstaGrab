import { ClipboardPaste, X, Play, Camera, Pin } from 'lucide-react';
import { useRef } from 'react';
import { validateMediaUrl } from '../services/urlValidator';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  error?: string;
}

export function UrlInput({ value, onChange, onSubmit, disabled, error }: Props) {
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
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
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
          disabled={disabled}
          placeholder="Paste Instagram, YouTube, or Pinterest link..."
          className={`w-full py-4 pl-12 pr-28 text-base sm:text-lg rounded-2xl bg-[var(--bg-main)] border ${error ? 'border-red-500' : 'border-[var(--border-color)]'} focus:outline-none focus:ring-2 focus:ring-insta-pink transition-all shadow-sm`}
        />
        
        <div className="absolute right-3 flex items-center gap-1.5">
          {/* Platform Badge when detected */}
          {detection && detection.valid && (
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-gray-200/80 dark:bg-gray-800 text-[var(--text-primary)]">
              {detection.platform === 'instagram' ? (
                <>
                  <Camera className="w-3.5 h-3.5 text-pink-500" />
                  <span className="capitalize">{detection.contentType || 'IG'}</span>
                </>
              ) : detection.platform === 'youtube' ? (
                <>
                  <Play className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                  <span>{detection.contentType === 'shorts' ? 'Shorts' : 'YouTube'}</span>
                </>
              ) : (
                <>
                  <Pin className="w-3.5 h-3.5 text-red-600 fill-red-600" />
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
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
              title="Clear input"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-red-500 text-sm pl-2">{error}</p>}
    </div>
  );
}
