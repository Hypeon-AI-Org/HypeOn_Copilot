/**
 * Client-side rate limiting utilities
 * Prevents excessive API calls and improves performance
 */

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private options: RateLimitOptions;

  constructor(options: RateLimitOptions = { maxRequests: 10, windowMs: 60000 }) {
    this.options = options;
  }

  /**
   * Check if request is allowed
   * @param key - Unique key for the rate limit (e.g., user ID, IP, endpoint)
   * @returns true if request is allowed, false if rate limited
   */
  isAllowed(key: string = 'default'): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove requests outside the time window
    const validRequests = requests.filter(timestamp => now - timestamp < this.options.windowMs);
    
    if (validRequests.length >= this.options.maxRequests) {
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return true;
  }

  /**
   * Get time until next request is allowed (in ms)
   */
  getTimeUntilNext(key: string = 'default'): number {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(timestamp => now - timestamp < this.options.windowMs);
    
    if (validRequests.length < this.options.maxRequests) {
      return 0;
    }
    
    // Return time until oldest request expires
    const oldestRequest = Math.min(...validRequests);
    return this.options.windowMs - (now - oldestRequest);
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string = 'default'): void {
    this.requests.delete(key);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.requests.clear();
  }
}

// Global rate limiter instances
export const chatRateLimiter = new RateLimiter({
  maxRequests: 5, // 5 requests per minute for chat
  windowMs: 60000
});

export const sessionRateLimiter = new RateLimiter({
  maxRequests: 20, // 20 requests per minute for session operations
  windowMs: 60000
});

export const generalRateLimiter = new RateLimiter({
  maxRequests: 30, // 30 requests per minute for general API calls
  windowMs: 60000
});

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  let lastCall = 0;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= waitMs) {
      lastCall = now;
      func.apply(this, args);
    } else {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        lastCall = Date.now();
        func.apply(this, args);
      }, waitMs - timeSinceLastCall);
    }
  };
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, waitMs);
  };
}

