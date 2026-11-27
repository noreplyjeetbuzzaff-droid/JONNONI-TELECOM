import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
} from 'firebase/firestore';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  isBootstrappedAdminEmail,
  isPrimaryAdminEmail,
} from './firebase';
import {
  AdminAccessState,
  AdminAccountRecord,
  AdminPermissions,
  AdminRole,
  createDeniedAdminAccess,
  DEFAULT_ALL_PERMISSIONS,
  DEFAULT_SECONDARY_PERMISSIONS,
  normalizeAdminPermissions,
} from '../types/adminAccess';

const COLLECTION_NAME = 'admin_accounts';
const LEGACY_COLLECTION = 'admins';
const UID_REGEX = /^[a-zA-Z0-9_-]+$/;
const EMAIL_KEY_REGEX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export function normalizeEmailKey(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidAdminEmailKey(email: string): boolean {
  const normalized = normalizeEmailKey(email);
  return (
    normalized.length >= 5 &&
    normalized.length <= 160 &&
    EMAIL_KEY_REGEX.test(normalized)
  );
}

function buildAccessFromDoc(
  data: Partial<AdminAccountRecord> | undefined
): AdminAccessState {
  if (!data) return createDeniedAdminAccess();
  const active = data.active !== false;
  if (!active) {
    return {
      isAdmin: false,
      isPrimary: false,
      active: false,
      isSuspended: true,
      role: data.role || 'viewer',
      permissions: normalizeAdminPermissions(data.permissions),
    };
  }
  const role: AdminRole =
    data.role === 'super_admin' ||
    data.role === 'admin' ||
    data.role === 'moderator' ||
    data.role === 'viewer'
      ? data.role
      : 'admin';

  return {
    isAdmin: true,
    isPrimary: false,
    active: true,
    isSuspended: false,
    role,
    permissions: normalizeAdminPermissions(data.permissions),
  };
}

export async function resolveAdminAccess(
  uid: string,
  email: string | null | undefined,
  emailVerified: boolean,
  hasGoogleProvider = false
): Promise<AdminAccessState> {
  const isVerified = emailVerified || hasGoogleProvider;
  if (!isVerified) return createDeniedAdminAccess();

  if (isPrimaryAdminEmail(email)) {
    return {
      isAdmin: true,
      isPrimary: true,
      active: true,
      isSuspended: false,
      role: 'super_admin',
      permissions: { ...DEFAULT_ALL_PERMISSIONS },
    };
  }

  const emailKey = email ? normalizeEmailKey(email) : '';
  if (emailKey && isValidAdminEmailKey(emailKey)) {
    try {
      const accountSnap = await getDoc(doc(db, COLLECTION_NAME, emailKey));
      if (accountSnap.exists()) {
        return buildAccessFromDoc(
          accountSnap.data() as Partial<AdminAccountRecord>
        );
      }
    } catch {
      // Fall back to bootstrapped/legacy checks if read fails transiently
    }
  }

  if (isBootstrappedAdminEmail(email)) {
    return {
      isAdmin: true,
      isPrimary: false,
      active: true,
      isSuspended: false,
      role: 'admin',
      permissions: { ...DEFAULT_SECONDARY_PERMISSIONS },
    };
  }

  if (UID_REGEX.test(uid)) {
    try {
      const legacySnap = await getDoc(doc(db, LEGACY_COLLECTION, uid));
      if (legacySnap.exists() && legacySnap.data()?.role === 'admin') {
        return {
          isAdmin: true,
          isPrimary: false,
          active: true,
          isSuspended: false,
          role: 'admin',
          permissions: { ...DEFAULT_SECONDARY_PERMISSIONS },
        };
      }
    } catch {
      // ignore
    }
  }

  return createDeniedAdminAccess();
}

export function subscribeOwnAdminAccess(
  email: string | null | undefined,
  isPrimary: boolean,
  onChange: (access: AdminAccessState) => void
): Unsubscribe {
  if (isPrimary || !email) {
    return () => {};
  }
  const emailKey = normalizeEmailKey(email);
  if (!isValidAdminEmailKey(emailKey)) {
    return () => {};
  }

  return onSnapshot(
    doc(db, COLLECTION_NAME, emailKey),
    (snap) => {
      if (snap.exists()) {
        onChange(buildAccessFromDoc(snap.data() as Partial<AdminAccountRecord>));
      } else if (isBootstrappedAdminEmail(emailKey)) {
        onChange({
          isAdmin: true,
          isPrimary: false,
          active: true,
          isSuspended: false,
          role: 'admin',
          permissions: { ...DEFAULT_SECONDARY_PERMISSIONS },
        });
      } else {
        onChange(createDeniedAdminAccess());
      }
    },
    () => {
      // Keep current access state on transient listener error
    }
  );
}

export function subscribeAdminAccounts(
  onData: (accounts: AdminAccountRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const records: AdminAccountRecord[] = snapshot.docs.map((d) => {
        const data = d.data() as Partial<AdminAccountRecord>;
        return {
          id: d.id,
          email: data.email || d.id,
          displayName: data.displayName || d.id.split('@')[0] || 'Admin',
          role: data.role || 'admin',
          active: data.active !== false,
          permissions: normalizeAdminPermissions(data.permissions),
          note: data.note || '',
          createdByUid: data.createdByUid || '',
          createdByEmail: data.createdByEmail || '',
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
        };
      });
      onData(records);
    },
    (error) => {
      onError(
        error instanceof Error
          ? error
          : new Error('অ্যাডমিন তালিকা লোড করতে সমস্যা হয়েছে।')
      );
    }
  );
}

export interface SaveAdminAccountInput {
  email: string;
  displayName: string;
  role: AdminRole;
  active: boolean;
  permissions: AdminPermissions;
  note?: string;
  actorUid: string;
  actorEmail: string;
  isEdit?: boolean;
}

export async function saveAdminAccount(
  input: SaveAdminAccountInput
): Promise<void> {
  const emailKey = normalizeEmailKey(input.email);
  if (!isValidAdminEmailKey(emailKey)) {
    throw new Error('সঠিক Gmail / ইমেইল ঠিকানা লিখুন।');
  }
  if (emailKey === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
    throw new Error('প্রধান অ্যাডমিনিস্ট্রেটরের অনুমতি পরিবর্তন করা যাবে না।');
  }

  const displayName =
    input.displayName.trim().slice(0, 80) || emailKey.split('@')[0];
  const note = (input.note || '').trim().slice(0, 200);
  const permissions = normalizeAdminPermissions(input.permissions);
  const role: AdminRole =
    input.role === 'super_admin' ||
    input.role === 'admin' ||
    input.role === 'moderator' ||
    input.role === 'viewer'
      ? input.role
      : 'admin';

  const docRef = doc(db, COLLECTION_NAME, emailKey);
  const existing = await getDoc(docRef);

  if (existing.exists()) {
    await updateDoc(docRef, {
      displayName,
      role,
      active: Boolean(input.active),
      permissions,
      note,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  await setDoc(docRef, {
    email: emailKey,
    displayName,
    role,
    active: Boolean(input.active),
    permissions,
    note,
    createdByUid: input.actorUid.slice(0, 128),
    createdByEmail: input.actorEmail.trim().slice(0, 160),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function toggleAdminAccountActive(params: {
  email: string;
  displayName: string;
  role: AdminRole;
  permissions: AdminPermissions;
  note?: string;
  nextActive: boolean;
  actorUid: string;
  actorEmail: string;
}): Promise<void> {
  await saveAdminAccount({
    email: params.email,
    displayName: params.displayName,
    role: params.role,
    active: params.nextActive,
    permissions: params.permissions,
    note: params.note,
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    isEdit: true,
  });
}

export async function deleteAdminAccount(email: string): Promise<void> {
  const emailKey = normalizeEmailKey(email);
  if (!isValidAdminEmailKey(emailKey)) {
    throw new Error('অবৈধ অ্যাডমিন ইমেইল।');
  }
  if (emailKey === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
    throw new Error('প্রধান অ্যাডমিনিস্ট্রেটরকে মুছে ফেলা যাবে না।');
  }
  await deleteDoc(doc(db, COLLECTION_NAME, emailKey));
}
