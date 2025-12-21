/**
 * Hook to fetch and manage user information from backend
 * Uses user info from URL/localStorage if available, otherwise fetches from backend
 */

import { useState, useEffect, useCallback } from 'react';
import { ChatService, UserInfo } from '@/lib/chatService';
import { getToken, getUserFromStorage } from '@/lib/auth';

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

    // First, check if user info is available from URL/localStorage
    const storedUser = getUserFromStorage();
    if (storedUser) {
      // Convert stored user to UserInfo format (with defaults for missing fields)
      const partialUserInfo: UserInfo = {
        user_id: storedUser.id,
        name: storedUser.name,
        email: storedUser.email,
        role: 'user',
        plan: 'basic',
        limits: {
          max_tokens: 10000,
          max_turns: 50,
          max_requests_per_minute: 60,
          max_sessions: 100,
        },
      };
      setUserInfo(partialUserInfo);
      
      // Still try to fetch full info from backend in background
      setLoading(true);
      try {
        const chatService = new ChatService(API_BASE_URL, token);
        const fullInfo = await chatService.getUserInfo();
        setUserInfo(fullInfo); // Replace with full info from backend
      } catch (err: any) {
        // If backend fetch fails, keep using stored user info
        console.warn('Failed to fetch full user info from backend, using stored info:', err);
      } finally {
        setLoading(false);
      }
      return;
    }

    // No stored user info, fetch from backend
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

