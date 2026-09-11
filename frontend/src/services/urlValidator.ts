import { PlatformType } from '../types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
  shortcode?: string;
  platform: PlatformType;
  contentType?: 'reel' | 'post' | 'tv' | 'shorts' | 'video' | 'clip' | 'live';
}

export function validateMediaUrl(url: string): ValidationResult {
  if (!url || url.trim() === '') {
    return { valid: false, error: 'Please enter an Instagram or YouTube URL', platform: 'unknown' };
  }

  let parsedUrl: URL;
  try {
    let urlToParse = url.trim();
    if (!urlToParse.startsWith('http://') && !urlToParse.startsWith('https://')) {
      urlToParse = 'https://' + urlToParse;
    }
    parsedUrl = new URL(urlToParse);
  } catch {
    return { valid: false, error: 'Please enter a valid URL', platform: 'unknown' };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname;

  // 1. Instagram
  if (hostname.includes('instagram.com') || hostname.includes('instagr.am')) {
    const match = pathname.match(/\/(?:p|reel|tv)\/([^\/?#&]+)/);
    if (!match) {
      return { 
        valid: false, 
        error: "This Instagram URL doesn't point to a specific post or reel", 
        platform: 'instagram' 
      };
    }

    const typeMatch = pathname.match(/\/(p|reel|tv)\//);
    const contentType = (typeMatch ? typeMatch[1] : 'post') as 'reel' | 'post' | 'tv';
    const shortcode = match[1];
    const normalized = `https://www.instagram.com/${contentType}/${shortcode}/`;

    return {
      valid: true,
      normalized,
      shortcode,
      platform: 'instagram',
      contentType
    };
  }

  // 2. YouTube
  if (hostname.includes('youtu.be')) {
    const videoId = pathname.replace(/^\/+/, '').split('/')[0];
    if (videoId && /^[A-Za-z0-9_-]+$/.test(videoId)) {
      return {
        valid: true,
        normalized: `https://www.youtube.com/watch?v=${videoId}`,
        shortcode: videoId,
        platform: 'youtube',
        contentType: 'video'
      };
    }
    return { valid: false, error: 'Invalid YouTube short link', platform: 'youtube' };
  }

  if (hostname.includes('youtube.com')) {
    // Shorts
    if (pathname.includes('/shorts/')) {
      const match = pathname.match(/\/shorts\/([A-Za-z0-9_-]+)/);
      if (match && match[1]) {
        return {
          valid: true,
          normalized: `https://www.youtube.com/shorts/${match[1]}`,
          shortcode: match[1],
          platform: 'youtube',
          contentType: 'shorts'
        };
      }
      return { valid: false, error: 'Invalid YouTube Shorts URL', platform: 'youtube' };
    }

    // Watch video
    if (pathname === '/watch' || pathname === '/watch_popup') {
      const videoId = parsedUrl.searchParams.get('v');
      if (videoId && /^[A-Za-z0-9_-]+$/.test(videoId)) {
        return {
          valid: true,
          normalized: `https://www.youtube.com/watch?v=${videoId}`,
          shortcode: videoId,
          platform: 'youtube',
          contentType: 'video'
        };
      }
      return { valid: false, error: 'Invalid YouTube video URL (missing video ID)', platform: 'youtube' };
    }

    // Embed or Live
    const embedMatch = pathname.match(/\/(live|embed|v|clip)\/([A-Za-z0-9_-]+)/);
    if (embedMatch && embedMatch[2]) {
      return {
        valid: true,
        normalized: `https://www.youtube.com/watch?v=${embedMatch[2]}`,
        shortcode: embedMatch[2],
        platform: 'youtube',
        contentType: embedMatch[1] as any
      };
    }

    return { valid: false, error: "Please provide a link to a YouTube video or Short", platform: 'youtube' };
  }

  return { 
    valid: false, 
    error: 'Please enter a URL from Instagram or YouTube', 
    platform: 'unknown' 
  };
}

// Compatibility wrapper
export function validateInstagramUrl(url: string) {
  const res = validateMediaUrl(url);
  return {
    valid: res.valid,
    error: res.error,
    normalized: res.normalized,
    shortcode: res.shortcode,
    platform: res.platform
  };
}
