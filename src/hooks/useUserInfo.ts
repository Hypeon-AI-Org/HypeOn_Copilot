/**
 * Hook to fetch and manage user information from backend
 */

import { useState, useEffect, useCallback } from 'react';
import { ChatService, UserInfo } from '@/lib/chatService';
import { getToken } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

export function useUserInfo() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserInfo = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUserInfo(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const chatService = new ChatService(API_BASE_URL, token);
      const info = await chatService.getUserInfo();
      setUserInfo(info);
    } catch (err: any) {
      // Don't show error if it's just missing auth
      if (err.message?.includes('Authentication required')) {
        setUserInfo(null);
        setError(null);
      } else {
        setError(err.message || 'Failed to load user info');
        setUserInfo(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserInfo();
  }, [fetchUserInfo]);

  // Refresh user info when token changes
  useEffect(() => {
    const checkToken = () => {
      const token = getToken();
      if (token && !userInfo) {
        fetchUserInfo();
      } else if (!token && userInfo) {
        setUserInfo(null);
      }
    };

    // Check token periodically
    const interval = setInterval(checkToken, 2000);
    return () => clearInterval(interval);
  }, [userInfo, fetchUserInfo]);

  return {
    userInfo,
    loading,
    error,
    refresh: fetchUserInfo,
  };
}

