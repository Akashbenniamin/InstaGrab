import { HelperHealthResponse, HelperStatusResponse, HelperDownloadResponse, MediaInfo, HistoryEntry } from '../types';

class HelperApi {
  private baseUrl = 'http://127.0.0.1:18765';
  
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('insta_dl_token');
    const headers: Record<string, string> = {
      'X-Requested-With': 'InstaGrab',
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async checkHealth(): Promise<HelperHealthResponse> {
    const response = await fetch(`${this.baseUrl}/api/health`, {
      headers: {
        'X-Requested-With': 'InstaGrab'
      }
    });
    if (!response.ok) throw new Error('Helper not healthy');
    return response.json();
  }

  async validateToken(): Promise<boolean> {
    const token = localStorage.getItem('insta_dl_token');
    if (!token) return false;
    try {
      const response = await fetch(`${this.baseUrl}/api/config`, {
        headers: this.getHeaders()
      });
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('insta_dl_token');
        return false;
      }
      return response.ok;
    } catch {
      return false;
    }
  }

  async autoPair(): Promise<string> {
    const cleanHeaders = {
      'X-Requested-With': 'InstaGrab',
      'Content-Type': 'application/json'
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/pair/auto`, {
        method: 'POST',
        headers: cleanHeaders,
      });
      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          localStorage.setItem('insta_dl_token', data.token);
          return data.token;
        }
      }
    } catch {
      // Fallback below
    }

    try {
      // Fallback to pair/verify with code: 'auto'
      const response = await fetch(`${this.baseUrl}/api/pair/verify`, {
        method: 'POST',
        headers: cleanHeaders,
        body: JSON.stringify({ code: 'auto' })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          localStorage.setItem('insta_dl_token', data.token);
          return data.token;
        }
      }
    } catch {
      // Fallback failed
    }

    throw new Error('Could not automatically pair');
  }

  async pair(code: string = 'auto'): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/pair/verify`, {
      method: 'POST',
      headers: {
        'X-Requested-With': 'InstaGrab',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code })
    });
    if (!response.ok) throw new Error('Pairing failed');
    const data = await response.json();
    if (data.token) {
      localStorage.setItem('insta_dl_token', data.token);
      return data.token;
    }
    throw new Error('No token received');
  }

  async startDownload(
    url: string, 
    formatType: string = 'video', 
    quality: string = 'best',
    options?: { itemIndex?: number; asZip?: boolean }
  ): Promise<string> {
    const payload: Record<string, any> = { 
      url,
      format_type: formatType,
      quality
    };
    if (options?.itemIndex !== undefined) {
      payload.item_index = options.itemIndex;
    }
    if (options?.asZip !== undefined) {
      payload.as_zip = options.asZip;
    }

    let response = await fetch(`${this.baseUrl}/api/download`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    
    // Auto-repair on 401/403 (token expired or invalidated)
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('insta_dl_token');
      try {
        await this.autoPair();
        response = await fetch(`${this.baseUrl}/api/download`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(payload)
        });
      } catch {
        throw new Error('UNAUTHORIZED');
      }
    }
    
    if (response.status === 401 || response.status === 403) {
      throw new Error('UNAUTHORIZED');
    }
    
    if (!response.ok) throw new Error('Failed to start download');
    const data: HelperDownloadResponse = await response.json();
    return data.downloadId;
  }

  async getDownloadStatus(downloadId: string): Promise<HelperStatusResponse> {
    let response = await fetch(`${this.baseUrl}/api/download/${downloadId}/status`, {
      headers: this.getHeaders()
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('insta_dl_token');
      try {
        await this.autoPair();
        response = await fetch(`${this.baseUrl}/api/download/${downloadId}/status`, {
          headers: this.getHeaders()
        });
      } catch {
        throw new Error('UNAUTHORIZED');
      }
    }

    if (!response.ok) throw new Error('Failed to get status');
    return response.json();
  }

  async cancelDownload(downloadId: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/download/${downloadId}/cancel`, {
      method: 'POST',
      headers: this.getHeaders()
    });
  }

  async openFile(filepath?: string, filename?: string): Promise<boolean> {
    try {
      if (!localStorage.getItem('insta_dl_token')) {
        try { await this.autoPair(); } catch {}
      }

      let response = await fetch(`${this.baseUrl}/api/open-file`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ filepath, filename, title: filename })
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('insta_dl_token');
        try {
          await this.autoPair();
          response = await fetch(`${this.baseUrl}/api/open-file`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ filepath, filename, title: filename })
          });
        } catch {}
      }

      return response.ok;
    } catch (e) {
      console.error('Failed to open file:', e);
      return false;
    }
  }

  async updateDownloadPath(downloadPath: string): Promise<boolean> {
    try {
      let response = await fetch(`${this.baseUrl}/api/config`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ download_path: downloadPath })
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('insta_dl_token');
        try {
          await this.autoPair();
          response = await fetch(`${this.baseUrl}/api/config`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ download_path: downloadPath })
          });
        } catch {}
      }

      return response.ok;
    } catch (e) {
      console.error('Failed to update download path:', e);
      return false;
    }
  }

  async getConfig(): Promise<{ download_path?: string } | null> {
    try {
      let response = await fetch(`${this.baseUrl}/api/config`, {
        headers: this.getHeaders()
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('insta_dl_token');
        try {
          await this.autoPair();
          response = await fetch(`${this.baseUrl}/api/config`, {
            headers: this.getHeaders()
          });
        } catch {}
      }

      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      console.error('Failed to get config:', e);
      return null;
    }
  }

  async getRecentDownloads(): Promise<HistoryEntry[]> {
    try {
      let response = await fetch(`${this.baseUrl}/api/downloads/recent`, {
        headers: this.getHeaders()
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('insta_dl_token');
        try {
          await this.autoPair();
          response = await fetch(`${this.baseUrl}/api/downloads/recent`, {
            headers: this.getHeaders()
          });
        } catch {}
      }

      if (!response.ok) return [];
      const data = await response.json();
      return (data.downloads || []).map((item: any) => ({
        id: item.id,
        url: '',
        filename: item.filename,
        filepath: item.filepath,
        sizeFormatted: item.sizeFormatted,
        isAudio: item.isAudio,
        isVideo: item.isVideo,
        isImage: item.isImage,
        isZip: item.isZip,
        platform: item.platform,
        timestamp: item.timestamp || Date.now(),
        success: true
      }));
    } catch (e) {
      console.warn('Failed to fetch recent downloads from helper:', e);
      return [];
    }
  }

  async triggerBrowserDownload(filename: string): Promise<boolean> {
    try {
      if (!filename || typeof filename !== 'string') return false;
      const token = localStorage.getItem('insta_dl_token') || '';
      const streamUrl = `${this.baseUrl}/api/file/download/${encodeURIComponent(filename)}${token ? `?token=${token}` : ''}`;

      // 1. Primary: fetch as blob and trigger download via object URL (seamless browser download)
      try {
        const response = await fetch(streamUrl);
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            try {
              document.body.removeChild(link);
              window.URL.revokeObjectURL(blobUrl);
            } catch {}
          }, 10000);
          return true;
        }
      } catch (blobErr) {
        console.warn('Blob stream fallback, attempting isolated frame:', blobErr);
      }

      // 2. Safe Fallback: Hidden isolated iframe (NEVER navigates top window!)
      try {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.top = '-9999px';
        iframe.style.left = '-9999px';
        iframe.style.width = '1px';
        iframe.style.height = '1px';
        iframe.style.opacity = '0';
        iframe.style.border = 'none';
        iframe.src = streamUrl;
        document.body.appendChild(iframe);
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {}
        }, 30000);
        return true;
      } catch (frameErr) {
        console.warn('Iframe download fallback failed:', frameErr);
      }

      // 3. Last resort fallback: target="_blank" anchor (opens in background tab, NEVER replaces current page!)
      const a = document.createElement('a');
      a.href = streamUrl;
      a.download = filename;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { document.body.removeChild(a); } catch {}
      }, 2000);
      return true;
    } catch (e) {
      console.error('Failed to trigger browser download:', e);
      return false;
    }
  }

  async getMediaInfo(url: string): Promise<MediaInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/info`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ url })
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      console.warn('Failed to fetch media info:', e);
      return null;
    }
  }
}

export const helperApi = new HelperApi();
