import { useState, useEffect, useCallback } from 'react';
import { helperApi } from '../services/helperApi';
import { HelperStatus } from '../types';

export function useHelperConnection() {
  const [status, setStatus] = useState<HelperStatus>({ connected: false, paired: false });

  const checkHealth = useCallback(async () => {
    try {
      const data = await helperApi.checkHealth();
      const hasToken = !!localStorage.getItem('insta_dl_token');
      setStatus({ 
        connected: true, 
        paired: hasToken,
        version: data.version,
        downloadPath: data.downloadPath
      });
    } catch (e) {
      setStatus({ connected: false, paired: false });
    }
  }, []);

  useEffect(() => {
    checkHealth();
    
    let interval: ReturnType<typeof setInterval>;
    
    const startPolling = () => {
      interval = setInterval(checkHealth, status.connected ? 30000 : 5000);
    };
    
    startPolling();
    return () => clearInterval(interval);
  }, [checkHealth, status.connected]);

  const pair = async (code: string): Promise<boolean> => {
    try {
      await helperApi.pair(code);
      await checkHealth();
      return true;
    } catch (e) {
      return false;
    }
  };

  const disconnect = () => {
    localStorage.removeItem('insta_dl_token');
    setStatus(prev => ({ ...prev, paired: false }));
  };

  return { status, pair, disconnect };
}
