"use client";

import { useEffect, useState } from 'react';
import { initParentAppIntegration, getParentAppOrigin } from '@/lib/parentAppIntegration';
import { getToken, setToken, setUserInStorage } from '@/lib/auth';
import { ThemeProvider } from "../context/ThemeContext";
import BetaVersionModal from "../components/BetaVersionModal";

const PARENT_APP_URL = 'https://app.hypeon.ai';
const BETA_MODAL_SEEN_KEY = 'hypeon_copilot_beta_modal_seen';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [isChecking, setIsChecking] = useState(true);
  const [showBetaModal, setShowBetaModal] = useState(false);

  useEffect(() => {
    // Read token and user from URL query parameters (from parent app)
    let hasNewToken = false;
    
    if (typeof window !== 'undefined' && window.location) {
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      const urlUser = urlParams.get('user');

      // Store token from URL if provided
      if (urlToken) {
        setToken(urlToken);
        // Also store in access_token key for compatibility
        localStorage.setItem('access_token', urlToken);
        hasNewToken = true;
      }

      // Store user info from URL if provided
      if (urlUser) {
        try {
          const user = JSON.parse(decodeURIComponent(urlUser));
          setUserInStorage(user);
        } catch (e) {
          console.error('Failed to parse user info from URL:', e);
        }
      }

      // Clean up URL parameters after reading
      if (urlToken || urlUser) {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('token');
        newUrl.searchParams.delete('user');
        // Use window.history to avoid router issues
        window.history.replaceState({}, '', newUrl.pathname + (newUrl.search || ''));
      }
    }

    // Initialize parent app integration
    const cleanup = initParentAppIntegration();

    // Check if we're in an iframe
    const isInIframe = typeof window !== 'undefined' && window !== window.parent;

    // In production, auth is always required
    // Only allow bypass in development with explicit flag
    const isAuthDisabled = process.env.NODE_ENV === 'development' && 
                           process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
    const hasEnvToken = !!process.env.NEXT_PUBLIC_JWT_TOKEN;

    // Skip all auth checks ONLY in development with explicit flag
    // Production always requires authentication
    if (isAuthDisabled && process.env.NODE_ENV === 'development') {
      setIsChecking(false);
      return;
    }

    // Check for token and redirect if not found
    const checkTokenAndRedirect = () => {
      const token = getToken();
      
      if (!token && !hasEnvToken) {
        // If in iframe, wait longer for token from parent app
        // If standalone, redirect more quickly
        const waitTime = isInIframe ? 2000 : 500;
        
        setTimeout(() => {
          const tokenAfterWait = getToken();
          if (!tokenAfterWait && !hasEnvToken) {
            // Redirect to app.hypeon.ai for authentication
            window.location.href = PARENT_APP_URL;
            return;
          } else {
            setIsChecking(false);
          }
        }, waitTime);
      } else {
        setIsChecking(false);
      }
    };

    // Initial check (after URL params are processed)
    checkTokenAndRedirect();

    // Also listen for token updates (in case token arrives after initial check)
    const tokenCheckInterval = setInterval(() => {
      const token = getToken();
      if (token || hasEnvToken) {
        setIsChecking(false);
        clearInterval(tokenCheckInterval);
      }
    }, 500);

    // Cleanup after max wait time
    const maxWaitTimeout = setTimeout(() => {
      const token = getToken();
      if (!token && !hasEnvToken) {
        // Still no token after max wait, redirect to app.hypeon.ai
        window.location.href = PARENT_APP_URL;
      }
      clearInterval(tokenCheckInterval);
    }, isInIframe ? 3000 : 1500);

    return () => {
      cleanup();
      clearInterval(tokenCheckInterval);
      clearTimeout(maxWaitTimeout);
    };
  }, []);

  // Show beta modal after authentication check completes
  useEffect(() => {
    if (isChecking) return; // Wait for auth check to complete

    // Check if user has seen the beta modal (persistent across sessions)
    const hasSeenBetaModal = typeof window !== 'undefined' && 
                             localStorage.getItem(BETA_MODAL_SEEN_KEY) === 'true';
    
    // Check if modal was shown in this session
    const sessionKey = 'hypeon_copilot_beta_modal_session';
    const shownThisSession = typeof window !== 'undefined' && 
                             sessionStorage.getItem(sessionKey) === 'true';
    
    // Check if there's a token (user is logged in)
    const token = getToken();
    const hasToken = !!token || !!process.env.NEXT_PUBLIC_JWT_TOKEN;
    
    // Show beta modal if:
    // 1. User hasn't seen it before (first visit), OR
    // 2. User is logged in and hasn't seen it this session
    if ((!hasSeenBetaModal || (hasToken && !shownThisSession)) && !showBetaModal) {
      // Wait a bit for the page to load before showing modal
      const timer = setTimeout(() => {
        setShowBetaModal(true);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(sessionKey, 'true');
        }
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [isChecking, showBetaModal]);

  // Show loading state while checking token
  if (isChecking) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem',
        fontFamily: 'var(--font-geist-sans), sans-serif'
      }}>
        <div style={{ fontSize: '1.2rem', fontWeight: '500' }}>Loading...</div>
        <div style={{ fontSize: '0.9rem', color: '#666' }}>Checking authentication...</div>
      </div>
    );
  }

  const handleCloseBetaModal = () => {
    setShowBetaModal(false);
    // Mark as seen in localStorage (persistent) and sessionStorage (this session)
    if (typeof window !== 'undefined') {
      localStorage.setItem(BETA_MODAL_SEEN_KEY, 'true');
      sessionStorage.setItem('hypeon_copilot_beta_modal_session', 'true');
    }
  };

  return (
    <ThemeProvider>
      {children}
      {showBetaModal && <BetaVersionModal onClose={handleCloseBetaModal} />}
    </ThemeProvider>
  );
}