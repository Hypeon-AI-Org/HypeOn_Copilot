/**
 * Production configuration and feature flags
 */

export const productionConfig = {
  // Feature flags
  features: {
    enableRateLimiting: process.env.NEXT_PUBLIC_ENABLE_RATE_LIMITING !== 'false',
    enablePerformanceMonitoring: process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING !== 'false',
    enableErrorTracking: process.env.NEXT_PUBLIC_ENABLE_ERROR_TRACKING !== 'false',
    enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  },

  // API configuration
  api: {
    timeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '30000', 10),
    retryAttempts: parseInt(process.env.NEXT_PUBLIC_API_RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.NEXT_PUBLIC_API_RETRY_DELAY || '1000', 10),
  },

  // Performance settings
  performance: {
    debounceMs: parseInt(process.env.NEXT_PUBLIC_DEBOUNCE_MS || '300', 10),
    throttleMs: parseInt(process.env.NEXT_PUBLIC_THROTTLE_MS || '1000', 10),
    maxConcurrentRequests: parseInt(process.env.NEXT_PUBLIC_MAX_CONCURRENT_REQUESTS || '5', 10),
  },

  // Caching settings
  cache: {
    sessionCacheTTL: parseInt(process.env.NEXT_PUBLIC_SESSION_CACHE_TTL || '300000', 10), // 5 minutes
    userInfoCacheTTL: parseInt(process.env.NEXT_PUBLIC_USER_INFO_CACHE_TTL || '600000', 10), // 10 minutes
  },

  // Environment
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
};

