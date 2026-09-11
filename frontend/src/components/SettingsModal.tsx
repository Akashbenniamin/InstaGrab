import React, { useState, useEffect } from 'react';
import { 
  X, 
  Folder, 
  Palette, 
  Check, 
  RotateCcw, 
  FolderOpen, 
  Sparkles, 
  Save, 
  CheckCircle2, 
  Info,
  Sliders,
  Puzzle,
  Download
} from 'lucide-react';
import { Theme } from '../hooks/useTheme';
import { HelperStatus } from '../types';
import { helperApi } from '../services/helperApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  status: HelperStatus;
}

interface ThemeOption {
  id: Theme;
  name: string;
  description: string;
  badge?: string;
  previewBg: string;
  previewCard: string;
  accent: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'system',
    name: 'System Default',
    description: 'Syncs automatically with your OS light/dark theme',
    previewBg: 'bg-gradient-to-r from-gray-100 to-gray-900',
    previewCard: 'bg-gradient-to-r from-white to-gray-800',
    accent: '#E1306C'
  },
  {
    id: 'dark',
    name: 'Insta Dark',
    description: 'Classic Instagram dark aesthetic with gradient accents',
    badge: 'Popular',
    previewBg: 'bg-[#0a0a0a]',
    previewCard: 'bg-[#1a1a1a]',
    accent: '#E1306C'
  },
  {
    id: 'light',
    name: 'Insta Light',
    description: 'Clean, crisp white interface for bright environments',
    previewBg: 'bg-[#f9fafb]',
    previewCard: 'bg-[#ffffff]',
    accent: '#E1306C'
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    description: 'Electric cyan and deep indigo futuristic style',
    badge: 'New',
    previewBg: 'bg-[#080c18]',
    previewCard: 'bg-[#0f172a]',
    accent: '#38bdf8'
  },
  {
    id: 'sunset',
    name: 'Sunset Amber',
    description: 'Warm twilight glow with amber and rose gradients',
    previewBg: 'bg-[#160c18]',
    previewCard: 'bg-[#241327]',
    accent: '#f472b6'
  },
  {
    id: 'oled',
    name: 'OLED Midnight',
    description: 'True pitch #000000 black for maximum contrast and battery life',
    previewBg: 'bg-[#000000]',
    previewCard: 'bg-[#0a0a0a]',
    accent: '#ffffff'
  }
];

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  theme,
  setTheme,
  status
}) => {
  const [downloadPath, setDownloadPath] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'storage' | 'themes' | 'extension' | 'about'>('storage');

  useEffect(() => {
    if (!isOpen) return;

    // Load download path: first check localStorage, then fetch from helper
    const localSaved = localStorage.getItem('insta_dl_download_path');
    if (localSaved) {
      setDownloadPath(localSaved);
    }

    if (status.connected) {
      helperApi.getConfig().then(cfg => {
        if (cfg && cfg.download_path) {
          if (!localSaved) {
            setDownloadPath(cfg.download_path);
            localStorage.setItem('insta_dl_download_path', cfg.download_path);
          }
        }
      });
    }
  }, [isOpen, status.connected]);

  if (!isOpen) return null;

  const handleSavePath = async () => {
    const trimmed = downloadPath.trim();
    if (!trimmed) return;

    setIsSaving(true);
    localStorage.setItem('insta_dl_download_path', trimmed);

    if (status.connected) {
      await helperApi.updateDownloadPath(trimmed);
    }

    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetPath = async () => {
    localStorage.removeItem('insta_dl_download_path');
    setDownloadPath('');

    if (status.connected) {
      // Re-fetch default from helper
      const cfg = await helperApi.getConfig();
      if (cfg && cfg.download_path) {
        setDownloadPath(cfg.download_path);
      }
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleOpenFolder = async () => {
    await helperApi.openFile(downloadPath || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/30">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl insta-gradient text-white shadow-xs">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)] leading-tight">Settings</h2>
              <p className="text-xs text-[var(--text-secondary)]">Preferences, storage & themes</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--border-color)] px-5 gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('storage')}
            className={`py-3 flex items-center gap-1.5 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'storage'
                ? 'border-insta-pink text-insta-pink'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Folder className="w-4 h-4" />
            <span>Download Location</span>
          </button>
          <button
            onClick={() => setActiveTab('themes')}
            className={`py-3 flex items-center gap-1.5 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'themes'
                ? 'border-insta-pink text-insta-pink'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Themes</span>
          </button>
          <button
            onClick={() => setActiveTab('extension')}
            className={`py-3 flex items-center gap-1.5 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'extension'
                ? 'border-insta-pink text-insta-pink'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Puzzle className="w-4 h-4" />
            <span>Browser Extension</span>
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`py-3 flex items-center gap-1.5 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'about'
                ? 'border-insta-pink text-insta-pink'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Future Features</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: STORAGE / DOWNLOAD LOCATION */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Default Download Folder
                </label>
                <p className="text-xs text-[var(--text-secondary)]">
                  Downloaded videos and audio will be saved directly to this path on your computer.
                </p>
              </div>

              <div className="space-y-2">
                <div className="relative flex items-center">
                  <Folder className="w-4 h-4 text-gray-400 absolute left-3.5" />
                  <input
                    type="text"
                    value={downloadPath}
                    onChange={e => setDownloadPath(e.target.value)}
                    placeholder="e.g. C:\Users\YourName\Downloads\InstaGrab"
                    className="w-full py-3 pl-10 pr-4 text-xs sm:text-sm rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-insta-pink transition-all font-mono"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] px-1">
                  <span>Saved in local storage and synced with Desktop Engine</span>
                  {saveSuccess && (
                    <span className="text-green-500 font-semibold flex items-center gap-1 animate-in fade-in">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Saved!
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                <button
                  onClick={handleSavePath}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 insta-gradient text-white rounded-xl text-xs font-bold hover:opacity-95 shadow-xs transition-opacity cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Location'}</span>
                </button>

                <button
                  onClick={handleResetPath}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-gray-400 transition-colors cursor-pointer"
                  title="Reset to default Downloads directory"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Default</span>
                </button>

                {status.connected && (
                  <button
                    onClick={handleOpenFolder}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] text-xs font-medium text-insta-pink hover:underline transition-colors cursor-pointer ml-auto"
                    title="Open this folder in Windows File Explorer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Open in File Explorer</span>
                  </button>
                )}
              </div>

              {/* Status banner */}
              <div className="mt-4 p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/30 border border-[var(--border-color)] flex items-start gap-2.5 text-xs text-[var(--text-secondary)]">
                <Info className="w-4 h-4 text-insta-pink flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-[var(--text-primary)]">Tip for Custom Folders</p>
                  <p>
                    You can specify any valid Windows folder path (like <code className="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-[10px]">D:\Media\Instagram</code>). If the directory does not exist, InstaGrab will create it automatically.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: THEMES */}
          {activeTab === 'themes' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Select Theme
                </label>
                <p className="text-xs text-[var(--text-secondary)]">
                  Pick your preferred color palette. Changes are applied instantly.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {THEME_OPTIONS.map((item) => {
                  const isSelected = theme === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setTheme(item.id)}
                      className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden ${
                        isSelected
                          ? 'border-insta-pink ring-2 ring-insta-pink/30 bg-[var(--bg-main)] shadow-sm'
                          : 'border-[var(--border-color)] hover:border-gray-400 bg-[var(--bg-main)]/50'
                      }`}
                    >
                      <div className="flex items-start justify-between w-full">
                        <div className="flex items-center gap-2">
                          {/* Color preview circle */}
                          <div 
                            className="w-5 h-5 rounded-full border border-white/20 shadow-xs flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: item.accent }}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                          </div>
                          <span className="font-bold text-xs text-[var(--text-primary)]">{item.name}</span>
                        </div>
                        {item.badge && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-insta-pink/10 text-insta-pink">
                            {item.badge}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-[var(--text-secondary)] mt-2 line-clamp-2">
                        {item.description}
                      </p>

                      {/* Swatch preview bar */}
                      <div className="mt-3 w-full h-3 rounded-lg overflow-hidden flex border border-black/10 dark:border-white/10">
                        <div className={`w-1/2 h-full ${item.previewBg}`} />
                        <div className={`w-1/2 h-full ${item.previewCard}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: BROWSER EXTENSION */}
          {activeTab === 'extension' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    InstaGrab Browser Extension
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 dark:bg-pink-950/60 text-insta-pink">
                    Pinterest 1-Click
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Adds native 1-click &quot;Grab&quot; download buttons directly on Pinterest posts and pins.
                </p>
              </div>

              {/* Download card */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-[var(--border-color)] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-left w-full sm:w-auto">
                  <div className="font-bold text-xs text-[var(--text-primary)]">
                    InstaGrab Extension for Chrome, Edge & Brave
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Manifest V3 • Lightweight • Works with your local Desktop Engine
                  </p>
                </div>

                <a
                  href="/instagrab-extension.zip"
                  download="instagrab-extension.zip"
                  className="w-full sm:w-auto flex-shrink-0 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl insta-gradient text-white text-xs font-bold hover:opacity-95 shadow-xs transition-opacity cursor-pointer text-center"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Extension (.zip)</span>
                </a>
              </div>

              {/* Installation steps */}
              <div className="space-y-3 pt-1">
                <h4 className="text-xs font-bold text-[var(--text-primary)]">
                  Manual Installation Guide (10 Seconds):
                </h4>
                
                <div className="space-y-2.5 text-xs text-[var(--text-secondary)]">
                  <div className="flex gap-2.5 items-start">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full insta-gradient text-white font-bold text-[10px] flex items-center justify-center">1</span>
                    <p>Click the button above to download <code className="font-mono text-[10px] bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded">instagrab-extension.zip</code> and extract it anywhere on your PC.</p>
                  </div>

                  <div className="flex gap-2.5 items-start">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full insta-gradient text-white font-bold text-[10px] flex items-center justify-center">2</span>
                    <p>Open <code className="font-mono text-[10px] bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded">chrome://extensions</code> (or <code className="font-mono text-[10px] bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded">edge://extensions</code>) in your browser and toggle on <strong>Developer mode</strong> in the top right.</p>
                  </div>

                  <div className="flex gap-2.5 items-start">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full insta-gradient text-white font-bold text-[10px] flex items-center justify-center">3</span>
                    <p>Click <strong>Load unpacked</strong> (top left) and select the extracted folder. That&apos;s it!</p>
                  </div>
                </div>
              </div>

              {/* Features summary */}
              <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Now visit <a href="https://pinterest.com" target="_blank" rel="noreferrer" className="underline font-bold">Pinterest</a>. You will see floating <strong>Grab</strong> buttons on every pin. Clicking it sends the video or image straight to your InstaGrab downloads folder!
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: FUTURE FEATURES & EXTENSIBILITY */}
          {activeTab === 'about' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 space-y-2">
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  <span>Roadmap & Upcoming Features</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  We are continuously expanding InstaGrab! Here are upcoming features you will find right here in Settings:
                </p>
                <ul className="text-xs space-y-1.5 text-[var(--text-primary)] list-disc list-inside pt-1">
                  <li><strong>Custom Naming Rules:</strong> Configure naming templates like <code className="font-mono text-[10px] bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded">{'{uploader}_{title}_{date}'}</code></li>
                  <li><strong>Clipboard Auto-Detection:</strong> Auto-paste detected Instagram, YouTube, and Pinterest links on focus</li>
                  <li><strong>Browser Cookie Sync:</strong> Download private bookmarks and stories from your active browser session</li>
                  <li><strong>Subtitles & Thumbnail Extraction:</strong> Save cover artwork and audio transcripts alongside media</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)] space-y-2 text-xs">
                <div className="font-bold text-[var(--text-primary)]">InstaGrab Engine Info</div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--text-secondary)]">
                  <div>Status: <span className="font-semibold text-green-500">{status.connected ? 'Active (Port 18765)' : 'Not Connected'}</span></div>
                  <div>Version: <span className="font-semibold text-[var(--text-primary)]">{status.version || 'v1.0.2'}</span></div>
                  <div>Supported Sites: <span className="font-semibold text-[var(--text-primary)]">Instagram, YouTube, Pinterest</span></div>
                  <div>Engine Mode: <span className="font-semibold text-[var(--text-primary)]">Native Local (Zero Cloud Limits)</span></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[var(--border-color)] bg-gray-50/50 dark:bg-gray-800/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl insta-gradient text-white text-xs font-bold hover:opacity-95 transition-opacity cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
