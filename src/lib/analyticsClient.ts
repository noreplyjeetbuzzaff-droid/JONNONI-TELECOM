import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { detectClientDeviceInfo } from './loginHistoryRepo';
import {
  ActiveVisitorInfo,
  DailyVisitorPoint,
  VisitorEventRecord,
  VisitorSummary,
} from '../types/siteSettings';

const VISITOR_STORAGE_KEY = 'jt_visitor_id_v1';
const EVENTS_COLLECTION = 'visitor_events';
const PRESENCE_COLLECTION = 'visitor_presence';
const PRESENCE_TTL_MS = 65_000;

let cachedVisitorIpPromise: Promise<string> | null = null;
let latestSearchKeyword = '';

function getVisitorIpAddress(): Promise<string> {
  if (!cachedVisitorIpPromise) {
    cachedVisitorIpPromise = fetch('/api/visitor-ip')
      .then(async (res) => {
        if (!res.ok) return 'Unavailable';
        const data = (await res.json()) as { ipAddress?: string };
        return (data.ipAddress || 'Unavailable').slice(0, 64);
      })
      .catch(() => 'Unavailable');
  }
  return cachedVisitorIpPromise;
}

interface FirestoreEventDoc {
  type: 'pageview' | 'search' | 'download';
  path: string;
  label: string;
  device: 'mobile' | 'desktop' | 'tablet';
  deviceName?: string;
  browser: string;
  os: string;
  ipAddress?: string;
  searchKeyword?: string;
  referrer: string;
  visitorHash: string;
  dayKey: string;
  createdAt?: Timestamp | null;
}

interface FirestorePresenceDoc {
  id: string;
  device: 'mobile' | 'desktop' | 'tablet';
  deviceName?: string;
  browser: string;
  os: string;
  path: string;
  ipAddress?: string;
  searchKeyword?: string;
  lastSeenAt?: Timestamp | null;
}

function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) return existing;
    const created = `v_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    localStorage.setItem(VISITOR_STORAGE_KEY, created);
    return created;
  } catch {
    return `v_${Date.now().toString(36)}`;
  }
}

function getTodayKey(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function parseClientUserAgent(): {
  device: 'mobile' | 'desktop' | 'tablet';
  browser: string;
  os: string;
} {
  const ua =
    typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
  let device: 'mobile' | 'desktop' | 'tablet' = 'desktop';
  if (
    /ipad|tablet|playbook|silk/i.test(ua) ||
    (/android/i.test(ua) && !/mobile/i.test(ua))
  ) {
    device = 'tablet';
  } else if (
    /mobile|iphone|ipod|android.*mobile|opera mini|iemobile/i.test(ua)
  ) {
    device = 'mobile';
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

  return { device, browser, os };
}

export async function trackVisitorEvent(payload: {
  type: 'pageview' | 'search' | 'download';
  path?: string;
  label?: string;
}): Promise<void> {
  const visitorId = getOrCreateVisitorId();
  const cleanPath = (payload.path || window.location.pathname || '/')
    .trim()
    .slice(0, 120) || '/';
  const cleanLabel = (payload.label || '').trim().slice(0, 120);
  if (payload.type === 'search' && cleanLabel) {
    latestSearchKeyword = cleanLabel;
  }
  const activeKeyword =
    payload.type === 'search' ? cleanLabel : latestSearchKeyword;
  const referrer =
    typeof document !== 'undefined' && document.referrer
      ? document.referrer.slice(0, 180)
      : 'Direct';
  const fallbackInfo = parseClientUserAgent();
  const [deviceInfo, ipAddress] = await Promise.all([
    detectClientDeviceInfo().catch(() => ({
      deviceType: fallbackInfo.device,
      deviceName: 'Unknown Device',
      browser: fallbackInfo.browser,
      os: fallbackInfo.os,
    })),
    getVisitorIpAddress(),
  ]);
  const eventId = `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // 1) Persist directly to Firestore (works on AI Studio AND Vercel)
  try {
    await setDoc(doc(db, EVENTS_COLLECTION, eventId), {
      type: payload.type,
      path: cleanPath,
      label: cleanLabel,
      device: deviceInfo.deviceType,
      deviceName: deviceInfo.deviceName.slice(0, 100),
      browser: deviceInfo.browser.slice(0, 40),
      os: deviceInfo.os.slice(0, 40),
      ipAddress: ipAddress.slice(0, 64),
      searchKeyword: activeKeyword.slice(0, 120),
      referrer,
      visitorHash: visitorId.slice(0, 64),
      dayKey: getTodayKey(),
      createdAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking fallback
  }

  // 2) Best-effort mirror to local Express analytics if running on Node server
  try {
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        type: payload.type,
        path: cleanPath,
        label: cleanLabel,
        visitorId,
        referrer,
        deviceName: deviceInfo.deviceName.slice(0, 100),
        searchKeyword: activeKeyword.slice(0, 120),
      }),
    });
  } catch {
    // Ignore on static serverless hosts
  }
}

function buildSummaryFromFirestore(
  events: Array<{ id: string; data: FirestoreEventDoc }>,
  presences: FirestorePresenceDoc[]
): VisitorSummary {
  const nowMs = Date.now();
  const todayKey = getTodayKey();

  const activeVisitors: ActiveVisitorInfo[] = presences
    .filter((p) => {
      const seenMs = p.lastSeenAt ? p.lastSeenAt.toMillis() : nowMs;
      return nowMs - seenMs <= PRESENCE_TTL_MS;
    })
    .sort((a, b) => {
      const aMs = a.lastSeenAt ? a.lastSeenAt.toMillis() : nowMs;
      const bMs = b.lastSeenAt ? b.lastSeenAt.toMillis() : nowMs;
      return bMs - aMs;
    })
    .slice(0, 25)
    .map((p) => {
      const seenMs = p.lastSeenAt ? p.lastSeenAt.toMillis() : nowMs;
      return {
        id: p.id.slice(-8),
        device: p.device,
        deviceName: p.deviceName,
        browser: p.browser,
        os: p.os,
        path: p.path,
        ipAddress: p.ipAddress,
        searchKeyword: p.searchKeyword,
        lastActiveSecondsAgo: Math.max(0, Math.round((nowMs - seenMs) / 1000)),
      };
    });

  let totalVisits = 0;
  let todayVisits = 0;
  let totalDownloads = 0;
  let totalSearches = 0;
  const uniqueAll = new Set<string>();
  const uniqueToday = new Set<string>();
  const deviceCounts = { mobile: 0, desktop: 0, tablet: 0 };
  const dailyMap = new Map<
    string,
    { visits: number; downloads: number; searches: number; unique: Set<string> }
  >();
  const searchCounts = new Map<string, number>();
  const downloadCounts = new Map<string, { title: string; count: number }>();
  const recentEvents: VisitorEventRecord[] = [];

  for (const { id, data } of events) {
    const dayKey = data.dayKey || todayKey;
    let bucket = dailyMap.get(dayKey);
    if (!bucket) {
      bucket = { visits: 0, downloads: 0, searches: 0, unique: new Set() };
      dailyMap.set(dayKey, bucket);
    }

    if (data.visitorHash) {
      uniqueAll.add(data.visitorHash);
      bucket.unique.add(data.visitorHash);
      if (dayKey === todayKey) {
        uniqueToday.add(data.visitorHash);
      }
    }

    if (data.type === 'pageview') {
      totalVisits += 1;
      bucket.visits += 1;
      if (dayKey === todayKey) todayVisits += 1;
      if (data.device in deviceCounts) {
        deviceCounts[data.device] += 1;
      }
    } else if (data.type === 'download') {
      totalDownloads += 1;
      bucket.downloads += 1;
      const title = (data.label || 'Unknown File').trim();
      const key = title.toLowerCase();
      const existing = downloadCounts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        downloadCounts.set(key, { title, count: 1 });
      }
    } else if (data.type === 'search') {
      totalSearches += 1;
      bucket.searches += 1;
      const term = (data.label || '').trim();
      if (term.length >= 2) {
        searchCounts.set(term, (searchCounts.get(term) || 0) + 1);
      }
    }

    if (recentEvents.length < 30) {
      recentEvents.push({
        id,
        type: data.type,
        path: data.path,
        label: data.label,
        device: data.device,
        deviceName: data.deviceName,
        browser: data.browser,
        os: data.os,
        ipAddress: data.ipAddress,
        searchKeyword: data.searchKeyword,
        referrer: data.referrer || 'Direct',
        timestamp: data.createdAt
          ? data.createdAt.toDate().toISOString()
          : new Date().toISOString(),
      });
    }
  }

  const dailyTrend: DailyVisitorPoint[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, b]) => ({
      date,
      visits: b.visits,
      uniqueVisitors: b.unique.size,
      downloads: b.downloads,
      searches: b.searches,
    }));

  const topSearches = Array.from(searchCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([term, count]) => ({ term, count }));

  const topDownloads = Array.from(downloadCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    liveVisitorsCount: activeVisitors.length,
    activeVisitors,
    totalVisits,
    todayVisits,
    uniqueVisitors: uniqueAll.size,
    todayUniqueVisitors: uniqueToday.size,
    totalDownloads,
    totalSearches,
    deviceCounts,
    dailyTrend,
    topSearches,
    topDownloads,
    recentEvents,
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchVisitorSummary(
  _idToken: string
): Promise<VisitorSummary> {
  const [eventsSnap, presenceSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, EVENTS_COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(300)
      )
    ),
    getDocs(query(collection(db, PRESENCE_COLLECTION), limit(50))),
  ]);

  const events = eventsSnap.docs.map((d) => ({
    id: d.id,
    data: d.data() as FirestoreEventDoc,
  }));
  const presences = presenceSnap.docs.map(
    (d) => d.data() as FirestorePresenceDoc
  );
  return buildSummaryFromFirestore(events, presences);
}

export async function resetVisitorStats(idToken: string): Promise<void> {
  const [eventsSnap, presenceSnap] = await Promise.all([
    getDocs(query(collection(db, EVENTS_COLLECTION), limit(500))),
    getDocs(query(collection(db, PRESENCE_COLLECTION), limit(200))),
  ]);

  const batch = writeBatch(db);
  eventsSnap.docs.forEach((d) => batch.delete(d.ref));
  presenceSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  // Best-effort reset on Express endpoint if present
  try {
    await fetch('/api/analytics/reset', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    });
  } catch {
    // Ignore on static hosts
  }
}

export function startVisitorPresence(getPath: () => string): () => void {
  const visitorId = getOrCreateVisitorId();
  let stopped = false;

  const sendHeartbeat = async () => {
    if (stopped) return;
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'
    ) {
      return;
    }
    const fallback = parseClientUserAgent();
    const [deviceInfo, ipAddress] = await Promise.all([
      detectClientDeviceInfo().catch(() => ({
        deviceType: fallback.device,
        deviceName: 'Unknown Device',
        browser: fallback.browser,
        os: fallback.os,
      })),
      getVisitorIpAddress(),
    ]);
    if (stopped) return;
    const cleanPath = (getPath() || '/').slice(0, 120) || '/';

    // Write presence to Firestore (real-time across Vercel & AI Studio)
    setDoc(doc(db, PRESENCE_COLLECTION, visitorId), {
      id: visitorId,
      device: deviceInfo.deviceType,
      deviceName: deviceInfo.deviceName.slice(0, 100),
      browser: deviceInfo.browser.slice(0, 40),
      os: deviceInfo.os.slice(0, 40),
      path: cleanPath,
      ipAddress: ipAddress.slice(0, 64),
      searchKeyword: latestSearchKeyword.slice(0, 120),
      lastSeenAt: serverTimestamp(),
    }).catch(() => {});

    // Best-effort Express mirror
    fetch('/api/analytics/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        visitorId,
        path: cleanPath,
        deviceName: deviceInfo.deviceName.slice(0, 100),
        searchKeyword: latestSearchKeyword.slice(0, 120),
      }),
    }).catch(() => {});
  };

  const sendLeave = () => {
    deleteDoc(doc(db, PRESENCE_COLLECTION, visitorId)).catch(() => {});
    const body = JSON.stringify({ visitorId });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/leave', blob);
    }
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      sendHeartbeat();
    }
  };

  sendHeartbeat();
  const intervalId = window.setInterval(sendHeartbeat, 25_000);
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('pagehide', sendLeave);

  return () => {
    stopped = true;
    window.clearInterval(intervalId);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('pagehide', sendLeave);
    sendLeave();
  };
}

export function subscribeVisitorStream(
  _getToken: () => Promise<string>,
  onSummary: (summary: VisitorSummary) => void,
  onStatus: (connected: boolean) => void,
  onError: (err: Error) => void
): () => void {
  let latestEvents: Array<{ id: string; data: FirestoreEventDoc }> = [];
  let latestPresences: FirestorePresenceDoc[] = [];
  let eventsReady = false;
  let presenceReady = false;

  const emit = () => {
    if (eventsReady || presenceReady) {
      onStatus(true);
      onSummary(buildSummaryFromFirestore(latestEvents, latestPresences));
    }
  };

  const unsubEvents = onSnapshot(
    query(
      collection(db, EVENTS_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(300)
    ),
    (snap) => {
      latestEvents = snap.docs.map((d) => ({
        id: d.id,
        data: d.data() as FirestoreEventDoc,
      }));
      eventsReady = true;
      emit();
    },
    (err) => {
      onStatus(false);
      onError(
        err instanceof Error
          ? err
          : new Error('রিয়েল-টাইম ভিজিটর ইভেন্ট লোড করা যায়নি।')
      );
    }
  );

  const unsubPresence = onSnapshot(
    query(collection(db, PRESENCE_COLLECTION), limit(50)),
    (snap) => {
      latestPresences = snap.docs.map(
        (d) => d.data() as FirestorePresenceDoc
      );
      presenceReady = true;
      emit();
    },
    (err) => {
      onStatus(false);
      onError(
        err instanceof Error
          ? err
          : new Error('লাইভ ভিজিটর উপস্থিতি লোড করা যায়নি।')
      );
    }
  );

  // Refresh relative "seconds ago" and prune expired sessions every 10s
  const tickId = window.setInterval(() => {
    if (eventsReady || presenceReady) {
      onSummary(buildSummaryFromFirestore(latestEvents, latestPresences));
    }
  }, 10_000);

  return () => {
    window.clearInterval(tickId);
    unsubEvents();
    unsubPresence();
    onStatus(false);
  };
}
