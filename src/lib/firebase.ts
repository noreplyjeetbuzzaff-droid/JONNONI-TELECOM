import { initializeApp } from 'firebase/app';
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account',
});

const driveConsentProvider = new GoogleAuthProvider();
driveConsentProvider.addScope('https://www.googleapis.com/auth/drive.file');
driveConsentProvider.setCustomParameters({
  prompt: 'consent',
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const BOOTSTRAPPED_ADMIN_EMAIL = 'noreply.jeetbuzzaff@gmail.com';

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
  return rawMessage || 'গুগল সাইন-ইন ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।';
}

export const initAuth = (
  onAuthChange: (user: User | null, accessToken: string | null) => void
) => {
  // Recover any pending OAuth redirect credential if signInWithRedirect ran
  getRedirectResult(auth)
    .then((redirectResult) => {
      if (redirectResult) {
        const credential =
          GoogleAuthProvider.credentialFromResult(redirectResult);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
        }
        onAuthChange(redirectResult.user, cachedAccessToken);
      }
    })
    .catch((err) => {
      console.error('Redirect auth check error:', err);
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
    if (credential?.accessToken) {
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

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logout = async () => {
  cachedAccessToken = null;
  await auth.signOut();
};
