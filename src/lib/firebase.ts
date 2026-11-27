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

export const DRIVE_ONLY_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
] as const;

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
] as const;

// Drive-only provider (minimal scope to reduce OAuth consent blocks)
const driveConsentProvider = new GoogleAuthProvider();
for (const scope of DRIVE_ONLY_SCOPES) {
  driveConsentProvider.addScope(scope);
}
driveConsentProvider.setCustomParameters({
  prompt: 'consent select_account',
});

// Workspace provider for sending Gmail notifications alongside Drive
const gmailConsentProvider = new GoogleAuthProvider();
for (const scope of WORKSPACE_SCOPES) {
  gmailConsentProvider.addScope(scope);
}
gmailConsentProvider.setCustomParameters({
  prompt: 'consent select_account',
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const BOOTSTRAPPED_ADMIN_EMAIL = 'noreply.jeetbuzzaff@gmail.com';
export const BOOTSTRAPPED_ADMIN_EMAILS = [
  'noreply.jeetbuzzaff@gmail.com',
  'sflove087@gmail.com',
  'jononitelecom266366@gmail.com',
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

export function isPrimaryAdminEmail(
  email: string | null | undefined
): boolean {
  if (!email) return false;
  return (
    email.trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
  );
}

export const PENDING_ADMIN_REDIRECT_KEY = 'jt_pending_admin_redirect';

export function markPendingAdminRedirect(): void {
  try {
    sessionStorage.setItem(PENDING_ADMIN_REDIRECT_KEY, '1');
  } catch {
    // Ignore storage errors
  }
}

export function consumePendingAdminRedirect(): boolean {
  try {
    const val = sessionStorage.getItem(PENDING_ADMIN_REDIRECT_KEY) === '1';
    if (val) sessionStorage.removeItem(PENDING_ADMIN_REDIRECT_KEY);
    return val;
  } catch {
    return false;
  }
}

export function getEffectiveUserEmail(user: User | null | undefined): string | null {
  if (!user) return null;
  if (user.email && user.email.trim()) return user.email.trim();
  const providerEmail = user.providerData?.find(
    (p) => typeof p?.email === 'string' && p.email.trim().length > 0
  )?.email;
  return providerEmail ? providerEmail.trim() : null;
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
  const lowerMsg = rawMessage.toLowerCase();
  if (
    lowerMsg.includes('access_denied') ||
    lowerMsg.includes('blocked') ||
    lowerMsg.includes('admin_policy_enforced') ||
    lowerMsg.includes('org_internal')
  ) {
    return 'গুগল OAuth অনুমতি ব্লক হয়েছে (Error 403: access_denied)। অ্যাপটি Google Cloud OAuth "Testing" মোডে থাকলে শুধুমাত্র Test Users তালিকার জিমেইল থেকেই Drive/Gmail সংযুক্ত করা যায়। প্রধান অ্যাডমিন (noreply.jeetbuzzaff@gmail.com) Google Cloud Console-এ আপনার ইমেইলটি Test User হিসেবে যুক্ত করলে এটি ঠিক হয়ে যাবে—অথবা নিচের "ড্রাইভ লিংক দিয়ে ফাইল প্রকাশ" অপশন ব্যবহার করতে পারেন।';
  }
  return rawMessage || 'গুগল সাইন-ইন ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।';
}

export interface WorkspaceTokenScopes {
  hasDrive: boolean;
  hasGmailSend: boolean;
}

export async function checkTokenScopes(
  token: string
): Promise<WorkspaceTokenScopes> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`
    );
    if (!res.ok) return { hasDrive: false, hasGmailSend: false };
    const data = (await res.json()) as { scope?: string };
    const scopeStr = data.scope || '';
    return {
      hasDrive: scopeStr.includes('https://www.googleapis.com/auth/drive'),
      hasGmailSend:
        scopeStr.includes('https://www.googleapis.com/auth/gmail.send') ||
        scopeStr.includes('https://mail.google.com/'),
    };
  } catch {
    return { hasDrive: false, hasGmailSend: false };
  }
}

async function hasDriveFileScope(token: string): Promise<boolean> {
  const scopes = await checkTokenScopes(token);
  return scopes.hasDrive || scopes.hasGmailSend;
}

export const initAuth = (
  onAuthChange: (user: User | null, accessToken: string | null) => void,
  onAuthError?: (message: string) => void
) => {
  // Recover any pending OAuth redirect credential if signInWithRedirect ran
  getRedirectResult(auth)
    .then(async (redirectResult) => {
      consumePendingAdminRedirect();
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
      consumePendingAdminRedirect();
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

export type GoogleConsentMode = boolean | 'drive' | 'gmail';

function resolveProviderForConsent(
  consentMode: GoogleConsentMode
): GoogleAuthProvider {
  if (consentMode === 'gmail') return gmailConsentProvider;
  if (consentMode === true || consentMode === 'drive') {
    return driveConsentProvider;
  }
  return provider;
}

export const googleSignIn = async (
  forceConsent: GoogleConsentMode = false
): Promise<{
  user: User;
  accessToken: string | null;
} | null> => {
  consumePendingAdminRedirect();
  const activeProvider = resolveProviderForConsent(forceConsent);
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
    throw new Error(formatAuthErrorMessage(err));
  } finally {
    isSigningIn = false;
  }
};

export const googleSignInRedirect = async (
  forceConsent: GoogleConsentMode = false
): Promise<void> => {
  const activeProvider = resolveProviderForConsent(forceConsent);
  try {
    markPendingAdminRedirect();
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
