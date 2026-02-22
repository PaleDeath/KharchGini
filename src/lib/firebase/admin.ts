/**
 * Firebase Admin SDK Configuration
 * 
 * This module initializes the Firebase Admin SDK for server-side operations.
 * It should ONLY be used in server-side code (Server Actions, API Routes).
 * 
 * Usage:
 * ```typescript
 * import { adminAuth, adminDb } from '@/lib/firebase/admin';
 * 
 * // Verify a Firebase ID token
 * const decodedToken = await adminAuth.verifyIdToken(idToken);
 * 
 * // Access Firestore with admin privileges
 * const snapshot = await adminDb.collection('users').doc(userId).get();
 * ```
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger';

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;

/**
 * Initialize Firebase Admin SDK
 * This function is called automatically when importing adminAuth or adminDb
 */
function initializeFirebaseAdmin(): void {
  // Check if already initialized
  const apps = getApps();
  if (apps.length > 0) {
    adminApp = apps[0];
    logger.debug('Firebase Admin SDK already initialized');
    return;
  }

  try {
    // Validate required environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      const missing = [];
      if (!projectId) missing.push('FIREBASE_PROJECT_ID');
      if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
      if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');
      
      throw new Error(
        `Firebase Admin SDK configuration incomplete. Missing: ${missing.join(', ')}. ` +
        `Please check your .env.local file or environment variables.`
      );
    }

    // Parse the private key (handle escaped newlines)
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

    // Initialize the app
    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: formattedPrivateKey,
      }),
      projectId,
    });

    logger.info('Firebase Admin SDK initialized successfully', {
      projectId,
      clientEmail: clientEmail.split('@')[0] + '@...', // Log only first part for security
    });
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK:', error);
    throw new Error(
      `Firebase Admin SDK initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get Firebase Admin Auth instance
 * Automatically initializes the Admin SDK if not already initialized
 */
function getAdminAuth(): Auth {
  if (!adminAuth) {
    initializeFirebaseAdmin();
    adminAuth = getAuth(adminApp);
    logger.debug('Firebase Admin Auth instance created');
  }
  return adminAuth;
}

/**
 * Get Firebase Admin Firestore instance
 * Automatically initializes the Admin SDK if not already initialized
 */
function getAdminDb(): Firestore {
  if (!adminDb) {
    initializeFirebaseAdmin();
    adminDb = getFirestore(adminApp);
    logger.debug('Firebase Admin Firestore instance created');
  }
  return adminDb;
}

// Export lazy-initialized instances
export { getAdminAuth as adminAuth, getAdminDb as adminDb };

/**
 * Verify a Firebase ID token and extract user information
 * 
 * @param idToken - The Firebase ID token from the client
 * @returns Decoded token with user information
 * @throws Error if token is invalid or expired
 */
export async function verifyIdToken(idToken: string) {
  try {
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(idToken, true); // checkRevoked = true
    
    logger.debug('Token verified successfully', {
      uid: decodedToken.uid,
      email: decodedToken.email,
    });
    
    return decodedToken;
  } catch (error) {
    logger.warn('Token verification failed:', error);
    
    // Provide specific error messages
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        throw new Error('Token has expired. Please log in again.');
      }
      if (error.message.includes('revoked')) {
        throw new Error('Token has been revoked. Please log in again.');
      }
      if (error.message.includes('invalid')) {
        throw new Error('Invalid token. Please log in again.');
      }
    }
    
    throw new Error('Failed to verify authentication token');
  }
}

/**
 * Extract user ID from Authorization header
 * 
 * @param authHeader - The Authorization header value (e.g., "Bearer <token>")
 * @returns User ID from the verified token
 * @throws Error if header is missing or token is invalid
 */
export async function getUserIdFromAuthHeader(authHeader: string | null): Promise<string> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const idToken = authHeader.split('Bearer ')[1];
  if (!idToken) {
    throw new Error('No token provided in Authorization header');
  }

  const decodedToken = await verifyIdToken(idToken);
  return decodedToken.uid;
}

/**
 * Get user by UID (admin operation)
 * 
 * @param uid - User ID
 * @returns User record
 */
export async function getUserByUid(uid: string) {
  try {
    const auth = getAdminAuth();
    const userRecord = await auth.getUser(uid);
    return userRecord;
  } catch (error) {
    logger.error('Failed to get user by UID:', error);
    throw new Error('Failed to retrieve user information');
  }
}

/**
 * Check if user exists
 * 
 * @param uid - User ID
 * @returns true if user exists, false otherwise
 */
export async function userExists(uid: string): Promise<boolean> {
  try {
    await getUserByUid(uid);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Delete user account (admin operation)
 * USE WITH CAUTION
 * 
 * @param uid - User ID to delete
 */
export async function deleteUser(uid: string): Promise<void> {
  try {
    const auth = getAdminAuth();
    await auth.deleteUser(uid);
    logger.info('User deleted', { uid });
  } catch (error) {
    logger.error('Failed to delete user:', error);
    throw new Error('Failed to delete user account');
  }
}

/**
 * Revoke all refresh tokens for a user (force re-login)
 * 
 * @param uid - User ID
 */
export async function revokeUserTokens(uid: string): Promise<void> {
  try {
    const auth = getAdminAuth();
    await auth.revokeRefreshTokens(uid);
    logger.info('User tokens revoked', { uid });
  } catch (error) {
    logger.error('Failed to revoke user tokens:', error);
    throw new Error('Failed to revoke user tokens');
  }
}

/**
 * Helper to check if code is running on server-side
 * Firebase Admin SDK should NEVER be used on client-side
 */
export function isServer(): boolean {
  return typeof window === 'undefined';
}

/**
 * Assert that code is running on server-side
 * Throws an error if called from client-side
 */
export function assertServerSide(operation: string): void {
  if (!isServer()) {
    throw new Error(
      `${operation} can only be called from server-side code (Server Actions, API Routes). ` +
      `This operation uses Firebase Admin SDK which requires server credentials.`
    );
  }
}

// Export the app instance for advanced usage
export { adminApp };
