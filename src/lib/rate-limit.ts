/**
 * Rate Limiting Utility
 * 
 * Provides rate limiting functionality to protect API routes and server actions
 * from abuse and DDoS attacks.
 * 
 * Uses Upstash Redis for distributed rate limiting.
 * 
 * Usage:
 * ```typescript
 * import { apiRateLimiter, serverActionRateLimiter } from '@/lib/rate-limit';
 * 
 * // In API route
 * const { success } = await apiRateLimiter.limit(userId);
 * if (!success) {
 *   return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
 * }
 * 
 * // In server action
 * const { success } = await serverActionRateLimiter.limit(userId);
 * if (!success) {
 *   throw new Error('Too many requests');
 * }
 * ```
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { logger } from './logger';

/**
 * Check if rate limiting is configured
 */
function isRateLimitingConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

/**
 * Initialize Redis client
 */
function getRedisClient(): Redis | null {
  if (!isRateLimitingConfigured()) {
    logger.warn(
      'Rate limiting not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in environment variables.'
    );
    return null;
  }

  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    logger.debug('Redis client initialized for rate limiting');
    return redis;
  } catch (error) {
    logger.error('Failed to initialize Redis client:', error);
    return null;
  }
}

// Lazy initialization of Redis client
let redisClient: Redis | null | undefined;

function getOrCreateRedisClient(): Redis | null {
  if (redisClient === undefined) {
    redisClient = getRedisClient();
  }
  return redisClient;
}

/**
 * API Rate Limiter
 * 10 requests per hour per user
 * 
 * Use for expensive operations like:
 * - Speech-to-text API
 * - AI/LLM API calls
 * - External service integrations
 */
export const apiRateLimiter = (() => {
  const redis = getOrCreateRedisClient();

  if (!redis) {
    // Fallback: In-memory rate limiting for development (not distributed)
    logger.warn('Using in-memory rate limiting (development only)');
    
    // Simple in-memory cache
    const cache = new Map<string, { count: number; resetTime: number }>();
    
    return {
      limit: async (identifier: string) => {
        const now = Date.now();
        const entry = cache.get(identifier);
        
        // Reset if time window passed
        if (!entry || now > entry.resetTime) {
          cache.set(identifier, { count: 1, resetTime: now + 3600 * 1000 }); // 1 hour
          return { success: true, limit: 10, remaining: 9, reset: now + 3600 * 1000 };
        }
        
        // Increment count
        if (entry.count >= 10) {
          return { success: false, limit: 10, remaining: 0, reset: entry.resetTime };
        }
        
        entry.count++;
        cache.set(identifier, entry);
        
        return {
          success: true,
          limit: 10,
          remaining: 10 - entry.count,
          reset: entry.resetTime,
        };
      },
    };
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'), // 10 requests per hour
    analytics: true,
    prefix: 'ratelimit:api',
  });
})();

/**
 * Server Action Rate Limiter
 * 100 requests per minute per user
 * 
 * Use for:
 * - Transaction creation/updates
 * - Goal operations
 * - Budget calculations
 */
export const serverActionRateLimiter = (() => {
  const redis = getOrCreateRedisClient();

  if (!redis) {
    const cache = new Map<string, { count: number; resetTime: number }>();
    
    return {
      limit: async (identifier: string) => {
        const now = Date.now();
        const entry = cache.get(identifier);
        
        if (!entry || now > entry.resetTime) {
          cache.set(identifier, { count: 1, resetTime: now + 60 * 1000 }); // 1 minute
          return { success: true, limit: 100, remaining: 99, reset: now + 60 * 1000 };
        }
        
        if (entry.count >= 100) {
          return { success: false, limit: 100, remaining: 0, reset: entry.resetTime };
        }
        
        entry.count++;
        cache.set(identifier, entry);
        
        return {
          success: true,
          limit: 100,
          remaining: 100 - entry.count,
          reset: entry.resetTime,
        };
      },
    };
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
    analytics: true,
    prefix: 'ratelimit:action',
  });
})();

/**
 * Auth Rate Limiter
 * 5 attempts per 15 minutes per IP
 * 
 * Use for:
 * - Login attempts
 * - Signup attempts
 * - Password reset requests
 */
export const authRateLimiter = (() => {
  const redis = getOrCreateRedisClient();

  if (!redis) {
    const cache = new Map<string, { count: number; resetTime: number }>();
    
    return {
      limit: async (identifier: string) => {
        const now = Date.now();
        const entry = cache.get(identifier);
        
        if (!entry || now > entry.resetTime) {
          cache.set(identifier, { count: 1, resetTime: now + 15 * 60 * 1000 }); // 15 minutes
          return { success: true, limit: 5, remaining: 4, reset: now + 15 * 60 * 1000 };
        }
        
        if (entry.count >= 5) {
          return { success: false, limit: 5, remaining: 0, reset: entry.resetTime };
        }
        
        entry.count++;
        cache.set(identifier, entry);
        
        return {
          success: true,
          limit: 5,
          remaining: 5 - entry.count,
          reset: entry.resetTime,
        };
      },
    };
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'), // 5 attempts per 15 minutes
    analytics: true,
    prefix: 'ratelimit:auth',
  });
})();

/**
 * Custom Rate Limiter Factory
 * Create a custom rate limiter with specific limits
 * 
 * @param requests - Number of requests allowed
 * @param window - Time window (e.g., '1 h', '5 m', '1 d')
 * @param prefix - Prefix for rate limit keys
 */
export function createRateLimiter(
  requests: number,
  window: string,
  prefix: string = 'ratelimit:custom'
) {
  const redis = getOrCreateRedisClient();

  if (!redis) {
    logger.warn(`Custom rate limiter '${prefix}' using in-memory fallback`);
    
    const cache = new Map<string, { count: number; resetTime: number }>();
    const windowMs = parseWindowToMs(window);
    
    return {
      limit: async (identifier: string) => {
        const now = Date.now();
        const entry = cache.get(identifier);
        
        if (!entry || now > entry.resetTime) {
          cache.set(identifier, { count: 1, resetTime: now + windowMs });
          return { success: true, limit: requests, remaining: requests - 1, reset: now + windowMs };
        }
        
        if (entry.count >= requests) {
          return { success: false, limit: requests, remaining: 0, reset: entry.resetTime };
        }
        
        entry.count++;
        cache.set(identifier, entry);
        
        return {
          success: true,
          limit: requests,
          remaining: requests - entry.count,
          reset: entry.resetTime,
        };
      },
    };
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
    prefix,
  });
}

/**
 * Parse window string to milliseconds
 */
function parseWindowToMs(window: string): number {
  const match = window.match(/^(\d+)\s*([smhd])$/);
  if (!match) {
    throw new Error(`Invalid window format: ${window}. Use format like '5 m', '1 h', '1 d'`);
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
}

/**
 * Helper function to check rate limit and throw error if exceeded
 * 
 * @param rateLimiter - The rate limiter to use
 * @param identifier - Unique identifier (user ID, IP address, etc.)
 * @param errorMessage - Custom error message
 */
export async function checkRateLimit(
  rateLimiter: Awaited<ReturnType<typeof createRateLimiter>>,
  identifier: string,
  errorMessage: string = 'Rate limit exceeded. Please try again later.'
): Promise<void> {
  const result = await rateLimiter.limit(identifier);

  if (!result.success) {
    const resetDate = new Date(result.reset);
    const resetIn = Math.ceil((result.reset - Date.now()) / 1000 / 60); // minutes
    
    logger.warn('Rate limit exceeded', {
      identifier,
      limit: result.limit,
      resetIn: `${resetIn} minutes`,
    });
    
    throw new Error(`${errorMessage} (Limit: ${result.limit} requests. Try again in ${resetIn} minutes)`);
  }

  logger.debug('Rate limit check passed', {
    identifier,
    remaining: result.remaining,
    limit: result.limit,
  });
}

/**
 * Get IP address from request
 * Useful for IP-based rate limiting
 */
export function getIpFromRequest(request: Request): string {
  // Check various headers for IP address
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to a default (not ideal but better than crashing)
  return 'unknown';
}

/**
 * Check if rate limiting is enabled
 */
export function isRateLimitingEnabled(): boolean {
  return isRateLimitingConfigured();
}
