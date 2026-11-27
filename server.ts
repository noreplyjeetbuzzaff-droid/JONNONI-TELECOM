import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import express from 'express';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRIVE_ID_REGEX = /^[a-zA-Z0-9_-]{5,120}$/;
const DATA_DIR = path.resolve(__dirname, '.data');
const ANALYTICS_FILE = path.join(DATA_DIR, 'visitor-analytics.json');
const ADS_CONFIG_FILE = path.join(DATA_DIR, 'ads-config.json');
const FIREBASE_CONFIG_FILE = path.resolve(__dirname, 'firebase-applet-config.json');
const BOOTSTRAPPED_ADMIN_EMAILS = [
  'noreply.jeetbuzzaff@gmail.com',
  'sflove087@gmail.com',
  'jononitelecom266366@gmail.com',
];
const ACTIVE_SESSION_TTL_MS = 45_000;

interface ActiveVisitorSession {
  id: string;
  device: 'mobile' | 'desktop' | 'tablet';
  deviceName?: string;
  browser: string;
  os: string;
  path: string;
  ipAddress?: string;
  searchKeyword?: string;
  trafficSource?: string;
  lastSeenMs: number;
}

interface VisitorEvent {
  id: string;
  type: 'pageview' | 'search' | 'download';
  path: string;
  label: string;
  device: 'mobile' | 'desktop' | 'tablet';
  deviceName?: string;
  browser: string;
  os: string;
  ipAddress?: string;
  searchKeyword?: string;
  trafficSource?: string;
  referrer: string;
  timestamp: string;
}

interface DailyStatBucket {
  visits: number;
  downloads: number;
  searches: number;
  uniqueHashes: string[];
}

interface StoredAnalytics {
  totalVisits: number;
  totalDownloads: number;
  totalSearches: number;
  uniqueHashes: string[];
  deviceCounts: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
  dailyStats: Record<string, DailyStatBucket>;
  topSearches: Record<string, number>;
  topDownloads: Record<string, { title: string; count: number }>;
  topSources: Record<string, number>;
  recentEvents: VisitorEvent[];
  updatedAt: string;
}

interface StoredAdsConfig {
  adsensePublisherId: string;
  adsenseEnabled: boolean;
}

function createEmptyAnalytics(): StoredAnalytics {
  return {
    totalVisits: 0,
    totalDownloads: 0,
    totalSearches: 0,
    uniqueHashes: [],
    deviceCounts: { mobile: 0, desktop: 0, tablet: 0 },
    dailyStats: {},
    topSearches: {},
    topDownloads: {},
    topSources: {},
    recentEvents: [],
    updatedAt: new Date().toISOString(),
  };
}

let analyticsCache: StoredAnalytics | null = null;
const activeSessions = new Map<string, ActiveVisitorSession>();
const analyticsSseClients = new Set<express.Response>();
let adsConfigCache: StoredAdsConfig = {
  adsensePublisherId: 'ca-pub-4269885349192047',
  adsenseEnabled: true,
};
let firebaseApiKeyCache: string | null = null;
let firebaseProjectIdCache: string | null = null;
let firebaseDbIdCache: string | null = null;

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadFirebaseConfig() {
  if (firebaseApiKeyCache && firebaseProjectIdCache && firebaseDbIdCache) {
    return {
      apiKey: firebaseApiKeyCache,
      projectId: firebaseProjectIdCache,
      databaseId: firebaseDbIdCache,
    };
  }
  const raw = await fs.readFile(FIREBASE_CONFIG_FILE, 'utf8');
  const parsed = JSON.parse(raw) as {
    apiKey: string;
    projectId: string;
    firestoreDatabaseId: string;
  };
  firebaseApiKeyCache = parsed.apiKey;
  firebaseProjectIdCache = parsed.projectId;
  firebaseDbIdCache = parsed.firestoreDatabaseId || '(default)';
  return {
    apiKey: firebaseApiKeyCache,
    projectId: firebaseProjectIdCache,
    databaseId: firebaseDbIdCache,
  };
}

async function loadAnalytics(): Promise<StoredAnalytics> {
  if (analyticsCache) return analyticsCache;
  try {
    const raw = await fs.readFile(ANALYTICS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoredAnalytics>;
    analyticsCache = {
      ...createEmptyAnalytics(),
      ...parsed,
      deviceCounts: {
        mobile: parsed.deviceCounts?.mobile ?? 0,
        desktop: parsed.deviceCounts?.desktop ?? 0,
        tablet: parsed.deviceCounts?.tablet ?? 0,
      },
      uniqueHashes: Array.isArray(parsed.uniqueHashes) ? parsed.uniqueHashes : [],
      dailyStats: parsed.dailyStats || {},
      topSearches: parsed.topSearches || {},
      topDownloads: parsed.topDownloads || {},
      topSources: parsed.topSources || {},
      recentEvents: Array.isArray(parsed.recentEvents) ? parsed.recentEvents : [],
    };
  } catch {
    analyticsCache = createEmptyAnalytics();
  }
  return analyticsCache;
}

async function persistAnalytics(data: StoredAnalytics) {
  analyticsCache = data;
  try {
    await ensureDataDir();
    await fs.writeFile(ANALYTICS_FILE, JSON.stringify(data), 'utf8');
  } catch (err) {
    console.error('Failed to persist visitor analytics:', err);
  }
}

async function loadAdsConfig(): Promise<StoredAdsConfig> {
  try {
    const raw = await fs.readFile(ADS_CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoredAdsConfig>;
    adsConfigCache = {
      adsensePublisherId:
        typeof parsed.adsensePublisherId === 'string' &&
        parsed.adsensePublisherId.trim() !== ''
          ? parsed.adsensePublisherId.trim()
          : 'ca-pub-4269885349192047',
      adsenseEnabled:
        typeof parsed.adsenseEnabled === 'boolean'
          ? parsed.adsenseEnabled
          : true,
    };
  } catch {
    // keep default
  }
  return adsConfigCache;
}

async function persistAdsConfig(config: StoredAdsConfig) {
  adsConfigCache = config;
  try {
    await ensureDataDir();
    await fs.writeFile(ADS_CONFIG_FILE, JSON.stringify(config), 'utf8');
  } catch (err) {
    console.error('Failed to persist ads config:', err);
  }
}

function getTodayKey(): string {
  // Use Asia/Dhaka date string for local shop daily reporting
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function parseUserAgent(ua: string): {
  device: 'mobile' | 'desktop' | 'tablet';
  browser: string;
  os: string;
} {
  const lower = ua.toLowerCase();
  let device: 'mobile' | 'desktop' | 'tablet' = 'desktop';
  if (/ipad|tablet|playbook|silk/i.test(lower) || (/android/i.test(lower) && !/mobile/i.test(lower))) {
    device = 'tablet';
  } else if (/mobile|iphone|ipod|android.*mobile|opera mini|iemobile/i.test(lower)) {
    device = 'mobile';
  }

  let browser = 'Other';
  if (lower.includes('edg/')) browser = 'Edge';
  else if (lower.includes('opr/') || lower.includes('opera')) browser = 'Opera';
  else if (lower.includes('chrome/') && !lower.includes('chromium')) browser = 'Chrome';
  else if (lower.includes('firefox/')) browser = 'Firefox';
  else if (lower.includes('safari/') && !lower.includes('chrome')) browser = 'Safari';

  let os = 'Other';
  if (lower.includes('android')) os = 'Android';
  else if (lower.includes('iphone') || lower.includes('ipad')) os = 'iOS';
  else if (lower.includes('windows')) os = 'Windows';
  else if (lower.includes('mac os')) os = 'macOS';
  else if (lower.includes('linux')) os = 'Linux';

  return { device, browser, os };
}

function hashVisitorKey(req: express.Request, clientVisitorId?: string): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : req.socket.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || '';
  const basis = clientVisitorId ? `${clientVisitorId}:${ua}` : `${ip}:${ua}`;
  return crypto.createHash('sha256').update(basis).digest('hex').slice(0, 20);
}

function getCleanRequestIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : req.socket.remoteAddress || 'Unknown';
  return rawIp.replace(/^::ffff:/i, '').slice(0, 64) || 'Unknown';
}

function detectServerTrafficSource(rawReferrer: string, ua: string): string {
  const ref = rawReferrer.trim().toLowerCase();
  const lowerUa = ua.toLowerCase();
  if (ref.includes('youtube.com') || ref.includes('youtu.be')) return 'YouTube';
  if (ref.includes('tiktok.com')) return 'TikTok';
  if (ref.includes('facebook.com') || ref.includes('fb.com') || ref.includes('fb.watch')) return 'Facebook';
  if (ref.includes('instagram.com')) return 'Instagram';
  if (ref.includes('whatsapp.com') || ref.includes('wa.me')) return 'WhatsApp';
  if (ref.includes('t.me') || ref.includes('telegram.org')) return 'Telegram';
  if (ref.includes('google.')) return 'Google Search';
  if (/fban|fbav|fb_iab|fbios|fb4a/i.test(lowerUa)) return 'Facebook (App)';
  if (/bytedancewebview|tiktok|musical_ly|trill/i.test(lowerUa)) return 'TikTok (App)';
  if (/instagram/i.test(lowerUa)) return 'Instagram (App)';
  if (/youtube/i.test(lowerUa)) return 'YouTube (App)';
  if (/whatsapp/i.test(lowerUa)) return 'WhatsApp';
  return 'Direct (সরাসরি)';
}

async function recordEvent(params: {
  type: 'pageview' | 'search' | 'download';
  path: string;
  label: string;
  referrer: string;
  req: express.Request;
  visitorId?: string;
  deviceName?: string;
  searchKeyword?: string;
  trafficSource?: string;
}) {
  const data = await loadAnalytics();
  const ua = String(params.req.headers['user-agent'] || '');
  const { device, browser, os } = parseUserAgent(ua);
  const ipAddress = getCleanRequestIp(params.req);
  const resolvedSource = (
    params.trafficSource?.trim() ||
    detectServerTrafficSource(params.referrer, ua)
  ).slice(0, 60);
  const vHash = hashVisitorKey(params.req, params.visitorId);
  const dayKey = getTodayKey();

  if (!data.dailyStats[dayKey]) {
    data.dailyStats[dayKey] = {
      visits: 0,
      downloads: 0,
      searches: 0,
      uniqueHashes: [],
    };
  }
  const bucket = data.dailyStats[dayKey];

  if (!data.uniqueHashes.includes(vHash)) {
    data.uniqueHashes.push(vHash);
    if (data.uniqueHashes.length > 5000) {
      data.uniqueHashes = data.uniqueHashes.slice(-4000);
    }
  }
  if (!bucket.uniqueHashes.includes(vHash)) {
    bucket.uniqueHashes.push(vHash);
    if (bucket.uniqueHashes.length > 2000) {
      bucket.uniqueHashes = bucket.uniqueHashes.slice(-1500);
    }
  }

  if (params.type === 'pageview') {
    data.totalVisits += 1;
    bucket.visits += 1;
    data.deviceCounts[device] += 1;
    data.topSources[resolvedSource] = (data.topSources[resolvedSource] || 0) + 1;
  } else if (params.type === 'download') {
    data.totalDownloads += 1;
    bucket.downloads += 1;
    const cleanTitle = (params.label || 'Unknown File').trim().slice(0, 120);
    const key = cleanTitle.toLowerCase();
    if (!data.topDownloads[key]) {
      data.topDownloads[key] = { title: cleanTitle, count: 0 };
    }
    data.topDownloads[key].count += 1;
  } else if (params.type === 'search') {
    data.totalSearches += 1;
    bucket.searches += 1;
    const term = params.label.trim().slice(0, 60);
    if (term.length >= 2) {
      data.topSearches[term] = (data.topSearches[term] || 0) + 1;
    }
  }

  const event: VisitorEvent = {
    id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: params.type,
    path: params.path.slice(0, 120),
    label: params.label.slice(0, 120),
    device,
    deviceName: params.deviceName?.slice(0, 100),
    browser,
    os,
    ipAddress,
    searchKeyword:
      params.type === 'search'
        ? params.label.slice(0, 120)
        : params.searchKeyword?.slice(0, 120),
    trafficSource: resolvedSource,
    referrer: params.referrer.slice(0, 160),
    timestamp: new Date().toISOString(),
  };

  data.recentEvents.unshift(event);
  if (data.recentEvents.length > 150) {
    data.recentEvents = data.recentEvents.slice(0, 150);
  }

  // Prune daily buckets beyond last 30 days
  const dayKeys = Object.keys(data.dailyStats).sort();
  if (dayKeys.length > 30) {
    for (const oldKey of dayKeys.slice(0, dayKeys.length - 30)) {
      delete data.dailyStats[oldKey];
    }
  }

  data.updatedAt = new Date().toISOString();
  await persistAnalytics(data);
  broadcastAnalyticsSnapshot().catch(() => {});
}

function pruneExpiredSessions(): boolean {
  const now = Date.now();
  let removed = false;
  for (const [key, session] of activeSessions.entries()) {
    if (now - session.lastSeenMs > ACTIVE_SESSION_TTL_MS) {
      activeSessions.delete(key);
      removed = true;
    }
  }
  return removed;
}

function buildVisitorSummaryPayload(data: StoredAnalytics) {
  pruneExpiredSessions();
  const now = Date.now();
  const activeVisitors = Array.from(activeSessions.values())
    .sort((a, b) => b.lastSeenMs - a.lastSeenMs)
    .slice(0, 25)
    .map((s) => ({
      id: s.id,
      device: s.device,
      deviceName: s.deviceName,
      browser: s.browser,
      os: s.os,
      path: s.path,
      ipAddress: s.ipAddress,
      searchKeyword: s.searchKeyword,
      trafficSource: s.trafficSource,
      lastActiveSecondsAgo: Math.max(0, Math.round((now - s.lastSeenMs) / 1000)),
    }));

  const todayKey = getTodayKey();
  const todayBucket = data.dailyStats[todayKey] || {
    visits: 0,
    downloads: 0,
    searches: 0,
    uniqueHashes: [],
  };

  const dailyTrend = Object.keys(data.dailyStats)
    .sort()
    .slice(-7)
    .map((date) => ({
      date,
      visits: data.dailyStats[date].visits,
      uniqueVisitors: data.dailyStats[date].uniqueHashes.length,
      downloads: data.dailyStats[date].downloads,
      searches: data.dailyStats[date].searches,
    }));

  const topSearches = Object.entries(data.topSearches)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([term, count]) => ({ term, count }));

  const topDownloads = Object.values(data.topDownloads)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const topSources = Object.entries(data.topSources || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([source, count]) => ({ source, count }));

  return {
    liveVisitorsCount: activeSessions.size,
    activeVisitors,
    totalVisits: data.totalVisits,
    todayVisits: todayBucket.visits,
    uniqueVisitors: data.uniqueHashes.length,
    todayUniqueVisitors: todayBucket.uniqueHashes.length,
    totalDownloads: data.totalDownloads,
    totalSearches: data.totalSearches,
    deviceCounts: data.deviceCounts,
    dailyTrend,
    topSearches,
    topDownloads,
    topSources,
    recentEvents: data.recentEvents.slice(0, 25),
    updatedAt: data.updatedAt,
  };
}

async function broadcastAnalyticsSnapshot() {
  if (analyticsSseClients.size === 0) return;
  const data = await loadAnalytics();
  const payload = `event: summary\ndata: ${JSON.stringify(buildVisitorSummaryPayload(data))}\n\n`;
  for (const client of analyticsSseClients) {
    try {
      client.write(payload);
    } catch {
      analyticsSseClients.delete(client);
    }
  }
}

setInterval(() => {
  if (pruneExpiredSessions()) {
    broadcastAnalyticsSnapshot().catch(() => {});
  }
}, 15_000).unref();

interface VerifiedAdminPermissions {
  manageFiles: boolean;
  viewVisitors: boolean;
  manageSeo: boolean;
  manageSettings: boolean;
  viewLoginHistory: boolean;
  manageAdmins: boolean;
}

const PRIMARY_ADMIN_EMAIL = 'noreply.jeetbuzzaff@gmail.com';

async function verifyAdminBearerToken(authHeader: string | undefined): Promise<{
  uid: string;
  email: string;
  permissions: VerifiedAdminPermissions;
} | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.slice(7).trim();
  if (!idToken) return null;

  try {
    const { apiKey, projectId, databaseId } = await loadFirebaseConfig();
    const lookupRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!lookupRes.ok) return null;
    const lookupJson = (await lookupRes.json()) as {
      users?: Array<{
        localId: string;
        email?: string;
        emailVerified?: boolean;
      }>;
    };
    const user = lookupJson.users?.[0];
    if (!user || !user.emailVerified || !user.email) return null;

    const normalizedEmail = user.email.trim().toLowerCase();
    if (normalizedEmail === PRIMARY_ADMIN_EMAIL) {
      return {
        uid: user.localId,
        email: user.email,
        permissions: {
          manageFiles: true,
          viewVisitors: true,
          manageSeo: true,
          manageSettings: true,
          viewLoginHistory: true,
          manageAdmins: true,
        },
      };
    }

    // Check Administrator-managed /admin_accounts/{email} first
    const managedUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/${encodeURIComponent(databaseId)}/documents/admin_accounts/${encodeURIComponent(
      normalizedEmail
    )}`;
    const managedRes = await fetch(managedUrl, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (managedRes.ok) {
      const managedDoc = (await managedRes.json()) as {
        fields?: {
          active?: { booleanValue?: boolean };
          permissions?: {
            mapValue?: {
              fields?: Record<string, { booleanValue?: boolean }>;
            };
          };
        };
      };
      if (managedDoc.fields?.active?.booleanValue === false) {
        return null;
      }
      const pFields = managedDoc.fields?.permissions?.mapValue?.fields || {};
      return {
        uid: user.localId,
        email: user.email,
        permissions: {
          manageFiles: pFields.manageFiles?.booleanValue === true,
          viewVisitors: pFields.viewVisitors?.booleanValue === true,
          manageSeo: pFields.manageSeo?.booleanValue === true,
          manageSettings: pFields.manageSettings?.booleanValue === true,
          viewLoginHistory: pFields.viewLoginHistory?.booleanValue === true,
          manageAdmins: pFields.manageAdmins?.booleanValue === true,
        },
      };
    }

    if (BOOTSTRAPPED_ADMIN_EMAILS.includes(normalizedEmail)) {
      return {
        uid: user.localId,
        email: user.email,
        permissions: {
          manageFiles: true,
          viewVisitors: true,
          manageSeo: true,
          manageSettings: true,
          viewLoginHistory: true,
          manageAdmins: false,
        },
      };
    }

    // Legacy /admins/{uid} fallback
    const adminDocUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/${encodeURIComponent(databaseId)}/documents/admins/${encodeURIComponent(
      user.localId
    )}`;
    const adminDocRes = await fetch(adminDocUrl, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!adminDocRes.ok) return null;
    const adminDoc = (await adminDocRes.json()) as {
      fields?: { role?: { stringValue?: string } };
    };
    if (adminDoc.fields?.role?.stringValue === 'admin') {
      return {
        uid: user.localId,
        email: user.email,
        permissions: {
          manageFiles: true,
          viewVisitors: true,
          manageSeo: true,
          manageSettings: true,
          viewLoginHistory: true,
          manageAdmins: false,
        },
      };
    }
    return null;
  } catch {
    return null;
  }
}

function getRequestOrigin(req: express.Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured && configured !== 'MY_APP_URL') {
    return configured.replace(/\/+$/, '');
  }
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto =
    typeof protoHeader === 'string'
      ? protoHeader.split(',')[0].trim()
      : req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

function sanitizeFileName(raw: string): string {
  const cleaned = raw.replace(/[/\\?%*:|"<>]/g, '_').trim();
  return cleaned || 'flash_file.bin';
}

function extractDriveConfirmUrl(html: string, driveFileId: string): string | null {
  const confirmMatch = html.match(/name="confirm"\s+value="([^"]+)"/i);
  const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/i);
  const actionMatch = html.match(/action="([^"]+)"/i);

  const baseUrl = actionMatch
    ? actionMatch[1].replace(/&amp;/g, '&')
    : 'https://drive.usercontent.google.com/download';

  const url = new URL(baseUrl);
  url.searchParams.set('id', driveFileId);
  url.searchParams.set('export', 'download');
  url.searchParams.set('confirm', confirmMatch ? confirmMatch[1] : 't');
  if (uuidMatch) {
    url.searchParams.set('uuid', uuidMatch[1]);
  }
  return url.toString();
}

async function resolveDriveStreamResponse(driveFileId: string) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; JonnoiTelecomPortal/1.0)',
  };

  // First try direct usercontent endpoint which bypasses virus-scan interstitials
  const directUserContentUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(driveFileId)}&export=download&confirm=t`;
  const directRes = await fetch(directUserContentUrl, {
    redirect: 'follow',
    headers,
  });
  const directType = directRes.headers.get('content-type') || '';
  if (directRes.ok && !directType.includes('text/html')) {
    return directRes;
  }
  if (directRes.body) {
    await directRes.body.cancel().catch(() => {});
  }

  // Fallback to drive.google.com/uc and parse HTML confirmation form if present
  const initialUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileId)}`;
  let response = await fetch(initialUrl, {
    redirect: 'follow',
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    const html = await response.text();
    const cookies = response.headers.get('set-cookie') || '';
    const confirmUrl = extractDriveConfirmUrl(html, driveFileId);
    if (confirmUrl) {
      response = await fetch(confirmUrl, {
        redirect: 'follow',
        headers: {
          ...headers,
          ...(cookies ? { Cookie: cookies } : {}),
        },
      });
    }
  }

  return response;
}

function resolveServerPort(): number {
  const portArgIdx = process.argv.indexOf('--port');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    const cliPort = Number(process.argv[portArgIdx + 1]);
    if (Number.isFinite(cliPort) && cliPort > 0) return cliPort;
  }
  const envPort = Number(process.env.PORT);
  const nginxPort = Number(process.env.NGINX_PORT);
  if (Number.isFinite(envPort) && envPort > 0 && envPort !== nginxPort) {
    return envPort;
  }
  const defaultAppPort = Number(process.env.DEFAULT_APP_PORT);
  if (Number.isFinite(defaultAppPort) && defaultAppPort > 0) {
    return defaultAppPort;
  }
  return 3000;
}

async function createServer() {
  const app = express();
  const PORT = resolveServerPort();
  const isProd = process.env.NODE_ENV === 'production';

  await loadAnalytics();
  await loadAdsConfig();

  app.use(express.json({ limit: '32kb' }));

  // SEO: robots.txt
  app.get('/robots.txt', (req, res) => {
    const origin = getRequestOrigin(req);
    res.type('text/plain').send(
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        `Sitemap: ${origin}/sitemap.xml`,
      ].join('\n')
    );
  });

  // SEO: Dynamic sitemap.xml
  app.get('/sitemap.xml', (req, res) => {
    const origin = getRequestOrigin(req);
    const today = new Date().toISOString().split('T')[0];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${origin}/#search-menu</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${origin}/#servicing</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${origin}/#guide</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;
    res.type('application/xml').send(xml);
  });

  // AdSense: ads.txt verification file
  app.get('/ads.txt', async (_req, res) => {
    const cfg = await loadAdsConfig();
    const cleanId = cfg.adsensePublisherId.replace(/^ca-/, '').trim();
    if (cleanId && /^pub-\d{10,20}$/.test(cleanId)) {
      res
        .type('text/plain')
        .send(`google.com, ${cleanId}, DIRECT, f08c47fec0942fa0\n`);
      return;
    }
    res
      .type('text/plain')
      .send(
        '# Jonnoi Telecom & Servicing Center ads.txt\n# Configure your AdSense Publisher ID (ca-pub-...) in the Admin Panel to activate.\n'
      );
  });

  // Google Search Console: HTML file verification
  app.get('/google4c5053fb0dbbad06.html', (_req, res) => {
    res
      .type('text/html')
      .send('google-site-verification: google4c5053fb0dbbad06.html\n');
  });

  // Admin: Client IP & Device Info for Login Info History
  app.get('/api/client-info', async (req, res) => {
    const admin = await verifyAdminBearerToken(req.headers.authorization);
    if (!admin) {
      res.status(401).json({ error: 'অ্যাডমিন অনুমোদন প্রয়োজন।' });
      return;
    }
    const forwarded = req.headers['x-forwarded-for'];
    const rawIp = Array.isArray(forwarded)
      ? forwarded[0]
      : typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.socket.remoteAddress || 'Unknown';
    const cleanIp = rawIp.replace(/^::ffff:/i, '').slice(0, 64) || 'Unknown';
    const ua = String(req.headers['user-agent'] || '');
    const { device, browser, os } = parseUserAgent(ua);
    res.json({
      ipAddress: cleanIp,
      device,
      browser,
      os,
    });
  });

  // Admin: sync AdSense publisher ID for ads.txt
  app.post('/api/admin/ads-config', async (req, res) => {
    const admin = await verifyAdminBearerToken(req.headers.authorization);
    if (!admin || (!admin.permissions.manageSettings && !admin.permissions.manageSeo)) {
      res.status(403).json({ error: 'সেটিংস পরিবর্তনের অ্যাডমিন অনুমতি প্রয়োজন।' });
      return;
    }
    const pubId =
      typeof req.body?.adsensePublisherId === 'string'
        ? req.body.adsensePublisherId.trim()
        : '';
    if (pubId && !/^ca-pub-\d{10,20}$/.test(pubId)) {
      res.status(400).json({ error: 'Invalid AdSense Publisher ID format.' });
      return;
    }
    await persistAdsConfig({
      adsensePublisherId: pubId,
      adsenseEnabled: Boolean(req.body?.adsenseEnabled),
    });
    res.json({ ok: true });
  });

  // Visitor: Return caller's own public/forwarded IP for analytics capture
  app.get('/api/visitor-ip', (req, res) => {
    res.json({ ipAddress: getCleanRequestIp(req) });
  });

  // Visitor Tracking: Record event
  app.post('/api/analytics/track', async (req, res) => {
    const rawType = req.body?.type;
    if (
      rawType !== 'pageview' &&
      rawType !== 'search' &&
      rawType !== 'download'
    ) {
      res.status(400).json({ error: 'Invalid analytics event type.' });
      return;
    }

    const eventPath =
      typeof req.body?.path === 'string' ? req.body.path : '/';
    const label =
      typeof req.body?.label === 'string' ? req.body.label : '';
    const visitorId =
      typeof req.body?.visitorId === 'string' ? req.body.visitorId : undefined;
    const referrer =
      typeof req.body?.referrer === 'string' ? req.body.referrer : 'Direct';
    const deviceName =
      typeof req.body?.deviceName === 'string'
        ? req.body.deviceName.slice(0, 100)
        : undefined;
    const searchKeyword =
      typeof req.body?.searchKeyword === 'string'
        ? req.body.searchKeyword.slice(0, 120)
        : undefined;
    const trafficSource =
      typeof req.body?.trafficSource === 'string'
        ? req.body.trafficSource.slice(0, 60)
        : undefined;

    await recordEvent({
      type: rawType,
      path: eventPath,
      label,
      referrer,
      req,
      visitorId,
      deviceName,
      searchKeyword,
      trafficSource,
    });
    res.status(204).end();
  });

  // Real-time Visitor Presence Heartbeat
  app.post('/api/analytics/heartbeat', (req, res) => {
    const visitorId =
      typeof req.body?.visitorId === 'string' ? req.body.visitorId : undefined;
    const currentPath =
      typeof req.body?.path === 'string'
        ? req.body.path.slice(0, 120)
        : '/';
    const deviceName =
      typeof req.body?.deviceName === 'string'
        ? req.body.deviceName.slice(0, 100)
        : undefined;
    const searchKeyword =
      typeof req.body?.searchKeyword === 'string'
        ? req.body.searchKeyword.slice(0, 120)
        : undefined;
    const trafficSource =
      typeof req.body?.trafficSource === 'string'
        ? req.body.trafficSource.slice(0, 60)
        : undefined;
    const ua = String(req.headers['user-agent'] || '');
    const { device, browser, os } = parseUserAgent(ua);
    const ipAddress = getCleanRequestIp(req);
    const sessionKey = hashVisitorKey(req, visitorId);
    const prev = activeSessions.get(sessionKey);
    const shouldBroadcast =
      !prev || prev.path !== currentPath || prev.searchKeyword !== searchKeyword;

    activeSessions.set(sessionKey, {
      id: sessionKey.slice(0, 8),
      device,
      deviceName,
      browser,
      os,
      path: currentPath,
      ipAddress,
      searchKeyword: searchKeyword || prev?.searchKeyword,
      trafficSource: trafficSource || prev?.trafficSource,
      lastSeenMs: Date.now(),
    });

    if (shouldBroadcast) {
      broadcastAnalyticsSnapshot().catch(() => {});
    }
    res.status(204).end();
  });

  // Real-time Visitor Leave Signal
  app.post('/api/analytics/leave', express.text({ limit: '4kb' }), (req, res) => {
    let visitorId: string | undefined;
    if (req.body && typeof req.body === 'object' && 'visitorId' in req.body) {
      const val = (req.body as { visitorId?: unknown }).visitorId;
      if (typeof val === 'string') visitorId = val;
    } else if (typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body) as { visitorId?: unknown };
        if (typeof parsed.visitorId === 'string') visitorId = parsed.visitorId;
      } catch {
        // ignore invalid body
      }
    }
    const sessionKey = hashVisitorKey(req, visitorId);
    if (activeSessions.delete(sessionKey)) {
      broadcastAnalyticsSnapshot().catch(() => {});
    }
    res.status(204).end();
  });

  // Admin: Real-Time SSE Visitor Analytics Stream
  app.get('/api/analytics/stream', async (req, res) => {
    const admin = await verifyAdminBearerToken(req.headers.authorization);
    if (!admin || !admin.permissions.viewVisitors) {
      res.status(403).json({ error: 'ভিজিটর বিশ্লেষণ দেখার অনুমতি প্রয়োজন।' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    analyticsSseClients.add(res);
    const data = await loadAnalytics();
    res.write(
      `event: summary\ndata: ${JSON.stringify(buildVisitorSummaryPayload(data))}\n\n`
    );

    const keepAliveTimer = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepAliveTimer);
        analyticsSseClients.delete(res);
      }
    }, 20_000);

    req.on('close', () => {
      clearInterval(keepAliveTimer);
      analyticsSseClients.delete(res);
    });
  });

  // Admin: Visitor Analytics Summary
  app.get('/api/analytics/summary', async (req, res) => {
    const admin = await verifyAdminBearerToken(req.headers.authorization);
    if (!admin || !admin.permissions.viewVisitors) {
      res.status(403).json({ error: 'ভিজিটর বিশ্লেষণ দেখার অনুমতি প্রয়োজন।' });
      return;
    }

    const data = await loadAnalytics();
    res.json(buildVisitorSummaryPayload(data));
  });

  // Admin: Reset Visitor Analytics
  app.post('/api/analytics/reset', async (req, res) => {
    const admin = await verifyAdminBearerToken(req.headers.authorization);
    if (!admin || !admin.permissions.viewVisitors) {
      res.status(403).json({ error: 'ভিজিটর পরিসংখ্যান রিসেট করার অনুমতি প্রয়োজন।' });
      return;
    }
    const fresh = createEmptyAnalytics();
    await persistAnalytics(fresh);
    broadcastAnalyticsSnapshot().catch(() => {});
    res.json({ ok: true });
  });

  // Direct Web Download Proxy (Never redirects users to Google Drive)
  app.get('/api/download/:driveFileId', async (req, res) => {
    const driveFileId = req.params.driveFileId;
    if (!DRIVE_ID_REGEX.test(driveFileId)) {
      res.status(400).json({ error: 'Invalid file identifier.' });
      return;
    }

    const rawName = typeof req.query.name === 'string' ? req.query.name : 'download.bin';
    const fileName = sanitizeFileName(rawName);
    const isProbe = req.query.probe === '1';

    try {
      const upstream = await resolveDriveStreamResponse(driveFileId);
      const upstreamType = upstream.headers.get('content-type') || 'application/octet-stream';

      if (!upstream.ok || upstreamType.includes('text/html')) {
        if (upstream.body) {
          await upstream.body.cancel().catch(() => {});
        }
        res.status(404).json({
          ready: false,
          error: 'ফাইলটি সরাসরি ডাউনলোডের জন্য উন্মুক্ত নয় অথবা গুগল ড্রাইভে পাওয়া যায়নি।',
        });
        return;
      }

      if (isProbe) {
        const contentLength = upstream.headers.get('content-length');
        if (upstream.body) {
          await upstream.body.cancel().catch(() => {});
        }
        res.json({
          ready: true,
          contentType: upstreamType,
          contentLength: contentLength ? Number(contentLength) : null,
        });
        return;
      }

      // Record real direct download event server-side
      recordEvent({
        type: 'download',
        path: '/api/download',
        label: fileName,
        referrer: String(req.headers.referer || 'Direct'),
        req,
      }).catch(() => {});

      res.setHeader('Content-Type', upstreamType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
      );
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      if (!upstream.body) {
        res.status(502).json({ error: 'Empty stream from storage.' });
        return;
      }

      const nodeStream = Readable.fromWeb(
        upstream.body as unknown as WebReadableStream<Uint8Array>
      );
      nodeStream.on('error', (err) => {
        console.error('Stream error:', err);
        if (!res.headersSent) {
          res.status(500).end();
        } else {
          res.destroy();
        }
      });
      nodeStream.pipe(res);
    } catch (err) {
      console.error('Direct download proxy error:', err);
      res.status(500).json({
        ready: false,
        error: 'ডাউনলোড শুরু করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
      });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: disableHmr ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer();
