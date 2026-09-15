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
  Sliders, 
  Puzzle, 
  Download,
  ShieldCheck 
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
    description: 'Syncs automatically with your OS light/dark appearance',
    previewBg: 'bg-gradient-to-r from-gray-200 to-gray-900',
    previewCard: 'bg-gradient-to-r from-white to-gray-800',
    accent: '#2563eb'
  },
  {
    id: 'creators',
    name: 'Creators Blue',
    description: 'Modern SaaS slate canvas with crisp royal blue accents',
    badge: 'Popular',
    previewBg: 'bg-[#f8fafc]',
    previewCard: 'bg-[#ffffff]',
    accent: '#2563eb'
  },
  {
    id: 'dark',
    name: 'Midnight Studio',
    description: 'Refined dark slate with vivid electric sky blue accents',
    badge: 'Pro Dark',
    previewBg: 'bg-[#0b0f19]',
    previewCard: 'bg-[#131b2e]',
    accent: '#38bdf8'
  },
  {
    id: 'light',
    name: 'Minimal Light',
    description: 'Clean, crisp white interface with modern royal indigo accents',
    previewBg: 'bg-[#f9fafb]',
    previewCard: 'bg-[#ffffff]',
    accent: '#4f46e5'
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    description: 'Deep space dark with electric cyan and neon violet accents',
    badge: 'Vivid',
    previewBg: 'bg-[#070a14]',
    previewCard: 'bg-[#0f1526]',
    accent: '#06b6d4'
  },
  {
    id: 'sunset',
    name: 'Sunset Amber',
    description: 'Warm twilight glow with amber and coral gradients',
    previewBg: 'bg-[#140d12]',
    previewCard: 'bg-[#20141d]',
    accent: '#f43f5e'
  },
  {
    id: 'oled',
    name: 'OLED Midnight',
    description: 'True pitch #000000 black for maximum contrast and battery life',
    badge: 'Pure Black',
    previewBg: 'bg-[#000000]',
    previewCard: 'bg-[#0d0d0d]',
    accent: '#ffffff'
  },
  {
    id: 'emerald',
    name: 'Emerald Obsidian',
    description: 'Luxurious deep obsidian with luminous emerald green accents',
    badge: 'New',
    previewBg: 'bg-[#060f0a]',
    previewCard: 'bg-[#0d1a12]',
    accent: '#10b981'
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
      {/* Stable fixed-height modal to eliminate tab switching height jumps */}
      <div 
        className="relative w-full max-w-xl h-[520px] max-h-[88vh] rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0 bg-[var(--bg-main)]/50">
          <div className="flex items-center space-x-3">
            <div 
              style={{
                background: 'var(--btn-primary-bg)',
                color: 'var(--btn-primary-text)'
              }}
              className="p-2 rounded-xl shadow-2xs"
            >
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)] leading-tight">Settings</h2>
              <p className="text-xs text-[var(--text-secondary)]">Preferences, storage & themes</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--border-color)] px-5 gap-5 text-xs font-semibold flex-shrink-0">
          {[
            { id: 'storage' as const, label: 'Download Location', icon: Folder },
            { id: 'themes' as const, label: 'Themes', icon: Palette },
            { id: 'extension' as const, label: 'Browser Extension', icon: Puzzle },
            { id: 'about' as const, label: 'Engine Info', icon: Sparkles },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={isActive ? {
                  borderColor: 'var(--accent-color)',
                  color: 'var(--accent-color)'
                } : undefined}
                className={`py-3 flex items-center gap-1.5 border-b-2 cursor-pointer transition-colors ${
                  isActive
                    ? 'font-bold'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content - Scrollable area inside stable container */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: STORAGE / DOWNLOAD LOCATION */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Default Download Folder
                </label>
                <p className="text-xs text-[var(--text-secondary)]">
                  Videos and audio processed by the local engine save to this path.
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
                    className="w-full py-3 pl-10 pr-4 text-xs sm:text-sm rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] focus:outline-none focus:border-[var(--accent-color)] transition-all font-mono"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] px-1">
                  <span>Synced with InstaGrab Engine & local storage</span>
                  {saveSuccess && (
                    <span className="text-green-500 font-bold flex items-center gap-1 animate-in fade-in">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Saved!
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                <button
                  onClick={handleSavePath}
                  disabled={isSaving}
                  style={{
                    background: 'var(--btn-primary-bg)',
                    color: 'var(--btn-primary-text)',
                    boxShadow: 'var(--btn-primary-shadow)'
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold hover:opacity-95 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Location'}</span>
                </button>

                <button
                  onClick={handleResetPath}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-gray-400 transition-colors cursor-pointer"
                  title="Reset to default Downloads directory"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Default</span>
                </button>

                {status.connected && (
                  <button
                    onClick={handleOpenFolder}
                    style={{ color: 'var(--accent-color)' }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] text-xs font-bold hover:underline transition-all cursor-pointer ml-auto"
                    title="Open this folder in Windows File Explorer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Open in File Explorer</span>
                  </button>
                )}
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
                  Pick your preferred color palette. Changes apply instantly.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {THEME_OPTIONS.map((item) => {
                  const isSelected = theme === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setTheme(item.id)}
                      style={isSelected ? {
                        borderColor: 'var(--accent-color)',
                        background: 'var(--badge-bg)'
                      } : undefined}
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden ${
                        isSelected
                          ? 'shadow-xs ring-1 ring-[var(--accent-color)]'
                          : 'border-[var(--border-color)] hover:border-gray-400 bg-[var(--bg-main)]/50'
                      }`}
                    >
                      <div className="flex items-start justify-between w-full">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full border border-white/20 shadow-2xs flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: item.accent }}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                          </div>
                          <span className="font-bold text-xs text-[var(--text-primary)]">{item.name}</span>
                        </div>
                        {item.badge && (
                          <span 
                            style={{
                              background: 'var(--badge-bg)',
                              color: 'var(--badge-text)'
                            }}
                            className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] text-[var(--text-secondary)] mt-1.5 line-clamp-1">
                        {item.description}
                      </p>

                      <div className="mt-2.5 w-full h-2 rounded-full overflow-hidden flex border border-black/10 dark:border-white/10">
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
                <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  InstaGrab Browser Extension
                </span>
                <p className="text-xs text-[var(--text-secondary)]">
                  Adds 1-click &quot;Grab&quot; download overlays directly inside Pinterest, YouTube Shorts, and Instagram.
                </p>
              </div>

              {/* Download card */}
              <div className="p-4 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-left">
                  <div className="font-bold text-xs text-[var(--text-primary)]">
                    InstaGrab Extension (Manifest V3)
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Compatible with Chrome, Edge, Brave & Chromium browsers
                  </p>
                </div>

                <a
                  href={`${import.meta.env.BASE_URL}instagrab-extension.zip`}
                  download="instagrab-extension.zip"
                  className="w-full sm:w-auto flex-shrink-0 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold hover:opacity-95 transition-all duration-200 cursor-pointer text-center active:scale-95"
                  style={{
                    background: 'var(--btn-primary-bg)',
                    color: 'var(--btn-primary-text)',
                    boxShadow: 'var(--btn-primary-shadow)',
                  }}
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>Download Extension (.zip)</span>
                </a>
              </div>

              {/* Automated 18+ Session Sync Feature Highlight */}
              <div className="p-3.5 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#10b981]" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">Automated 18+ Reel &amp; Private Session Sync</span>
                  </div>
                  <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[var(--badge-bg)] text-[var(--badge-text)] uppercase">
                    Seamless
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  The extension automatically syncs your logged-in Instagram session to the Desktop Engine in the background. Age-restricted and sensitive 18+ reels download seamlessly with zero manual export needed.
                </p>
              </div>

              {/* Minimal Clean Steps (No Clutter) */}
              <div className="space-y-2 pt-1">
                <h4 className="text-xs font-bold text-[var(--text-primary)]">
                  Quick Install in 3 Steps:
                </h4>
                
                <div className="space-y-2 text-xs text-[var(--text-secondary)]">
                  <div className="flex gap-2.5 items-center p-2 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)]">
                    <span 
                      style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
                      className="w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center flex-shrink-0"
                    >1</span>
                    <p>Extract <code className="font-mono text-[10px] bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded">instagrab-extension.zip</code> to any folder on your PC.</p>
                  </div>

                  <div className="flex gap-2.5 items-center p-2 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)]">
                    <span 
                      style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
                      className="w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center flex-shrink-0"
                    >2</span>
                    <p>Open <code className="font-mono text-[10px] bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded">chrome://extensions</code> and turn on <strong>Developer mode</strong>.</p>
                  </div>

                  <div className="flex gap-2.5 items-center p-2 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)]">
                    <span 
                      style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
                      className="w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center flex-shrink-0"
                    >3</span>
                    <p>Click <strong>Load unpacked</strong> and select the extracted folder.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ENGINE INFO & DIAGNOSTICS */}
          {activeTab === 'about' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Engine Overview
                </span>
                <p className="text-xs text-[var(--text-secondary)]">
                  Native background daemon executing downloads and NLE media transcoding.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)] space-y-3 text-xs">
                <div className="font-bold text-[var(--text-primary)]">InstaGrab Engine Diagnostics</div>
                <div className="grid grid-cols-2 gap-3 text-[11px] text-[var(--text-secondary)]">
                  <div>Status: <span className="font-bold" style={{ color: 'var(--accent-color)' }}>{status.connected ? 'Active (Port 18765)' : 'Offline'}</span></div>
                  <div>Version: <span className="font-bold text-[var(--text-primary)]">{status.version || 'v1.1.0'}</span></div>
                  <div>Platforms: <span className="font-bold text-[var(--text-primary)]">Instagram, YouTube, Pinterest</span></div>
                  <div>18+ Session Sync: <span className="font-bold" style={{ color: status.hasCookies ? '#10b981' : 'var(--text-secondary)' }}>{status.hasCookies ? 'Active (Synced)' : 'Auto-Sync Active'}</span></div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--badge-bg)] border border-[var(--badge-border)] text-xs text-[var(--badge-text)] flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 flex-shrink-0" />
                <p className="text-[11px]">
                  All processing runs locally on your PC via FFmpeg & yt-dlp. No cloud bottlenecks, no data collection.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-main)]/50 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            style={{
              background: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-text)',
              boxShadow: 'var(--btn-primary-shadow)'
            }}
            className="px-6 py-2 rounded-xl text-xs font-bold hover:opacity-95 transition-opacity cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
