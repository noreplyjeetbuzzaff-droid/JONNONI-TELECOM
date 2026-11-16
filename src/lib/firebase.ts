import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

// Primary Admin Auth provider (no sensitive Drive scope, avoids OAuth unverified-app blocks)
const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: 'select_account',
});

// Separate provider used only when explicitly connecting Google Drive storage
const driveConsentProvider = new GoogleAuthProvider();
driveConsentProvider.addScope('https://www.googleapis.com/auth/drive.file');
driveConsentProvider.setCustomParameters({
  prompt: 'consent select_account',
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const BOOTSTRAPPED_ADMIN_EMAIL = 'noreply.jeetbuzzaff@gmail.com';
export const BOOTSTRAPPED_ADMIN_EMAILS = [
  'noreply.jeetbuzzaff@gmail.com',
  'sflove087@gmail.com',
] as const;

export function isBootstrappedAdminEmail(
  email: string | null | undefined
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return BOOTSTRAPPED_ADMIN_EMAILS.some(
    (adminEmail) => adminEmail.toLowerCase() === normalized
  );
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

function formatAuthErrorMessage(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  const rawMessage = err instanceof Error ? err.message : String(err);

  if (code === 'auth/popup-blocked') {
    return 'আপনার ব্রাউজার লগইন পপআপ ব্লক করেছে। ব্রাউজার সেটিংস থেকে Pop-up Allow করুন অথবা নিচের "নতুন ট্যাবে খুলে লগইন করুন" লিংকে ক্লিক করুন। (auth/popup-blocked)';
  }
  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request'
  ) {
    return 'গুগল সাইন-ইন পপআপ সম্পূর্ণ হওয়ার আগেই বন্ধ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।';
  }
  if (code === 'auth/unauthorized-domain') {
    const host =
      typeof window !== 'undefined' ? window.location.hostname : 'current domain';
    return `এই ডোমেইন (${host}) Firebase Authorized Domains তালিকায় অনুমোদিত নয়। মূল শেয়ার্ড বা ডেভেলপমেন্ট লিংক থেকে চেষ্টা করুন অথবা Firebase Console-এ ডোমেইন যোগ করুন। (auth/unauthorized-domain)`;
  }
  if (code === 'auth/network-request-failed') {
    return 'ইন্টারনেট সংযোগের সমস্যার কারণে গুগল সাইন-ইন ব্যর্থ হয়েছে। অনুগ্রহ করে নেটওয়ার্ক যাচাই করে আবার চেষ্টা করুন।';
  }
  if (code === 'auth/web-storage-unsupported') {
    return 'আপনার ব্রাউজারে কুকি বা স্টোরেজ ব্লক করা আছে। প্রাইভেট মোড বন্ধ করে বা কুকি চালু করে চেষ্টা করুন।';
  }
  if (
    code === 'auth/operation-not-allowed' ||
    code === 'auth/unauthorized-continue-uri'
  ) {
    return 'Firebase Authentication-এ Google Sign-In অথবা এই ডোমেইন অনুমোদিত নয়। অনুগ্রহ করে Firebase Console যাচাই করুন।';
  }
  return rawMessage || 'গুগল সাইন-ইন ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।';
}

async function hasDriveFileScope(token: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { scope?: string };
    return Boolean(
      data.scope && data.scope.includes('https://www.googleapis.com/auth/drive')
    );
  } catch {
    return false;
  }
}

export const initAuth = (
  onAuthChange: (user: User | null, accessToken: string | null) => void,
  onAuthError?: (message: string) => void
) => {
  // Recover any pending OAuth redirect credential if signInWithRedirect ran
  getRedirectResult(auth)
    .then(async (redirectResult) => {
      if (redirectResult) {
        const credential =
          GoogleAuthProvider.credentialFromResult(redirectResult);
        if (
          credential?.accessToken &&
          (await hasDriveFileScope(credential.accessToken))
        ) {
          cachedAccessToken = credential.accessToken;
        }
        onAuthChange(redirectResult.user, cachedAccessToken);
      }
    })
    .catch((err) => {
      console.error('Redirect auth check error:', err);
      if (onAuthError) {
        onAuthError(formatAuthErrorMessage(err));
      }
    });

  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (!isSigningIn && !cachedAccessToken) {
        onAuthChange(user, null);
      } else {
        onAuthChange(user, cachedAccessToken);
      }
    } else {
      cachedAccessToken = null;
      onAuthChange(null, null);
    }
  });
};

export const googleSignIn = async (
  forceConsent = false
): Promise<{
  user: User;
  accessToken: string | null;
} | null> => {
  const activeProvider = forceConsent ? driveConsentProvider : provider;
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, activeProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (forceConsent && credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    } else if (
      credential?.accessToken &&
      (await hasDriveFileScope(credential.accessToken))
    ) {
      cachedAccessToken = credential.accessToken;
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err: unknown) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';

    const isInIframe =
      typeof window !== 'undefined' && window.self !== window.top;

    // Outside iframe, fall back to redirect when popups are blocked
    if (
      !isInIframe &&
      (code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment')
    ) {
      await signInWithRedirect(auth, activeProvider);
      return null;
    }

    throw new Error(formatAuthErrorMessage(err));
  } finally {
    isSigningIn = false;
  }
};

export const googleSignInRedirect = async (
  forceConsent = false
): Promise<void> => {
  const activeProvider = forceConsent ? driveConsentProvider : provider;
  try {
    await signInWithRedirect(auth, activeProvider);
  } catch (err: unknown) {
    throw new Error(formatAuthErrorMessage(err));
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const clearDriveAccessToken = (): void => {
  cachedAccessToken = null;
};

export const logout = async () => {
  cachedAccessToken = null;
  await auth.signOut();
};
