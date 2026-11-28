import { initializeApp } from 'firebase/app';
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
// Keep getAuth default persistence cascade (IndexedDB -> localStorage -> sessionStorage -> inMemory)
// so auth state never breaks in third-party-cookie-blocked iframes or strict mobile browsers.
export const auth = getAuth(app);

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

function clearLegacyRedirectStorage(): void {
  try {
    sessionStorage.removeItem('jt_pending_admin_redirect');
    sessionStorage.removeItem('jt_redirect_failed');
  } catch {
    // Ignore storage errors
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

export interface StoredDriveLinkProfile {
  linked: boolean;
  email: string;
  userEmail?: string;
  userName?: string;
  usageBytes?: number;
  limitBytes?: number | null;
  linkedAt: number;
}

function getDriveLinkStorageKey(email: string): string {
  return `jt_drive_linked_v1_${email.trim().toLowerCase()}`;
}

export function getStoredDriveProfile(
  email: string | null | undefined
): StoredDriveLinkProfile | null {
  if (!email || !email.trim()) return null;
  try {
    const raw = localStorage.getItem(getDriveLinkStorageKey(email));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDriveLinkProfile;
    if (parsed && parsed.linked === true) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function isDriveLinkedForEmail(
  email: string | null | undefined
): boolean {
  return Boolean(getStoredDriveProfile(email)?.linked);
}

export function markDriveLinkedForEmail(
  email: string | null | undefined,
  details?: {
    userEmail?: string;
    userName?: string;
    usageBytes?: number;
    limitBytes?: number | null;
  }
): void {
  if (!email || !email.trim()) return;
  const normalized = email.trim().toLowerCase();
  const existing = getStoredDriveProfile(normalized);
  const next: StoredDriveLinkProfile = {
    linked: true,
    email: normalized,
    userEmail: details?.userEmail ?? existing?.userEmail ?? normalized,
    userName: details?.userName ?? existing?.userName,
    usageBytes:
      details?.usageBytes !== undefined
        ? details.usageBytes
        : existing?.usageBytes,
    limitBytes:
      details?.limitBytes !== undefined
        ? details.limitBytes
        : existing?.limitBytes,
    linkedAt: existing?.linkedAt || Date.now(),
  };
  try {
    localStorage.setItem(getDriveLinkStorageKey(normalized), JSON.stringify(next));
  } catch {
    // Ignore storage quota/privacy errors
  }
}

export function clearDriveLinkedForEmail(
  email: string | null | undefined
): void {
  if (!email || !email.trim()) return;
  try {
    localStorage.removeItem(getDriveLinkStorageKey(email));
  } catch {
    // Ignore storage errors
  }
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
    return 'লগইন পপআপ ওপেন হতে পারেনি। অনুগ্রহ করে নিচের "নতুন ট্যাবে খুলে লগইন করুন" বাটনে ক্লিক করে সরাসরি গুগল সাইন-ইন করুন। (auth/popup-blocked)';
  }
  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request'
  ) {
    return 'গুগল সাইন-ইন সম্পূর্ণ হওয়ার আগেই পপআপ বন্ধ হয়েছে। অনুগ্রহ করে পুনরায় "Sign in with Google" বাটনে ক্লিক করুন।';
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
    return 'এই ব্রাউজারে স্টোরেজ সাপোর্ট সীমিত। সাধারণ ব্রাউজার ট্যাবে খুলে আবার চেষ্টা করুন।';
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
    return 'গুগল OAuth অনুমতি ব্লক হয়েছে (Error 403: access_denied)। Google Cloud Console-এর Audience অংশে অ্যাপটি "Testing" মোডে থাকলে প্রধান অ্যাডমিন (noreply.jeetbuzzaff@gmail.com)-কে এই জিমেইলটি Test Users তালিকায় যোগ করতে হবে অথবা "Publish App" করতে হবে। এছাড়া নিচের "ড্রাইভ লিংক দিয়ে ফাইল প্রকাশ" অপশন দিয়েও সাথে সাথে ফাইল যোগ করতে পারবেন।';
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
  clearLegacyRedirectStorage();

  // Silently recover any redirect credential if present, without emitting third-party cookie errors
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
          markDriveLinkedForEmail(getEffectiveUserEmail(redirectResult.user));
        }
        onAuthChange(redirectResult.user, cachedAccessToken);
      }
    })
    .catch((err) => {
      console.error('Redirect auth check error:', err);
      if (onAuthError && !auth.currentUser) {
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
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      onAuthChange(null, null);
    }
  });
};

export type GoogleConsentMode =
  | boolean
  | 'drive'
  | 'drive_silent'
  | 'gmail';

function resolveProviderForConsent(
  consentMode: GoogleConsentMode,
  loginHint?: string | null
): GoogleAuthProvider {
  if (consentMode === 'gmail') {
    const p = new GoogleAuthProvider();
    for (const scope of WORKSPACE_SCOPES) {
      p.addScope(scope);
    }
    p.setCustomParameters(
      loginHint
        ? { prompt: 'consent select_account', login_hint: loginHint }
        : { prompt: 'consent select_account' }
    );
    return p;
  }
  if (consentMode === 'drive_silent') {
    const p = new GoogleAuthProvider();
    for (const scope of DRIVE_ONLY_SCOPES) {
      p.addScope(scope);
    }
    if (loginHint) {
      p.setCustomParameters({ login_hint: loginHint });
    }
    return p;
  }
  if (consentMode === true || consentMode === 'drive') {
    const p = new GoogleAuthProvider();
    for (const scope of DRIVE_ONLY_SCOPES) {
      p.addScope(scope);
    }
    p.setCustomParameters(
      loginHint
        ? { prompt: 'consent select_account', login_hint: loginHint }
        : { prompt: 'consent select_account' }
    );
    return p;
  }
  return provider;
}

export const googleSignIn = async (
  forceConsent: GoogleConsentMode = false
): Promise<{
  user: User;
  accessToken: string | null;
} | null> => {
  clearLegacyRedirectStorage();
  const currentEmail = getEffectiveUserEmail(auth.currentUser);
  const activeProvider = resolveProviderForConsent(forceConsent, currentEmail);
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, activeProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const signedInEmail = getEffectiveUserEmail(result.user);
    if (forceConsent && credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
      if (await hasDriveFileScope(credential.accessToken)) {
        markDriveLinkedForEmail(signedInEmail);
      }
    } else if (
      credential?.accessToken &&
      (await hasDriveFileScope(credential.accessToken))
    ) {
      cachedAccessToken = credential.accessToken;
      markDriveLinkedForEmail(signedInEmail);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err: unknown) {
    await auth.authStateReady().catch(() => {});
    if (!forceConsent && auth.currentUser) {
      return { user: auth.currentUser, accessToken: cachedAccessToken };
    }
    throw new Error(formatAuthErrorMessage(err));
  } finally {
    isSigningIn = false;
  }
};

export const ensureDriveAccessToken = async (
  forceFresh = false
): Promise<string | null> => {
  if (!forceFresh && cachedAccessToken) {
    return cachedAccessToken;
  }
  const currentEmail = getEffectiveUserEmail(auth.currentUser);
  const mode: GoogleConsentMode = isDriveLinkedForEmail(currentEmail)
    ? 'drive_silent'
    : 'drive';
  const res = await googleSignIn(mode);
  return res?.accessToken || cachedAccessToken || null;
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
