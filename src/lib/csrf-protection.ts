import { headers } from 'next/headers';
import { logger } from './logger';

/**
 * CSRF Protection Middleware
 * 
 * Validates the origin/referer header to prevent Cross-Site Request Forgery attacks
 * on state-changing server actions and API routes.
 * 
 * Usage in server actions:
 * ```typescript
 * export async function myServerAction() {
 *   await validateOrigin();
 *   // ... your logic
 * }
 * ```
 * 
 * Usage in API routes:
 * ```typescript
 * export async function POST(request: Request) {
 *   await validateOriginFromRequest(request);
 *   // ... your logic
 * }
 * ```
 */

/**
 * Get allowed origins based on environment
 */
function getAllowedOrigins(): string[] {
  const allowedOrigins: string[] = [];
  
  // Production URL from environment
  if (process.env.NEXT_PUBLIC_APP_URL) {
    allowedOrigins.push(process.env.NEXT_PUBLIC_APP_URL);
  }
  
  // Vercel deployment URLs
  if (process.env.VERCEL_URL) {
    allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
  }
  
  // Development URLs
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:9002');
    allowedOrigins.push('http://localhost:3000');
    allowedOrigins.push('http://127.0.0.1:9002');
    allowedOrigins.push('http://127.0.0.1:3000');
  }
  
  return allowedOrigins;
}

/**
 * Validate origin from Next.js headers() (for Server Actions)
 */
export async function validateOrigin(): Promise<void> {
  try {
    const headersList = headers();
    const origin = headersList.get('origin');
    const referer = headersList.get('referer');
    const host = headersList.get('host');
    
    logger.debug('CSRF validation:', { origin, referer, host });
    
    // Allow same-origin requests (referer matches host)
    if (referer && host) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.host === host) {
          logger.debug('CSRF: Same-origin request allowed');
          return;
        }
      } catch (e) {
        // Invalid referer URL
      }
    }
    
    // Get allowed origins
    const allowedOrigins = getAllowedOrigins();
    
    if (allowedOrigins.length === 0) {
      logger.warn('CSRF: No allowed origins configured');
      // In development, allow requests even if no origins configured
      if (process.env.NODE_ENV === 'development') {
        return;
      }
      throw new Error('CSRF validation failed: No allowed origins configured');
    }
    
    // Check origin header first
    if (origin) {
      const isAllowed = allowedOrigins.some(allowed => origin.startsWith(allowed));
      if (isAllowed) {
        logger.debug('CSRF: Origin header validated');
        return;
      }
    }
    
    // Check referer header as fallback
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
        const isAllowed = allowedOrigins.some(allowed => refererOrigin.startsWith(allowed));
        if (isAllowed) {
          logger.debug('CSRF: Referer header validated');
          return;
        }
      } catch (e) {
        logger.error('CSRF: Invalid referer URL', e);
      }
    }
    
    // If neither origin nor referer is present or valid, reject
    logger.warn('CSRF validation failed:', {
      origin,
      referer,
      allowedOrigins,
    });
    
    throw new Error('CSRF validation failed: Invalid or missing origin/referer header');
  } catch (error) {
    // Re-throw validation errors
    if (error instanceof Error && error.message.includes('CSRF')) {
      throw error;
    }
    
    // Log unexpected errors
    logger.error('CSRF validation error:', error);
    throw new Error('CSRF validation failed: Internal error');
  }
}

/**
 * Validate origin from Request object (for API Routes)
 */
export async function validateOriginFromRequest(request: Request): Promise<void> {
  try {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const host = request.headers.get('host');
    
    logger.debug('CSRF validation (API):', { origin, referer, host });
    
    // Allow same-origin requests
    if (referer && host) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.host === host) {
          logger.debug('CSRF: Same-origin API request allowed');
          return;
        }
      } catch (e) {
        // Invalid referer URL
      }
    }
    
    const allowedOrigins = getAllowedOrigins();
    
    if (allowedOrigins.length === 0) {
      logger.warn('CSRF: No allowed origins configured');
      if (process.env.NODE_ENV === 'development') {
        return;
      }
      throw new Error('CSRF validation failed: No allowed origins configured');
    }
    
    // Check origin header
    if (origin) {
      const isAllowed = allowedOrigins.some(allowed => origin.startsWith(allowed));
      if (isAllowed) {
        logger.debug('CSRF: Origin header validated (API)');
        return;
      }
    }
    
    // Check referer header
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
        const isAllowed = allowedOrigins.some(allowed => refererOrigin.startsWith(allowed));
        if (isAllowed) {
          logger.debug('CSRF: Referer header validated (API)');
          return;
        }
      } catch (e) {
        logger.error('CSRF: Invalid referer URL (API)', e);
      }
    }
    
    logger.warn('CSRF validation failed (API):', {
      origin,
      referer,
      allowedOrigins,
    });
    
    throw new Error('CSRF validation failed: Invalid or missing origin/referer header');
  } catch (error) {
    if (error instanceof Error && error.message.includes('CSRF')) {
      throw error;
    }
    
    logger.error('CSRF validation error (API):', error);
    throw new Error('CSRF validation failed: Internal error');
  }
}

/**
 * Check if a specific origin is allowed
 */
export function isOriginAllowed(origin: string): boolean {
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.some(allowed => origin.startsWith(allowed));
}

/**
 * Get list of allowed origins (for debugging)
 */
export function getConfiguredOrigins(): string[] {
  return getAllowedOrigins();
}
