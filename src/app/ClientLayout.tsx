"use client";

import { useEffect, useState } from 'react';
import { initParentAppIntegration, getParentAppOrigin } from '@/lib/parentAppIntegration';
import { getToken } from '@/lib/auth';

const PARENT_APP_URL = getParentAppOrigin();

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Initialize parent app integration
    const cleanup = initParentAppIntegration();

    // Check if we're in an iframe
    const isInIframe = typeof window !== 'undefined' && window !== window.parent;

    // Check for token and redirect if not found
    const checkTokenAndRedirect = () => {
      const token = getToken();
      
      if (!token) {
        // If in iframe, wait longer for token from parent app
        // If standalone, redirect immediately
        const waitTime = isInIframe ? 3000 : 1000;
        
        setTimeout(() => {
          const tokenAfterWait = getToken();
          if (!tokenAfterWait) {
            // Redirect to parent app for authentication
            window.location.href = PARENT_APP_URL;
          } else {
            setIsChecking(false);
          }
        }, waitTime);
      } else {
        setIsChecking(false);
      }
    };

    // Initial check
    checkTokenAndRedirect();

    // Also listen for token updates (in case token arrives after initial check)
    const tokenCheckInterval = setInterval(() => {
      const token = getToken();
      if (token) {
        setIsChecking(false);
        clearInterval(tokenCheckInterval);
      }
    }, 500);

    // Cleanup after max wait time
    const maxWaitTimeout = setTimeout(() => {
      const token = getToken();
      if (!token) {
        // Still no token after max wait, redirect
        window.location.href = PARENT_APP_URL;
      }
      clearInterval(tokenCheckInterval);
    }, isInIframe ? 5000 : 2000);

    return () => {
      cleanup();
      clearInterval(tokenCheckInterval);
      clearTimeout(maxWaitTimeout);
    };
  }, []);

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
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ fontSize: '1.2rem', fontWeight: '500' }}>Loading...</div>
        <div style={{ fontSize: '0.9rem', color: '#666' }}>Checking authentication...</div>
      </div>
    );
  }

  return <>{children}</>;
}

