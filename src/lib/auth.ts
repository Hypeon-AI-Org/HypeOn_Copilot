/**
 * Authentication utilities for JWT token management
 * Supports integration with parent web app (app.hypeon.ai)
 */

const TOKEN_KEY = 'jwt_token';
const PARENT_TOKEN_KEY = 'auth_token';
const PARENT_TOKEN_KEY_ALT = 'access_token';
const COOKIE_TOKEN_KEY = 'auth_token'; // Cookie name used by parent app

/**
 * Get cookie value by name
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

/**
 * Get JWT token from multiple sources (parent app compatible)
 * Priority:
 * 1. URL query parameter (from parent app redirect)
 * 2. Cookie from parent app (app.hypeon.ai) - domain=.hypeon.ai
 * 3. localStorage access_token (from URL param)
 * 4. Custom key (if provided)
 * 5. localStorage/sessionStorage
 * 6. Environment variable
 */
export function getToken(customKey?: string): string | null {
  if (typeof window === 'undefined') return null;
  
  // Check URL query parameters first (highest priority - from parent app redirect)
  if (typeof window !== 'undefined' && window.location) {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) return urlToken;
  }
  
  // Check environment variable for custom key
  const envTokenKey = process.env.NEXT_PUBLIC_TOKEN_KEY;
  const tokenKey = customKey || envTokenKey;
  
  // Check access_token in localStorage (set from URL param)
  const accessToken = localStorage.getItem('access_token');
  if (accessToken) return accessToken;
  
  // Try to get from cookie (shared across subdomains)
  // Parent app should set cookie with domain=.hypeon.ai
  const cookieToken = getCookie(COOKIE_TOKEN_KEY) || 
                       getCookie('access_token') || 
                       getCookie('jwt_token');
  if (cookieToken) return cookieToken;
  
  // Check custom key (if provided)
  if (tokenKey) {
    const customToken = localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
    if (customToken) return customToken;
  }
  
  // Check parent app's common token keys in localStorage
  const parentToken = 
    localStorage.getItem(PARENT_TOKEN_KEY) || 
    sessionStorage.getItem(PARENT_TOKEN_KEY) ||
    localStorage.getItem(PARENT_TOKEN_KEY_ALT) || 
    sessionStorage.getItem(PARENT_TOKEN_KEY_ALT);
  if (parentToken) return parentToken;
  
  // Check default key
  const defaultToken = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  if (defaultToken) return defaultToken;
  
  // Fallback to environment variable
  return process.env.NEXT_PUBLIC_JWT_TOKEN || null;
}

/**
 * Set JWT token in storage
 */
export function setToken(token: string, useSessionStorage = false): void {
  if (typeof window === 'undefined') return;
  const storage = useSessionStorage ? sessionStorage : localStorage;
  storage.setItem(TOKEN_KEY, token);
}

/**
 * Remove JWT token from storage
 */
export function removeToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

/**
 * Get token payload (decoded)
 */
export function getTokenPayload(token: string): any | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

/**
 * Get token expiration date
 */
export function getTokenExpirationDate(token: string): Date | null {
  try {
    const payload = getTokenPayload(token);
    if (payload && payload.exp) {
      return new Date(payload.exp * 1000);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get token expiration info (for debugging/verification)
 */
export function getTokenInfo(token: string): {
  valid: boolean;
  expired: boolean;
  expirationDate: Date | null;
  expirationTimestamp: number | null;
  payload: any | null;
} | null {
  try {
    const payload = getTokenPayload(token);
    if (!payload) {
      return {
        valid: false,
        expired: true,
        expirationDate: null,
        expirationTimestamp: null,
        payload: null,
      };
    }

    const expTimestamp = payload.exp;
    const expirationDate = expTimestamp ? new Date(expTimestamp * 1000) : null;
    const expired = expTimestamp ? expTimestamp * 1000 < Date.now() : true;

    return {
      valid: true,
      expired,
      expirationDate,
      expirationTimestamp: expTimestamp || null,
      payload,
    };
  } catch {
    return {
      valid: false,
      expired: true,
      expirationDate: null,
      expirationTimestamp: null,
      payload: null,
    };
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  return !isTokenExpired(token);
}

/**
 * Listen for token updates from parent app
 * Works for:
 * - postMessage (if embedded in iframe)
 * - Storage events (if same origin)
 * - Cookie changes (polling)
 */
export function listenForTokenUpdates(callback: (token: string | null) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  
  let lastToken = getToken();
  
  // Listen for postMessage from parent (if in iframe)
  const messageHandler = (event: MessageEvent) => {
    // Verify origin for security
    if (event.origin !== 'https://app.hypeon.ai') return;
    
    if (event.data?.type === 'token_update' && event.data?.token) {
      callback(event.data.token);
      lastToken = event.data.token;
    }
  };
  
  window.addEventListener('message', messageHandler);
  
  // Listen for storage events (if same origin - won't work across subdomains)
  const storageHandler = (e: StorageEvent) => {
    if (e.key === PARENT_TOKEN_KEY || e.key === PARENT_TOKEN_KEY_ALT || e.key === TOKEN_KEY) {
      callback(e.newValue);
      lastToken = e.newValue;
    }
  };
  
  window.addEventListener('storage', storageHandler);
  
  // Poll for cookie changes (since storage events don't work across subdomains)
  const cookiePollInterval = setInterval(() => {
    const currentToken = getToken();
    if (currentToken !== lastToken) {
      callback(currentToken);
      lastToken = currentToken;
    }
  }, 1000); // Check every second
  
  // Return cleanup function
  return () => {
    window.removeEventListener('message', messageHandler);
    window.removeEventListener('storage', storageHandler);
    clearInterval(cookiePollInterval);
  };
}

/**
 * Request token from parent app (if in iframe)
 */
export function requestTokenFromParent(): void {
  if (typeof window === 'undefined' || window === window.parent) return;
  
  // Request token from parent window
  window.parent.postMessage({ 
    type: 'request_token',
    source: 'copilot.hypeon.ai'
  }, 'https://app.hypeon.ai');
}

/**
 * Get user info from localStorage (set from URL parameter)
 */
export function getUserFromStorage(): { id: string; name: string; email: string } | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      return JSON.parse(userJson);
    }
  } catch (e) {
    console.error('Failed to parse user from storage:', e);
  }
  
  return null;
}

/**
 * Set user info in storage
 */
export function setUserInStorage(user: { id: string; name: string; email: string }): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('user', JSON.stringify(user));
}

/**
 * Remove user info from storage
 */
export function removeUserFromStorage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('user');
}
