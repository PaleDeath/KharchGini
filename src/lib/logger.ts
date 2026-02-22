/**
 * Secure logging utility to prevent sensitive data exposure in production
 * 
 * Usage:
 * - Use logger.debug() for development-only logs
 * - Use logger.info() for informational logs
 * - Use logger.warn() for warnings
 * - Use logger.error() for errors (always logged)
 * - Use logger.sanitize() to redact sensitive fields from objects
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

// Sensitive field names to redact
const SENSITIVE_KEYS = [
  'password',
  'apiKey',
  'api_key',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'idToken',
  'id_token',
  'privateKey',
  'private_key',
  'clientSecret',
  'client_secret',
  'secret',
  'credentials',
  'authorization',
  'cookie',
  'sessionId',
  'session_id',
  'ssn',
  'creditCard',
  'credit_card',
];

/**
 * Recursively redact sensitive fields from an object
 */
function sanitizeObject(obj: any, depth = 0): any {
  // Prevent infinite recursion
  if (depth > 10) return '[Max depth reached]';
  
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }
  
  // Handle objects
  if (typeof obj === 'object') {
    const sanitized: any = {};
    
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const lowerKey = key.toLowerCase();
        
        // Check if this key should be redacted
        const shouldRedact = SENSITIVE_KEYS.some(sensitiveKey => 
          lowerKey.includes(sensitiveKey.toLowerCase())
        );
        
        if (shouldRedact) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          sanitized[key] = sanitizeObject(obj[key], depth + 1);
        } else {
          sanitized[key] = obj[key];
        }
      }
    }
    
    return sanitized;
  }
  
  return obj;
}

/**
 * Format log arguments for output
 */
function formatArgs(...args: any[]): any[] {
  return args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      return sanitizeObject(arg);
    }
    return arg;
  });
}

/**
 * Add timestamp to logs in production
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Logger interface
 */
export const logger = {
  /**
   * Debug logs - only shown in development
   */
  debug(...args: any[]): void {
    if (isDevelopment || isTest) {
      const formatted = formatArgs(...args);
      console.log(`[DEBUG ${getTimestamp()}]`, ...formatted);
    }
  },

  /**
   * Info logs - shown in development, minimal in production
   */
  info(...args: any[]): void {
    if (isDevelopment || isTest) {
      const formatted = formatArgs(...args);
      console.info(`[INFO ${getTimestamp()}]`, ...formatted);
    }
  },

  /**
   * Warning logs - always shown but sanitized
   */
  warn(...args: any[]): void {
    const formatted = formatArgs(...args);
    console.warn(`[WARN ${getTimestamp()}]`, ...formatted);
  },

  /**
   * Error logs - always shown but sanitized
   * In production, should be sent to error tracking service
   */
  error(...args: any[]): void {
    const formatted = formatArgs(...args);
    console.error(`[ERROR ${getTimestamp()}]`, ...formatted);
    
    // TODO: Send to error tracking service (Sentry) in production
    if (!isDevelopment && !isTest && typeof window === 'undefined') {
      // Example: Sentry.captureException(args[0]);
    }
  },

  /**
   * Manually sanitize an object for logging
   */
  sanitize(obj: any): any {
    return sanitizeObject(obj);
  },

  /**
   * Log with custom level
   */
  log(level: 'debug' | 'info' | 'warn' | 'error', ...args: any[]): void {
    switch (level) {
      case 'debug':
        this.debug(...args);
        break;
      case 'info':
        this.info(...args);
        break;
      case 'warn':
        this.warn(...args);
        break;
      case 'error':
        this.error(...args);
        break;
    }
  },
};

/**
 * Create a namespaced logger for a specific module
 */
export function createLogger(namespace: string) {
  return {
    debug: (...args: any[]) => logger.debug(`[${namespace}]`, ...args),
    info: (...args: any[]) => logger.info(`[${namespace}]`, ...args),
    warn: (...args: any[]) => logger.warn(`[${namespace}]`, ...args),
    error: (...args: any[]) => logger.error(`[${namespace}]`, ...args),
    sanitize: (obj: any) => logger.sanitize(obj),
  };
}

// Export for testing
export { sanitizeObject, SENSITIVE_KEYS };
