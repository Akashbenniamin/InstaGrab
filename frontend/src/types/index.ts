export type DownloadState = 'idle' | 'validating' | 'connecting' | 'extracting' | 'downloading' | 'processing' | 'complete' | 'error' | 'cancelled';

export type FormatType = 'video' | 'audio';
export type VideoQuality = 'best' | '1080p' | '720p' | '480p' | '360p';
export type AudioQuality = 'best' | '320k' | '192k' | '128k';
export type QualityOption = VideoQuality | AudioQuality;
export type PlatformType = 'instagram' | 'youtube' | 'pinterest' | 'envato' | 'unknown';

export interface CarouselMediaItem {
  index: number;
  media_type: 'photo' | 'video';
  thumbnail: string;
  url?: string;
  filename?: string;
  width?: number;
  height?: number;
}

export interface MediaInfo {
  title?: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  platform?: string;
  playable_url?: string | null;
  media_type?: string;
  carousel_media?: CarouselMediaItem[];
  item_count?: number;
  error?: string;
}

export interface DownloadProgress {
  id: string;
  state: DownloadState;
  progress?: number; // 0-100
  speed?: string;
  eta?: string;
  filename?: string;
  filepath?: string;
  files?: string[];
  error?: string;
  errorType?: 'invalid_url' | 'helper_offline' | 'private_content' | 'unsupported' | 'network' | 'instagram_changed' | 'unknown';
}

export interface HelperStatus {
  connected: boolean;
  paired: boolean;
  version?: string;
  downloadPath?: string;
  hasCookies?: boolean;
}

export interface HistoryEntry {
  id: string;
  url: string;
  filename: string;
  timestamp: number;
  success: boolean;
  platform?: PlatformType;
  format?: FormatType;
  filepath?: string;
  sizeFormatted?: string;
  isAudio?: boolean;
  isVideo?: boolean;
  isImage?: boolean;
  isZip?: boolean;
}

export interface HelperHealthResponse {
  status: 'ok';
  version: string;
  downloadPath: string;
  ytdlpVersion: string;
  hasCookies?: boolean;
}

export interface HelperDownloadResponse {
  downloadId: string;
}

export interface HelperStatusResponse {
  state: DownloadState;
  progress?: number;
  speed?: string;
  eta?: string;
  filename?: string;
  filepath?: string;
  files?: string[];
  error?: string;
  errorType?: string;
}
