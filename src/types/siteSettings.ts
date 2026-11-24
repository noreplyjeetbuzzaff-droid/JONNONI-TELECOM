export type HeaderBgTheme = 'navy' | 'cobalt' | 'emerald' | 'charcoal' | 'white';

export const HEADER_THEME_META: Record<
  HeaderBgTheme,
  {
    labelBn: string;
    swatchClass: string;
    headerClass: string;
    isDark: boolean;
  }
> = {
  navy: {
    labelBn: 'ডিপ নেভি (ডিফল্ট)',
    swatchClass: 'bg-slate-900',
    headerClass: 'bg-slate-900/95 border-slate-800 text-white',
    isDark: true,
  },
  cobalt: {
    labelBn: 'কোবাল্ট ব্লু',
    swatchClass: 'bg-sky-900',
    headerClass: 'bg-sky-950/95 border-sky-900 text-white',
    isDark: true,
  },
  emerald: {
    labelBn: 'ডার্ক এমারেল্ড',
    swatchClass: 'bg-emerald-900',
    headerClass: 'bg-emerald-950/95 border-emerald-900 text-white',
    isDark: true,
  },
  charcoal: {
    labelBn: 'চারকোল ব্ল্যাক',
    swatchClass: 'bg-zinc-900',
    headerClass: 'bg-zinc-900/95 border-zinc-800 text-white',
    isDark: true,
  },
  white: {
    labelBn: 'ক্লিন হোয়াইট',
    swatchClass: 'bg-white border border-slate-300',
    headerClass: 'bg-white/95 border-slate-200 text-slate-900',
    isDark: false,
  },
};

export interface TickerColorPreset {
  id: string;
  labelBn: string;
  tickerBgColor: string;
  tickerBorderColor: string;
  tickerBadgeBgColor: string;
}

export const TICKER_COLOR_PRESETS: TickerColorPreset[] = [
  {
    id: 'navy-sky',
    labelBn: 'ডিপ নেভি ও স্কাই (ডিফল্ট)',
    tickerBgColor: '#0f172a',
    tickerBorderColor: '#0284c7',
    tickerBadgeBgColor: '#0284c7',
  },
  {
    id: 'emerald-dark',
    labelBn: 'ডার্ক এমারেল্ড গ্রিন',
    tickerBgColor: '#064e3b',
    tickerBorderColor: '#10b981',
    tickerBadgeBgColor: '#059669',
  },
  {
    id: 'royal-cobalt',
    labelBn: 'রয়্যাল কোবাল্ট ব্লু',
    tickerBgColor: '#1e3a8a',
    tickerBorderColor: '#3b82f6',
    tickerBadgeBgColor: '#2563eb',
  },
  {
    id: 'crimson-alert',
    labelBn: 'ক্রিমসন অ্যালার্ট রেড',
    tickerBgColor: '#7f1d1d',
    tickerBorderColor: '#ef4444',
    tickerBadgeBgColor: '#dc2626',
  },
  {
    id: 'amber-light',
    labelBn: 'গোল্ডেন অ্যাম্বার (লাইট)',
    tickerBgColor: '#fffbeb',
    tickerBorderColor: '#d97706',
    tickerBadgeBgColor: '#b45309',
  },
  {
    id: 'clean-slate',
    labelBn: 'ক্লিন হোয়াইট ও স্কাই বর্ডার',
    tickerBgColor: '#f8fafc',
    tickerBorderColor: '#0284c7',
    tickerBadgeBgColor: '#0f172a',
  },
];

export function isValidHexColor(val: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(val.trim());
}

export function getContrastTextColor(hexColor: string): string {
  const clean = hexColor.trim();
  if (!isValidHexColor(clean)) return '#ffffff';
  const r = parseInt(clean.slice(1, 3), 16) / 255;
  const g = parseInt(clean.slice(3, 5), 16) / 255;
  const b = parseInt(clean.slice(5, 7), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.42 ? '#0f172a' : '#ffffff';
}

export interface SiteSettings {
  shopMapEnabled: boolean;
  shopName: string;
  shopAddress: string;
  shopLat: number;
  shopLng: number;
  shopPinSet: boolean;
  shopOpen24Hours: boolean;
  shopStatusNote: string;
  headerBgTheme: HeaderBgTheme;
  adsenseEnabled: boolean;
  adsensePublisherId: string;
  adsenseSlotTop: string;
  adsenseSlotBottom: string;
  seoDescription: string;
  seoKeywords: string;
  tickerBgColor: string;
  tickerBorderColor: string;
  tickerBadgeBgColor: string;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  shopMapEnabled: true,
  shopName: 'জননী টেলিকম অ্যান্ড মোবাইল সার্ভিসিং ট্রেনিং সেন্টার',
  shopAddress: 'মানিকগঞ্জ, খানসামা, দিনাজপুর',
  shopLat: 25.9265,
  shopLng: 88.7425,
  shopPinSet: false,
  shopOpen24Hours: true,
  shopStatusNote: '',
  headerBgTheme: 'navy',
  adsenseEnabled: true,
  adsensePublisherId: 'ca-pub-4269885349192047',
  adsenseSlotTop: '',
  adsenseSlotBottom: '',
  seoDescription:
    'জননী টেলিকম অ্যান্ড মোবাইল সার্ভিসিং ট্রেনিং সেন্টার (মানিকগঞ্জ, খানসামা, দিনাজপুর) — শতভাগ পরীক্ষিত বাটন ও স্মার্টফোন ফ্লাশ ফাইল, হার্ডওয়্যার-সফটওয়্যার সমাধান ও ৩ মাসের ট্রেনিং। কল: 01738266366',
  seoKeywords:
    'জননী টেলিকম, জননী টেলিকম অ্যান্ড মোবাইল সার্ভিসিং ট্রেনিং সেন্টার, মানিকগঞ্জ খানসামা দিনাজপুর, মোবাইল ফ্লাশ ফাইল, হার্ডওয়্যার প্রবলেম সলিউশন, মোবাইল সার্ভিসিং ট্রেনিং, Button Phone Flash File, Smartphone Firmware, Google Drive Download',
  tickerBgColor: '#0f172a',
  tickerBorderColor: '#0284c7',
  tickerBadgeBgColor: '#0284c7',
};

export interface ActiveVisitorInfo {
  id: string;
  device: 'mobile' | 'desktop' | 'tablet';
  browser: string;
  os: string;
  path: string;
  lastActiveSecondsAgo: number;
}

export interface VisitorEventRecord {
  id: string;
  type: 'pageview' | 'search' | 'download';
  path: string;
  label: string;
  device: 'mobile' | 'desktop' | 'tablet';
  browser: string;
  os: string;
  referrer: string;
  timestamp: string;
}

export interface DailyVisitorPoint {
  date: string;
  visits: number;
  uniqueVisitors: number;
  downloads: number;
  searches: number;
}

export interface VisitorSummary {
  liveVisitorsCount: number;
  activeVisitors: ActiveVisitorInfo[];
  totalVisits: number;
  todayVisits: number;
  uniqueVisitors: number;
  todayUniqueVisitors: number;
  totalDownloads: number;
  totalSearches: number;
  deviceCounts: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
  dailyTrend: DailyVisitorPoint[];
  topSearches: Array<{ term: string; count: number }>;
  topDownloads: Array<{ title: string; count: number }>;
  recentEvents: VisitorEventRecord[];
  updatedAt: string;
}
