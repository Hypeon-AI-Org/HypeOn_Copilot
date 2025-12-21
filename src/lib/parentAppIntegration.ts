/**
 * Integration utilities for parent web app (app.hypeon.ai)
 */

import { getToken, listenForTokenUpdates, requestTokenFromParent } from './auth';

const PARENT_APP_ORIGIN = 'https://app.hypeon.ai';

/**
 * Initialize integration with parent app
 * Call this in your root layout or app component
 */
export function initParentAppIntegration() {
  // Request token if in iframe
  if (typeof window !== 'undefined' && window !== window.parent) {
    requestTokenFromParent();
  }
  
  // Listen for token updates
  return listenForTokenUpdates((token) => {
    if (token) {
      console.log('Token updated from parent app');
      // Token is automatically available via getToken()
    }
  });
}

/**
 * Check if running as sub-app (in iframe or embedded)
 */
export function isSubApp(): boolean {
  if (typeof window === 'undefined') return false;
  return window !== window.parent;
}

/**
 * Get parent app origin
 */
export function getParentAppOrigin(): string {
  return PARENT_APP_ORIGIN;
}

/**
 * Get parent app URL (for redirects)
 */
export function getParentAppUrl(): string {
  return PARENT_APP_ORIGIN;
}

