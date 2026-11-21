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
