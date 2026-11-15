import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  CreateFlashFileInput,
  FlashFileRecord,
  UpdateFlashFileInput,
} from '../types/flashFile';

const COLLECTION_NAME = 'flash_files';
const ID_REGEX = /^[a-zA-Z0-9_-]+$/;

function sanitizeText(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

function sanitizePrice(price: number): number {
  if (!Number.isFinite(price) || price < 0) return 0;
  return Math.min(1000000, Math.round(price));
}

function generateDocumentId(): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `ff_${Date.now()}_${randomPart}`;
}

function sortByCreatedAtDesc(items: FlashFileRecord[]): FlashFileRecord[] {
  return [...items].sort((a, b) => {
    const aMs = a.createdAt ? a.createdAt.toMillis() : Date.now();
    const bMs = b.createdAt ? b.createdAt.toMillis() : Date.now();
    return bMs - aMs;
  });
}

export async function checkIsAdmin(
  uid: string,
  email: string | null | undefined,
  emailVerified: boolean
): Promise<boolean> {
  if (!emailVerified) return false;
  if (
    email &&
    email.trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
  ) {
    return true;
  }
  if (!ID_REGEX.test(uid)) return false;

  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists() && snap.data()?.role === 'admin';
  } catch {
    return false;
  }
}

export function subscribePublicFlashFiles(
  onData: (files: FlashFileRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('isPublicDrive', '==', true)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const records: FlashFileRecord[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<FlashFileRecord, 'id'>),
      }));
      onData(sortByCreatedAtDesc(records));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeAdminFlashFiles(
  uid: string,
  isBootstrapped: boolean,
  onData: (files: FlashFileRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = isBootstrapped
    ? query(collection(db, COLLECTION_NAME))
    : query(
        collection(db, COLLECTION_NAME),
        where('uploadedByUid', '==', uid)
      );

  return onSnapshot(
    q,
    (snapshot) => {
      const records: FlashFileRecord[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<FlashFileRecord, 'id'>),
      }));
      onData(sortByCreatedAtDesc(records));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function createFlashFileRecord(
  input: CreateFlashFileInput
): Promise<string> {
  const id = generateDocumentId();
  const path = `${COLLECTION_NAME}/${id}`;

  const payload = {
    title: sanitizeText(input.title, 160),
    brand: sanitizeText(input.brand, 50),
    model: sanitizeText(input.model, 80),
    category: input.category,
    chipset: input.chipset,
    version: sanitizeText(input.version, 60),
    fileName: sanitizeText(input.fileName, 200),
    fileSizeBytes: Math.max(0, Math.min(107374182400, Math.round(input.fileSizeBytes))),
    driveFileId: sanitizeText(input.driveFileId, 120),
    downloadUrl: sanitizeText(input.downloadUrl, 400),
    viewUrl: sanitizeText(input.viewUrl, 400),
    notes: sanitizeText(input.notes, 1000),
    price: sanitizePrice(input.price),
    isPublicDrive: Boolean(input.isPublicDrive),
    uploadedByUid: sanitizeText(input.uploadedByUid, 128),
    uploadedByName: sanitizeText(input.uploadedByName, 80) || 'Admin',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (payload.title.length < 2) {
    throw new Error('Title must be at least 2 characters.');
  }
  if (!ID_REGEX.test(payload.driveFileId)) {
    throw new Error('Invalid Google Drive file ID format.');
  }

  try {
    await setDoc(doc(db, COLLECTION_NAME, id), payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateFlashFileRecord(
  id: string,
  input: UpdateFlashFileInput
): Promise<void> {
  const path = `${COLLECTION_NAME}/${id}`;
  const payload = {
    title: sanitizeText(input.title, 160),
    brand: sanitizeText(input.brand, 50),
    model: sanitizeText(input.model, 80),
    category: input.category,
    chipset: input.chipset,
    version: sanitizeText(input.version, 60),
    notes: sanitizeText(input.notes, 1000),
    price: sanitizePrice(input.price),
    isPublicDrive: Boolean(input.isPublicDrive),
    updatedAt: serverTimestamp(),
  };

  if (payload.title.length < 2) {
    throw new Error('Title must be at least 2 characters.');
  }

  try {
    await updateDoc(doc(db, COLLECTION_NAME, id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFlashFileRecord(id: string): Promise<void> {
  const path = `${COLLECTION_NAME}/${id}`;
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
