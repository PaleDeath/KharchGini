import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
// import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
// let storage: FirebaseStorage;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

auth = getAuth(app);
db = getFirestore(app);
// storage = getStorage(app);

// Firebase error handling utility
export interface FirebaseErrorInfo {
  message: string;
  isServiceError: boolean;
  isRetryable: boolean;
  userFriendlyMessage: string;
}

export function handleFirebaseAuthError(error: any): FirebaseErrorInfo {
  const errorCode = error?.code || '';
  const errorMessage = error?.message || '';
  
  // Service/network errors that are retryable
  const serviceErrors = [
    'auth/network-request-failed',
    'auth/internal-error',
    'auth/timeout',
    'auth/unavailable'
  ];
  
  const isServiceError = serviceErrors.includes(errorCode) || 
                        errorMessage.includes('503') ||
                        errorMessage.includes('visibility-check-was-unavailable') ||
                        errorMessage.includes('network error') ||
                        errorMessage.includes('timeout');

  let userFriendlyMessage = "An unexpected error occurred.";
  
  if (isServiceError) {
    userFriendlyMessage = "Firebase services are temporarily unavailable. This usually resolves within a few minutes.";
  } else {
    switch (errorCode) {
      case 'auth/user-not-found':
        userFriendlyMessage = "No account found with this email address.";
        break;
      case 'auth/wrong-password':
        userFriendlyMessage = "Incorrect password. Please try again.";
        break;
      case 'auth/invalid-email':
        userFriendlyMessage = "Invalid email address format.";
        break;
      case 'auth/user-disabled':
        userFriendlyMessage = "This account has been disabled. Please contact support.";
        break;
      case 'auth/invalid-credential':
        userFriendlyMessage = "Invalid email or password. Please check your credentials.";
        break;
      case 'auth/email-already-in-use':
        userFriendlyMessage = "An account with this email already exists. Try logging in instead.";
        break;
      case 'auth/weak-password':
        userFriendlyMessage = "Password is too weak. Please choose a stronger password.";
        break;
      case 'auth/operation-not-allowed':
        userFriendlyMessage = "Email/password accounts are not enabled. Please contact support.";
        break;
      case 'auth/too-many-requests':
        userFriendlyMessage = "Too many attempts. Please wait a few minutes before trying again.";
        break;
      case 'auth/requires-recent-login':
        userFriendlyMessage = "Please log out and log back in to perform this action.";
        break;
      default:
        if (errorMessage) {
          userFriendlyMessage = errorMessage;
        }
    }
  }

  return {
    message: errorMessage,
    isServiceError,
    isRetryable: isServiceError,
    userFriendlyMessage
  };
}



export { app, auth, db /*, storage*/ };
