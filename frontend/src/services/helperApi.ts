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
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Helper not healthy');
    return response.json();
  }

  async pair(code: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/pair/verify`, {
      method: 'POST',
      headers: this.getHeaders(),
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
    const response = await fetch(`${this.baseUrl}/api/download`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ 
        url,
        format_type: formatType,
        quality
      })
    });
    
    if (response.status === 401 || response.status === 403) {
      throw new Error('UNAUTHORIZED');
    }
    
    if (!response.ok) throw new Error('Failed to start download');
    const data: HelperDownloadResponse = await response.json();
    return data.downloadId;
  }

  async getDownloadStatus(downloadId: string): Promise<HelperStatusResponse> {
    const response = await fetch(`${this.baseUrl}/api/download/${downloadId}/status`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error('Failed to get status');
    return response.json();
  }

  async cancelDownload(downloadId: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/download/${downloadId}/cancel`, {
      method: 'POST',
      headers: this.getHeaders()
    });
  }
}

export const helperApi = new HelperApi();
