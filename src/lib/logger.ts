/**
 * Production-ready logging utility
 * Provides structured logging with different levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment: boolean;
  private enableProductionLogs: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.enableProductionLogs = process.env.NEXT_PUBLIC_ENABLE_LOGS === 'true';
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...context,
    };

    // In development, always log to console
    if (this.isDevelopment) {
      const consoleMethod = level === 'error' ? 'error' : 
                           level === 'warn' ? 'warn' : 
                           level === 'info' ? 'info' : 'log';
      console[consoleMethod](`[${level.toUpperCase()}]`, message, context || '');
      return;
    }

    // In production, only log errors and warnings by default
    // Or if explicitly enabled
    if (this.enableProductionLogs || level === 'error' || level === 'warn') {
      // In production, you can send to external logging service
      // Example: send to your logging API
      this.sendToLoggingService(logEntry);
    }
  }

  private sendToLoggingService(logEntry: any) {
    // TODO: Implement integration with logging service
    // Examples: Sentry, LogRocket, Datadog, CloudWatch, etc.
    
    // For now, only log errors to console in production
    if (logEntry.level === 'error') {
      console.error(logEntry);
    } else if (logEntry.level === 'warn') {
      console.warn(logEntry);
    }

    // Example integration:
    // if (window.sentry && logEntry.level === 'error') {
    //   window.sentry.captureException(new Error(logEntry.message), {
    //     extra: logEntry
    //   });
    // }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    };
    this.log('error', message, errorContext);
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, durationMs: number, context?: LogContext) {
    this.log('info', `Performance: ${operation}`, {
      ...context,
      durationMs,
      operation,
    });
  }

  /**
   * Log API request
   */
  apiRequest(method: string, url: string, status?: number, durationMs?: number, context?: LogContext) {
    this.log('info', `API ${method} ${url}`, {
      ...context,
      method,
      url,
      status,
      durationMs,
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const log = {
  debug: (message: string, context?: LogContext) => logger.debug(message, context),
  info: (message: string, context?: LogContext) => logger.info(message, context),
  warn: (message: string, context?: LogContext) => logger.warn(message, context),
  error: (message: string, error?: Error | unknown, context?: LogContext) => logger.error(message, error, context),
  performance: (operation: string, durationMs: number, context?: LogContext) => logger.performance(operation, durationMs, context),
  apiRequest: (method: string, url: string, status?: number, durationMs?: number, context?: LogContext) => 
    logger.apiRequest(method, url, status, durationMs, context),
};

