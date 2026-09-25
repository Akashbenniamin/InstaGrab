import { PlatformType } from '../types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
  shortcode?: string;
  platform: PlatformType;
  contentType?: 'reel' | 'post' | 'tv' | 'photo' | 'story' | 'highlight' | 'carousel' | 'shorts' | 'video' | 'clip' | 'live' | 'audio' | 'sfx';
}

export function validateMediaUrl(url: string): ValidationResult {
  if (!url || url.trim() === '') {
    return { valid: false, error: 'Please enter an Instagram, YouTube, Pinterest, or Envato URL', platform: 'unknown' };
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

  // 1. Instagram (Reels, Posts/Photos, Stories, Highlights)
  if (hostname.includes('instagram.com') || hostname.includes('instagr.am')) {
    // A. Highlights via /s/ shortlink (Base64 encoded highlight:<id>)
    const highlightShortMatch = pathname.match(/\/s\/([A-Za-z0-9_-]+)/);
    if (highlightShortMatch) {
      let highlightId = highlightShortMatch[1];
      let normalizedUrl = `https://www.instagram.com/s/${highlightShortMatch[1]}`;
      try {
        const cleanB64 = highlightShortMatch[1].replace(/-/g, '+').replace(/_/g, '/');
        const paddedB64 = cleanB64 + '='.repeat((4 - (cleanB64.length % 4)) % 4);
        const decoded = atob(paddedB64);
        const matchId = decoded.match(/highlight:(\d+)/);
        if (matchId) {
          highlightId = matchId[1];
          normalizedUrl = `https://www.instagram.com/stories/highlights/${highlightId}/`;
        }
      } catch {}
      return {
        valid: true,
        normalized: normalizedUrl,
        shortcode: highlightId,
        platform: 'instagram',
        contentType: 'highlight'
      };
    }

    // B. Stories & Highlights via /stories/
    const storyMatch = pathname.match(/\/stories\/([^/?#]+)(?:\/(\d+))?/);
    if (storyMatch) {
      const user = storyMatch[1];
      const storyId = storyMatch[2];
      if (user === 'highlights') {
        return {
          valid: true,
          normalized: `https://www.instagram.com/stories/highlights/${storyId || ''}/`,
          shortcode: storyId,
          platform: 'instagram',
          contentType: 'highlight'
        };
      }
      return {
        valid: true,
        normalized: storyId 
          ? `https://www.instagram.com/stories/${user}/${storyId}/`
          : `https://www.instagram.com/stories/${user}/`,
        shortcode: storyId || user,
        platform: 'instagram',
        contentType: 'story'
      };
    }

    // C. Posts, Reels, Photos, Carousels, TV
    const postMatch = pathname.match(/\/(?:p|reel|reels|tv|share\/reel|share\/p)\/([^\/?#&]+)/);
    if (postMatch) {
      const shortcode = postMatch[1];
      const isReel = pathname.includes('/reel');
      const isTv = pathname.includes('/tv/');
      const contentType = isReel ? 'reel' : (isTv ? 'tv' : 'post');
      const normalized = `https://www.instagram.com/${contentType === 'post' ? 'p' : contentType}/${shortcode}/`;

      return {
        valid: true,
        normalized,
        shortcode,
        platform: 'instagram',
        contentType
      };
    }

    return { 
      valid: false, 
      error: "Please enter an Instagram Post, Photo, Reel, Story, or Highlight URL", 
      platform: 'instagram' 
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

  // 3. Pinterest (pins, videos, images, pin.it)
  if (hostname.includes('pin.it')) {
    const pinSlug = pathname.replace(/^\/+/, '').split('/')[0];
    if (pinSlug) {
      return {
        valid: true,
        normalized: `https://pin.it/${pinSlug}`,
        shortcode: pinSlug,
        platform: 'pinterest',
        contentType: 'video'
      };
    }
    return { valid: false, error: 'Invalid Pinterest short link', platform: 'pinterest' };
  }

  if (hostname.includes('pinterest.')) {
    const pinMatch = pathname.match(/\/pin\/([A-Za-z0-9_-]+)/);
    if (pinMatch && pinMatch[1]) {
      const pinId = pinMatch[1];
      return {
        valid: true,
        normalized: `https://www.pinterest.com/pin/${pinId}/`,
        shortcode: pinId,
        platform: 'pinterest',
        contentType: 'video'
      };
    }
    return { valid: false, error: 'Please provide a link to a Pinterest Pin', platform: 'pinterest' };
  }

  // 4. Envato Audio & SFX (elements.envato.com, audiojungle.net, envatousercontent.com)
  if (hostname.includes('envatousercontent.com')) {
    if (/\.(mp3|m4a|wav|aac|ogg)(\?.*)?$/i.test(parsedUrl.href)) {
      return {
        valid: true,
        normalized: parsedUrl.href,
        platform: 'envato',
        contentType: 'audio'
      };
    }
    return { valid: false, error: 'Invalid Envato audio stream URL', platform: 'envato' };
  }

  if (hostname.includes('envato.com') || hostname.includes('audiojungle.net')) {
    const cleanPath = pathname.replace(/\/+$/, '');
    const categorySuffixes = [
      '/sound-effects', '/royalty-free-music', '/audio', '/stock-video',
      '/video-templates', '/graphic-templates', '/presentation-templates',
      '/photos', '/fonts', '/add-ons', '/web-templates', '/3d'
    ];
    const isCategory = categorySuffixes.some(cat => cleanPath.toLowerCase().endsWith(cat));
    if (!isCategory) {
      const itemMatch = cleanPath.match(/\/([a-zA-Z0-9-]+-([A-Za-z0-9]{6,10}))$/) || cleanPath.match(/\/item\/[^/]+\/(\d+)/);
      if (itemMatch) {
        return {
          valid: true,
          normalized: `${parsedUrl.protocol}//${parsedUrl.host}${cleanPath}`,
          shortcode: itemMatch[2] || itemMatch[1],
          platform: 'envato',
          contentType: 'audio'
        };
      }
    }
    return {
      valid: false,
      error: 'Please provide a link to a specific Envato Elements or AudioJungle audio track / SFX',
      platform: 'envato'
    };
  }

  // 5. Epidemic Sound Audio & SFX (epidemicsound.com, audiocdn.epidemicsound.com)
  if (hostname.includes('audiocdn.epidemicsound.com')) {
    if (/\.(mp3|m4a|wav|aac|ogg)(\?.*)?$/i.test(parsedUrl.href)) {
      return {
        valid: true,
        normalized: parsedUrl.href,
        platform: 'epidemic',
        contentType: 'audio'
      };
    }
    return { valid: false, error: 'Invalid Epidemic Sound audio stream URL', platform: 'epidemic' };
  }

  if (hostname.includes('epidemicsound.com')) {
    const cleanPath = pathname.replace(/\/+$/, '');
    const trackMatch = cleanPath.match(/\/(?:music|sound-effects)\/tracks\/([a-fA-F0-9-]{10,})/) || cleanPath.match(/\/track\/([A-Za-z0-9_-]+)/);
    if (trackMatch) {
      return {
        valid: true,
        normalized: `${parsedUrl.protocol}//${parsedUrl.host}${cleanPath}/`,
        shortcode: trackMatch[1],
        platform: 'epidemic',
        contentType: 'audio'
      };
    }
    return {
      valid: false,
      error: 'Please provide a link to a specific Epidemic Sound music or sound effect track',
      platform: 'epidemic'
    };
  }

  return { 
    valid: false, 
    error: 'Please enter a URL from Instagram, YouTube, Pinterest, Envato, or Epidemic Sound', 
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
