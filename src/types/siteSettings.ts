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
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  shopMapEnabled: true,
  shopName: 'জননী টেলিকম এন্ড সার্ভিসিং সেন্টার',
  shopAddress: '',
  shopLat: 23.685,
  shopLng: 90.3563,
  shopPinSet: false,
  shopOpen24Hours: true,
  shopStatusNote: '',
  headerBgTheme: 'navy',
  adsenseEnabled: true,
  adsensePublisherId: 'ca-pub-4269885349192047',
  adsenseSlotTop: '',
  adsenseSlotBottom: '',
  seoDescription:
    'জননী টেলিকম এন্ড সার্ভিসিং সেন্টার (01738266366) — যেকোনো মডেলের মোবাইল ফ্ল্যাশ টুলস, স্টক ফার্মওয়্যার, ইউএসবি ড্রাইভার ও সরাসরি ডাউনলোড পোর্টাল।',
  seoKeywords:
    'জননী টেলিকম, Jonnoi Telecom, মোবাইল ফ্ল্যাশ ফাইল, Mobile Flash Tools, Stock Firmware Download, Samsung Flash File, Xiaomi Fastboot ROM, FRP Unlock File, USB Driver, Mobile Servicing Center Bangladesh',
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
