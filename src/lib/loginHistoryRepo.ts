import { User } from 'firebase/auth';
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
  doc,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

const COLLECTION_NAME = 'login_history';

export type LoginEventType =
  | 'admin_login'
  | 'drive_connect'
  | 'gmail_connect'
  | 'drive_blocked'
  | 'logout';

export type LoginEventStatus = 'success' | 'blocked' | 'failed';

export interface LoginHistoryRecord {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  eventType: LoginEventType;
  status: LoginEventStatus;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  deviceName: string;
  browser: string;
  os: string;
  ipAddress: string;
  errorMessage: string;
  createdAt?: Timestamp | null;
}

export interface ClientDeviceInfo {
  deviceType: 'mobile' | 'desktop' | 'tablet';
  deviceName: string;
  browser: string;
  os: string;
}

interface NavigatorUAData {
  mobile?: boolean;
  platform?: string;
  getHighEntropyValues?: (
    hints: string[]
  ) => Promise<{ model?: string; platform?: string; platformVersion?: string }>;
}

function parseDeviceModelFromUA(rawUa: string): string {
  const androidMatch = rawUa.match(/Android[^;]*;\s*([^;)]+?)(?:\s+Build\/|[;)])/i);
  if (androidMatch && androidMatch[1]) {
    const candidate = androidMatch[1].trim();
    if (
      candidate &&
      candidate.toLowerCase() !== 'wv' &&
      candidate.toLowerCase() !== 'k' &&
      candidate.length >= 2
    ) {
      return candidate;
    }
  }
  if (/iPhone/i.test(rawUa)) return 'Apple iPhone';
  if (/iPad/i.test(rawUa)) return 'Apple iPad';
  if (/Macintosh|Mac OS X/i.test(rawUa)) return 'Apple Mac';
  if (/Windows NT 10\.0|Windows NT 11\.0/i.test(rawUa)) return 'Windows 10/11 PC';
  if (/Windows/i.test(rawUa)) return 'Windows PC';
  if (/CrOS/i.test(rawUa)) return 'Chromebook';
  if (/Linux/i.test(rawUa)) return 'Linux PC';
  return 'Unknown Device';
}

export async function detectClientDeviceInfo(): Promise<ClientDeviceInfo> {
  const rawUa = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const ua = rawUa.toLowerCase();

  let deviceType: 'mobile' | 'desktop' | 'tablet' = 'desktop';
  if (
    /ipad|tablet|playbook|silk/i.test(ua) ||
    (/android/i.test(ua) && !/mobile/i.test(ua))
  ) {
    deviceType = 'tablet';
  } else if (
    /mobile|iphone|ipod|android.*mobile|opera mini|iemobile/i.test(ua)
  ) {
    deviceType = 'mobile';
  }

  let browser = 'Other';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('opr/') || ua.includes('opera')) browser = 'Opera';
  else if (ua.includes('chrome/') && !ua.includes('chromium')) browser = 'Chrome';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome')) browser = 'Safari';

  let os = 'Other';
  if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';

  let deviceName = parseDeviceModelFromUA(rawUa);

  try {
    const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData })
      .userAgentData;
    if (uaData?.getHighEntropyValues) {
      const high = await uaData.getHighEntropyValues([
        'model',
        'platform',
        'platformVersion',
      ]);
      if (high.model && high.model.trim()) {
        deviceName = high.model.trim();
      } else if (
        deviceName === 'Unknown Device' &&
        high.platform &&
        high.platform.trim()
      ) {
        deviceName = `${high.platform.trim()} Device`;
      }
      if (high.platform && os === 'Other') {
        os = high.platform.slice(0, 40);
      }
    }
  } catch {
    // High-entropy hints optional
  }

  if (deviceName === 'Unknown Device' && deviceType === 'mobile') {
    deviceName = os === 'Android' ? 'Android Smartphone' : 'Mobile Phone';
  }

  return {
    deviceType,
    deviceName: deviceName.slice(0, 100) || 'Unknown Device',
    browser: browser.slice(0, 40),
    os: os.slice(0, 40),
  };
}

export async function fetchClientIpAddress(user: User): Promise<string> {
  try {
    const idToken = await user.getIdToken();
    const res = await fetch('/api/client-info', {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return 'Unavailable';
    const data = (await res.json()) as { ipAddress?: string };
    return (data.ipAddress || 'Unavailable').slice(0, 64);
  } catch {
    return 'Unavailable';
  }
}

export async function recordAdminLoginEvent(params: {
  user: User;
  eventType: LoginEventType;
  status: LoginEventStatus;
  errorMessage?: string;
}): Promise<void> {
  const { user, eventType, status, errorMessage = '' } = params;
  if (!user.email || !user.emailVerified) return;

  try {
    const [deviceInfo, ipAddress] = await Promise.all([
      detectClientDeviceInfo(),
      fetchClientIpAddress(user),
    ]);
    const entryId = `lh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await setDoc(doc(db, COLLECTION_NAME, entryId), {
      uid: user.uid.slice(0, 128),
      email: user.email.slice(0, 160),
      displayName: (user.displayName || user.email.split('@')[0] || 'Admin').slice(
        0,
        80
      ),
      eventType,
      status,
      deviceType: deviceInfo.deviceType,
      deviceName: deviceInfo.deviceName,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      ipAddress,
      errorMessage: errorMessage.trim().slice(0, 240),
      createdAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking audit log so auth flow is never disrupted
  }
}

export function subscribeLoginHistory(
  onData: (entries: LoginHistoryRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy('createdAt', 'desc'),
    limit(150)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const records: LoginHistoryRecord[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<LoginHistoryRecord, 'id'>),
      }));
      onData(records);
    },
    (error) => {
      onError(
        error instanceof Error
          ? error
          : new Error('লগইন হিস্ট্রি লোড করতে সমস্যা হয়েছে।')
      );
    }
  );
}

export async function clearLoginHistory(): Promise<void> {
  const snap = await getDocs(query(collection(db, COLLECTION_NAME), limit(300)));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
