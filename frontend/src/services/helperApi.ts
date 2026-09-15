import { HelperHealthResponse, HelperStatusResponse, HelperDownloadResponse } from '../types';

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

  async startDownload(url: string, formatType: string = 'video', quality: string = 'best'): Promise<string> {
    let response = await fetch(`${this.baseUrl}/api/download`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ 
        url,
        format_type: formatType,
        quality
      })
    });
    
    // Auto-repair on 401/403 (token expired or invalidated)
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('insta_dl_token');
      try {
        await this.autoPair();
        response = await fetch(`${this.baseUrl}/api/download`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ 
            url,
            format_type: formatType,
            quality
          })
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

  async triggerBrowserDownload(filename: string): Promise<boolean> {
    try {
      const token = localStorage.getItem('insta_dl_token') || '';
      const streamUrl = `${this.baseUrl}/api/file/download/${encodeURIComponent(filename)}${token ? `?token=${token}` : ''}`;

      // Primary: fetch as blob and trigger download via object URL (seamless browser download)
      try {
        const response = await fetch(streamUrl);
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
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
        console.warn('Blob stream fallback:', blobErr);
      }

      // Secondary fallback: direct anchor click
      const a = document.createElement('a');
      a.href = streamUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { document.body.removeChild(a); } catch {}
      }, 1000);
      return true;
    } catch (e) {
      console.error('Failed to trigger browser download:', e);
      return false;
    }
  }

  async getMediaInfo(url: string): Promise<{
    title?: string;
    thumbnail?: string;
    duration?: number;
    uploader?: string;
    platform?: string;
    playable_url?: string | null;
    media_type?: string;
    error?: string;
  } | null> {
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
