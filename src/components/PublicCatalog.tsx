import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Clock,
  Cpu,
  Download,
  FileCode2,
  GraduationCap,
  HardDrive,
  History,
  Info,
  MapPin,
  Megaphone,
  MessageSquare,
  Phone,
  Search,
  Smartphone,
  Wrench,
  X,
} from 'lucide-react';
import {
  CATEGORY_LABELS_BN,
  CHIPSET_LABELS_BN,
  CHIPSET_PLATFORMS,
  FILE_CATEGORIES,
  FlashFileRecord,
  formatBytes,
  formatDownloadCount,
  formatPriceBn,
  formatTimestamp,
} from '../types/flashFile';
import { getContrastTextColor, SiteSettings } from '../types/siteSettings';
import { trackVisitorEvent } from '../lib/analyticsClient';
import { DownloadConfirmModal } from './DownloadConfirmModal';
import { FileDetailModal } from './FileDetailModal';
import { LoadingSpinner } from './LoadingSpinner';
import { ShopMapSection } from './ShopMapSection';
import { ServicingGuideSection } from './ServicingGuideSection';
import { AdSenseUnit } from './AdSenseBanner';
import youtubeBannerImg from '../assets/images/youtube_shop_banner_1794752535651.jpg';
import benchImageImg from '../assets/images/servicing_chip_workbench_1794725615159.jpg';

interface PublicCatalogProps {
  files: FlashFileRecord[];
  loading: boolean;
  error: string | null;
  siteSettings: SiteSettings;
  onOpenAdmin: () => void;
}

const YOUTUBE_BANNER_SRC = youtubeBannerImg;
const BENCH_IMAGE_SRC = benchImageImg;
const SEARCH_HISTORY_STORAGE_KEY = 'jt_search_history_v1';
const MAX_SEARCH_HISTORY = 5;

function loadSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cleaned: string[] = [];
    for (const item of parsed) {
      if (typeof item !== 'string') continue;
      const trimmed = item.trim().slice(0, 60);
      if (
        trimmed.length >= 2 &&
        !cleaned.some((c) => c.toLowerCase() === trimmed.toLowerCase())
      ) {
        cleaned.push(trimmed);
      }
      if (cleaned.length >= MAX_SEARCH_HISTORY) break;
    }
    return cleaned;
  } catch {
    return [];
  }
}

function persistSearchHistory(items: string[]): void {
  try {
    localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export const PublicCatalog: React.FC<PublicCatalogProps> = ({
  files,
  loading,
  error,
  siteSettings,
  onOpenAdmin,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>(() =>
    loadSearchHistory()
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [selectedChipset, setSelectedChipset] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'model' | 'size'>('newest');
  const [detailFile, setDetailFile] = useState<FlashFileRecord | null>(null);
  const [confirmDownloadFile, setConfirmDownloadFile] =
    useState<FlashFileRecord | null>(null);

  const [bannerImgError, setBannerImgError] = useState(false);
  const [benchImgError, setBenchImgError] = useState(false);

  // Recent download initiated feedback on card
  const [startedId, setStartedId] = useState<string | null>(null);

  // WhatsApp file request mini-form
  const [reqBrand, setReqBrand] = useState('');
  const [reqModel, setReqModel] = useState('');
  const [reqNote, setReqNote] = useState('');

  const recordSearchHistory = useCallback((term: string) => {
    const clean = term.trim().slice(0, 60);
    if (clean.length < 2) return;
    setSearchHistory((prev) => {
      const next = [
        clean,
        ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase()),
      ].slice(0, MAX_SEARCH_HISTORY);
      persistSearchHistory(next);
      return next;
    });
  }, []);

  const handleClearSearchHistory = useCallback(() => {
    setSearchHistory([]);
    persistSearchHistory([]);
  }, []);

  // Debounced search visitor tracking + save to localStorage search history
  const lastTrackedSearchRef = useRef('');
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) return;
    const timer = setTimeout(() => {
      recordSearchHistory(trimmed);
      if (lastTrackedSearchRef.current !== trimmed) {
        lastTrackedSearchRef.current = trimmed;
        trackVisitorEvent({
          type: 'search',
          path: '/#search-menu',
          label: trimmed,
        });
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [searchQuery, recordSearchHistory]);

  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    files.forEach((f) => {
      if (f.brand) set.add(f.brand);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [files]);

  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = files.filter((file) => {
      if (selectedCategory !== 'All' && file.category !== selectedCategory) {
        return false;
      }
      if (selectedBrand !== 'All' && file.brand !== selectedBrand) {
        return false;
      }
      if (selectedChipset !== 'All' && file.chipset !== selectedChipset) {
        return false;
      }
      if (!q) return true;
      return (
        file.title.toLowerCase().includes(q) ||
        file.brand.toLowerCase().includes(q) ||
        file.model.toLowerCase().includes(q) ||
        file.fileName.toLowerCase().includes(q) ||
        file.chipset.toLowerCase().includes(q) ||
        file.version.toLowerCase().includes(q) ||
        file.notes.toLowerCase().includes(q)
      );
    });

    if (sortBy === 'model') {
      return [...list].sort((a, b) => a.model.localeCompare(b.model));
    }
    if (sortBy === 'size') {
      return [...list].sort((a, b) => b.fileSizeBytes - a.fileSizeBytes);
    }
    return list;
  }, [
    files,
    searchQuery,
    selectedCategory,
    selectedBrand,
    selectedChipset,
    sortBy,
  ]);

  const resolvedAddress =
    siteSettings.shopAddress?.trim() || 'মানিকগঞ্জ, খানসামা, দিনাজপুর';

  const tickerText = useMemo(() => {
    const latestModels = files
      .slice(0, 4)
      .map((f) => `${f.brand} ${f.model} (${formatPriceBn(f.price)})`)
      .join('  •  ');
    const baseItems = [
      'সকল ধরনের বাটন ও স্মার্টফোনের ফ্লাশ ফাইল সহজে গুগল ড্রাইভের মাধ্যমে ডাউনলোড করা যায় — প্রতিটি ফাইল শতভাগ পরীক্ষিত',
      'এছাড়াও এখানে মোবাইল সংক্রান্ত হার্ডওয়্যার ও সফটওয়্যার সমস্যার সমাধান দেওয়া হয় এবং দক্ষ টেকনিশিয়ান দ্বারা ট্রেনিং দেওয়া হয়',
      `তাই আজই চলে আসুন আমাদের ট্রেনিং সেন্টারে (${resolvedAddress}) | তিন মাসে হয়ে উঠুন একজন দক্ষ টেকনিশিয়ান`,
      'সরাসরি যোগাযোগ ও ভর্তি হেল্পলাইন: 01738266366 (কল ও হোয়াটসঅ্যাপ)',
    ];
    if (latestModels) {
      baseItems.push(`নতুন আপলোড: ${latestModels}`);
    }
    return baseItems.join('   ★   ');
  }, [files, resolvedAddress]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCategory !== 'All' ||
    selectedBrand !== 'All' ||
    selectedChipset !== 'All';

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedBrand('All');
    setSelectedChipset('All');
  };

  const handleDownloadStartedFeedback = useCallback((fileId: string) => {
    setStartedId(fileId);
    setTimeout(() => {
      setStartedId((curr) => (curr === fileId ? null : curr));
    }, 2800);
  }, []);

  const activeDetailFile = useMemo(
    () =>
      detailFile
        ? files.find((f) => f.id === detailFile.id) || detailFile
        : null,
    [files, detailFile]
  );

  const activeConfirmDownloadFile = useMemo(
    () =>
      confirmDownloadFile
        ? files.find((f) => f.id === confirmDownloadFile.id) ||
          confirmDownloadFile
        : null,
    [files, confirmDownloadFile]
  );

  const handleWhatsAppRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = `আসসালামু আলাইকুম ${siteSettings.shopName}, আমার একটি মোবাইল ফ্ল্যাশ ফাইল বা সার্ভিসিং/ট্রেনিং তথ্য প্রয়োজন।\nব্র্যান্ড: ${
      reqBrand.trim() || 'যেকোনো'
    }\nমডেল: ${reqModel.trim() || 'উল্লেখ করা হয়নি'}\nবিবরণ: ${
      reqNote.trim() || 'দয়া করে বিস্তারিত জানাবেন।'
    }`;
    const url = `https://wa.me/8801738266366?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div>
      {/* YouTube-Style Channel Art Banner (BG Removed Studio Portrait) */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="relative min-h-[210px] sm:min-h-[245px] lg:min-h-[280px] w-full overflow-hidden">
            {!bannerImgError ? (
              <img
                src={YOUTUBE_BANNER_SRC}
                alt={`${siteSettings.shopName} ব্যানার`}
                onError={() => setBannerImgError(true)}
                className="absolute inset-0 h-full w-full object-cover object-right-top"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950" />
            )}

            {/* Contrast Scrim: preserves crisp left text & clear right portrait */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 sm:via-slate-950/80 to-transparent"
            />

            <div className="relative z-10 flex h-full min-h-[210px] sm:min-h-[245px] lg:min-h-[280px] flex-col justify-center px-4 py-6 sm:px-8 lg:px-10">
              <div className="max-w-[78%] sm:max-w-[66%] lg:max-w-[62%]">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <p className="text-[11px] font-semibold tracking-wide text-sky-300 sm:text-xs">
                    {siteSettings.shopName} · {resolvedAddress}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold sm:text-[11px] ${
                      siteSettings.shopOpen24Hours
                        ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                        : 'border-rose-400/40 bg-rose-500/20 text-rose-200'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        siteSettings.shopOpen24Hours
                          ? 'bg-emerald-400 animate-pulse'
                          : 'bg-rose-400'
                      }`}
                    />
                    <span>
                      {siteSettings.shopOpen24Hours
                        ? '২৪ ঘণ্টা খোলা'
                        : 'এখন দোকান বন্ধ'}
                    </span>
                  </span>
                </div>
                <h1
                  className="mt-2 font-display text-lg font-bold leading-snug tracking-tight text-white sm:text-3xl lg:text-4xl"
                  style={{ textWrap: 'balance' }}
                >
                  মোবাইল ফ্ল্যাশ ফাইল এন্ড হার্ডওয়্যার প্রবলেম সলিউশন
                </h1>
                <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-slate-200 sm:text-sm">
                  সকল ধরনের বাটন ও স্মার্টফোনের শতভাগ পরীক্ষিত ফ্লাশ ফাইল সহজে
                  গুগল ড্রাইভ থেকে ডাউনলোড, হার্ডওয়্যার-সফটওয়্যার সমাধান এবং
                  তিন মাসে দক্ষ টেকনিশিয়ান হওয়ার ট্রেনিং সেন্টার।
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <a
                    href="#search-menu"
                    className="btn-3d-primary inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0 sm:px-4 sm:py-2.5 sm:text-sm"
                  >
                    <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>ফাইল খুঁজুন</span>
                  </a>
                  <a
                    href="#servicing"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-950/60 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-900/70 transition-colors whitespace-nowrap shrink-0 sm:px-4 sm:py-2.5 sm:text-sm"
                  >
                    <GraduationCap className="h-3.5 w-3.5 text-sky-300 sm:h-4 sm:w-4" />
                    <span>৩ মাসের ট্রেনিং</span>
                  </a>
                  <a
                    href="tel:01738266366"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/85 px-3 py-2 font-mono text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 sm:px-4 sm:py-2.5 sm:text-sm"
                  >
                    <Phone className="h-3.5 w-3.5 text-sky-400" />
                    <span>01738266366</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Scrolling News Heading Text (News Ticker) */}
      <div
        className="border-y-2 transition-colors duration-200"
        style={{
          backgroundColor: siteSettings.tickerBgColor || '#0f172a',
          borderTopColor: siteSettings.tickerBorderColor || '#0284c7',
          borderBottomColor: siteSettings.tickerBorderColor || '#0284c7',
          color: getContrastTextColor(siteSettings.tickerBgColor || '#0f172a'),
        }}
        role="region"
        aria-label="সর্বশেষ সংবাদ ও আপডেট"
      >
        <div className="mx-auto flex max-w-7xl items-center overflow-hidden">
          <div
            className="z-10 flex items-center gap-1 px-2 py-1 text-[10px] font-bold whitespace-nowrap shrink-0 transition-colors duration-200 sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-[11px]"
            style={{
              backgroundColor: siteSettings.tickerBadgeBgColor || '#0284c7',
              color: getContrastTextColor(
                siteSettings.tickerBadgeBgColor || '#0284c7'
              ),
            }}
          >
            <Megaphone className="h-3 w-3 shrink-0" />
            <span>সর্বশেষ আপডেট</span>
          </div>
          <div className="relative flex-1 overflow-hidden py-1 sm:py-1.5">
            <div className="animate-news-marquee text-xs font-medium sm:text-sm">
              <span className="px-5 whitespace-nowrap">{tickerText}</span>
              <span className="px-5 whitespace-nowrap" aria-hidden="true">
                {tickerText}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Optional AdSense Top Responsive Unit (renders only when configured) */}
      <AdSenseUnit
        enabled={siteSettings.adsenseEnabled}
        publisherId={siteSettings.adsensePublisherId}
        slotId={siteSettings.adsenseSlotTop}
      />

      {/* File Search Menu & 3D Post Cards Catalog */}
      <section
        id="search-menu"
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
      >
        <div
          id="catalog"
          className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              ফাইল সার্চ মেনু ও ডাউনলোড পোস্ট
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 sm:text-sm">
              মডেল বা ব্র্যান্ড লিখে সার্চ করুন এবং কোনো ড্রাইভ লিংকে না গিয়ে
              সরাসরি ডাউনলোড করুন।
            </p>
          </div>
          <p className="font-mono text-xs font-semibold text-slate-600 tabular-nums">
            {loading
              ? 'লোড হচ্ছে...'
              : `মোট ${files.length}টি ফাইলের মধ্যে ${filteredFiles.length}টি`}
          </p>
        </div>

        {/* Search & Filter Panel */}
        <div className="card-3d mt-5 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5">
          {/* LocalStorage Recent Search History (Last 5 Model Names) Above Search Bar */}
          {searchHistory.length > 0 && (
            <div
              className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3"
              aria-label="সাম্প্রতিক সার্চ করা মডেলসমূহ"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 whitespace-nowrap shrink-0">
                <History className="h-3.5 w-3.5 text-sky-600" />
                <span>সাম্প্রতিক সার্চ:</span>
              </span>
              <ul className="flex flex-wrap items-center gap-1.5">
                {searchHistory.map((term) => (
                  <li key={term}>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery(term);
                        recordSearchHistory(term);
                      }}
                      className={`inline-flex items-center rounded-md border px-2.5 py-1 font-mono text-xs font-medium transition-colors cursor-pointer ${
                        searchQuery.trim().toLowerCase() === term.toLowerCase()
                          ? 'border-sky-500 bg-sky-50 text-sky-900'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 hover:bg-sky-50/70 hover:text-sky-800'
                      }`}
                    >
                      {term}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleClearSearchHistory}
                className="ml-auto text-[11px] font-medium text-slate-400 hover:text-slate-700 underline underline-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                ইতিহাস মুছুন
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            {/* Search Input */}
            <div className="relative lg:col-span-6">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    recordSearchHistory(searchQuery);
                  }
                }}
                placeholder="মডেল (SM-A546E, RMX3710), ব্র্যান্ড বা টুলের নাম..."
                aria-label="মডেল, ব্র্যান্ড বা টুলের নাম দিয়ে ফাইল খুঁজুন"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="সার্চ মুছুন"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 lg:col-span-6">
              {/* Brand Dropdown */}
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                aria-label="ব্র্যান্ড ফিল্টার"
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              >
                <option value="All">সব ব্র্যান্ড</option>
                {availableBrands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>

              {/* Chipset Dropdown */}
              <select
                value={selectedChipset}
                onChange={(e) => setSelectedChipset(e.target.value)}
                aria-label="চিপসেট ফিল্টার"
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              >
                <option value="All">সব চিপসেট</option>
                {CHIPSET_PLATFORMS.map((c) => (
                  <option key={c} value={c}>
                    {CHIPSET_LABELS_BN[c]}
                  </option>
                ))}
              </select>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as 'newest' | 'model' | 'size')
                }
                aria-label="সাজানোর ধরন"
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              >
                <option value="newest">নতুন আগে</option>
                <option value="model">মডেল (A–Z)</option>
                <option value="size">বড় ফাইল</option>
              </select>
            </div>
          </div>

          {/* Segmented Category Filter Tabs */}
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3.5">
            <div
              className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1"
              role="tablist"
              aria-label="ক্যাটাগরি অনুযায়ী ফাইল ফিল্টার"
            >
              <button
                type="button"
                role="tab"
                aria-selected={selectedCategory === 'All'}
                onClick={() => setSelectedCategory('All')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategory === 'All'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                সব ফাইল
              </button>
              {FILE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {CATEGORY_LABELS_BN[cat]}
                </button>
              ))}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-medium text-sky-700 hover:text-sky-800 underline underline-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                ফিল্টার রিসেট করুন
              </button>
            )}
          </div>
        </div>

        {/* Catalog Error */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm text-red-700">
            ক্যাটালগ লোড করা যায়নি: {error}
          </div>
        )}

        {/* Unique 3D Post Cards Grid / Loading Spinner / Empty State */}
        <div className="mt-6">
          {loading ? (
            <div className="card-3d rounded-xl border border-slate-200 bg-white px-6 py-16">
              <LoadingSpinner
                variant="card"
                size="lg"
                label="ফাইল ক্যাটালগ লোড হচ্ছে..."
                sublabel="শতভাগ পরীক্ষিত ফ্লাশ ফাইল তালিকা প্রস্তুত হচ্ছে — অনুগ্রহ করে অপেক্ষা করুন"
              />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="card-3d rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
              <p className="font-display text-base font-semibold text-slate-900">
                {files.length === 0
                  ? 'এখনো কোনো ফ্ল্যাশ ফাইল প্রকাশ করা হয়নি'
                  : 'আপনার খোঁজা অনুযায়ী কোনো ফাইল পাওয়া যায়নি'}
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
                {files.length === 0
                  ? 'অ্যাডমিন সাইন ইন করে যেকোনো মডেলের মোবাইল ফ্ল্যাশ টুলস ও ফার্মওয়্যার সরাসরি গুগল ড্রাইভে আপলোড করতে পারবেন।'
                  : 'অনুগ্রহ করে সার্চ শব্দ, ব্র্যান্ড বা ক্যাটাগরি পরিবর্তন করে দেখুন অথবা 01738266366 নম্বরে অনুরোধ পাঠান।'}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    সব ফিল্টার মুছুন
                  </button>
                )}
                {files.length === 0 && (
                  <button
                    type="button"
                    onClick={onOpenAdmin}
                    className="btn-3d-primary rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 cursor-pointer"
                  >
                    অ্যাডমিন লগইন ও আপলোড
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredFiles.map((file) => {
                const isDone = startedId === file.id;
                const isPaid = Boolean(file.price && file.price > 0);
                const dlCount = formatDownloadCount(file.downloadCount);

                return (
                  <article
                    key={file.id}
                    className="card-3d flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
                  >
                    <div>
                      {/* 3D Post Header: Beveled Icon + Brand/Model + App Price */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-[0_4px_0_0_#0369a1]"
                            aria-hidden="true"
                          >
                            <FileCode2 className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-sky-700 truncate">
                              {file.brand}
                            </p>
                            <p className="font-mono text-xs font-bold text-slate-900 truncate">
                              {file.model}
                            </p>
                          </div>
                        </div>

                        {/* App / File Price */}
                        <div className="shrink-0 text-right">
                          <span
                            className={`font-mono text-sm font-bold tabular-nums ${
                              isPaid ? 'text-amber-700' : 'text-emerald-700'
                            }`}
                          >
                            {formatPriceBn(file.price)}
                          </span>
                        </div>
                      </div>

                      {/* Post Title */}
                      <h3 className="mt-4 font-display text-base font-bold leading-snug text-slate-900">
                        <button
                          type="button"
                          onClick={() => setDetailFile(file)}
                          className="text-left hover:text-sky-700 transition-colors cursor-pointer"
                        >
                          {file.title}
                        </button>
                      </h3>

                      {/* Clean Unboxed Metadata */}
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">
                        <span className="font-medium text-slate-700">
                          {CATEGORY_LABELS_BN[file.category] || file.category}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>
                          {CHIPSET_LABELS_BN[file.chipset] || file.chipset}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono text-slate-700">
                          {file.version}
                        </span>
                      </p>

                      <p className="mt-1 text-xs text-slate-500 tabular-nums">
                        সাইজ:{' '}
                        <span className="font-mono font-semibold text-slate-800">
                          {formatBytes(file.fileSizeBytes)}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>
                          ডাউনলোড:{' '}
                          <span className="font-mono font-semibold text-slate-800">
                            {dlCount}
                          </span>{' '}
                          বার
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>{formatTimestamp(file.createdAt)}</span>
                      </p>

                      {file.notes && (
                        <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-slate-600">
                          {file.notes}
                        </p>
                      )}
                    </div>

                    {/* Card Footer: Opens Confirmation Modal instead of immediate download */}
                    <div className="mt-4 border-t border-slate-100 pt-3.5">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setDetailFile(file)}
                          className="inline-flex min-h-[44px] sm:min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
                        >
                          <Info className="h-3.5 w-3.5" />
                          <span>বিস্তারিত</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (searchQuery.trim().length >= 2) {
                              recordSearchHistory(searchQuery);
                            }
                            setConfirmDownloadFile(file);
                          }}
                          className="btn-3d-primary inline-flex min-h-[44px] sm:min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 transition-colors cursor-pointer"
                        >
                          {isDone ? (
                            <>
                              <Check className="h-4 w-4" />
                              <span>ডাউনলোড শুরু হয়েছে</span>
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4" />
                              <span>
                                {isPaid
                                  ? `ডাউনলোড (${formatPriceBn(file.price)})`
                                  : 'ডাউনলোড'}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Compact Capability Strip */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-3">
              <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
              <div>
                <p className="font-display text-sm font-semibold text-slate-900">
                  বাটন ও স্মার্টফোন ফ্ল্যাশ ফাইল
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  সকল ধরনের বাটন ও স্মার্টফোনের শতভাগ পরীক্ষিত ফ্ল্যাশ ফাইল
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <HardDrive className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
              <div>
                <p className="font-display text-sm font-semibold text-slate-900">
                  গুগল ড্রাইভের মাধ্যমে ডাউনলোড
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  গুগল ড্রাইভ থেকে সহজে ও সরাসরি হাই-স্পিডে নিরাপদ ডাউনলোড
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Cpu className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
              <div>
                <p className="font-display text-sm font-semibold text-slate-900">
                  হার্ডওয়্যার ও সফটওয়্যার সলিউশন
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  MTK, Qualcomm, SPD, আইসি রিপেয়ার, ডেড বুট ও আনলক সেবা
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
              <div>
                <p className="font-display text-sm font-semibold text-slate-900">
                  ৩ মাসে দক্ষ টেকনিশিয়ান ট্রেনিং
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  দক্ষ টেকনিশিয়ান দ্বারা প্র্যাকটিক্যাল প্রশিক্ষণ ·{' '}
                  <a
                    href="tel:01738266366"
                    className="font-mono font-semibold text-slate-900 hover:text-sky-700"
                  >
                    01738266366
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Servicing Center, Training Center & Contact Section */}
      <section
        id="servicing"
        className="border-t border-slate-200 bg-slate-50 py-12"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
            {/* Left Image */}
            <div className="lg:col-span-5">
              <div className="card-3d relative h-64 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900 lg:h-full lg:min-h-[340px]">
                {!benchImgError ? (
                  <img
                    src={BENCH_IMAGE_SRC}
                    alt="মোবাইল হার্ডওয়্যার আইসি ও সার্ভিসিং ট্রেনিং ওয়ার্কবেঞ্চ"
                    onError={() => setBenchImgError(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-slate-900 p-6 text-slate-300">
                    <Wrench className="h-10 w-10 text-sky-400" />
                    <p className="mt-3 font-display text-sm font-semibold text-white">
                      হার্ডওয়্যার, সফটওয়্যার ও ট্রেনিং সেন্টার
                    </p>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-transparent px-5 py-4">
                  <p className="font-display text-sm font-semibold text-white">
                    মোবাইল হার্ডওয়্যার-সফটওয়্যার সমাধান ও ট্রেনিং সেন্টার
                  </p>
                  <p className="text-xs text-slate-200">
                    {resolvedAddress} · তিন মাসে হয়ে উঠুন একজন দক্ষ টেকনিশিয়ান
                  </p>
                </div>
              </div>
            </div>

            {/* Right Services, Training & Contact / File Request */}
            <div
              id="contact"
              className="flex flex-col justify-between lg:col-span-7"
            >
              <div>
                <p className="text-xs font-medium text-sky-700">
                  দোকান, ট্রেনিং সেন্টার ও যোগাযোগের তথ্য
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900">
                  {siteSettings.shopName}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  সকল ধরনের বাটন ও স্মার্টফোনের শতভাগ পরীক্ষিত ফ্লাশ ফাইল,
                  মোবাইল সংক্রান্ত হার্ডওয়্যার ও সফটওয়্যার সমস্যার সমাধান এবং
                  দক্ষ টেকনিশিয়ান দ্বারা ট্রেনিং নিতে আজই চলে আসুন আমাদের
                  সেন্টারে।
                </p>

                {/* Dedicated Training Center Highlight Banner */}
                <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/80 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-bold text-slate-900 sm:text-base">
                        তিন মাসে হয়ে উঠুন একজন দক্ষ টেকনিশিয়ান
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-700">
                        দক্ষ টেকনিশিয়ান দ্বারা বাটন ও স্মার্টফোনের হার্ডওয়্যার
                        রিপেয়ারিং, আইসি কাজ ও সফটওয়্যার ফ্ল্যাশিংয়ের হাতে-কলমে
                        প্র্যাকটিক্যাল ট্রেনিং দেওয়া হয়। ভর্তি ও তথ্যের জন্য
                        আসুন{' '}
                        <span className="font-semibold text-slate-900">
                          {resolvedAddress}
                        </span>{' '}
                        অথবা কল করুন{' '}
                        <a
                          href="tel:01738266366"
                          className="font-mono font-bold text-sky-700 underline"
                        >
                          01738266366
                        </a>
                        ।
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 border-y border-slate-200 py-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      সরাসরি যোগাযোগ নম্বর ও ঠিকানা
                    </p>
                    <a
                      href="tel:01738266366"
                      className="mt-1 inline-flex items-center gap-2 font-mono text-xl font-bold text-slate-900 hover:text-sky-700"
                    >
                      <Phone className="h-4 w-4 text-sky-600" />
                      <span>01738266366</span>
                    </a>
                    <p className="mt-1 text-xs text-slate-500">
                      কল এবং হোয়াটসঅ্যাপ সাপোর্ট চালু আছে
                    </p>
                    <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-slate-800">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
                      <span>{resolvedAddress}</span>
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      দোকানের সময়সূচী ও সেবাসমূহ
                    </p>
                    <div
                      className={`mt-1.5 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${
                        siteSettings.shopOpen24Hours
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-rose-200 bg-rose-50 text-rose-800'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {siteSettings.shopOpen24Hours
                          ? '২৪ ঘণ্টা খোলা · অনলাইন ও সার্ভিসিং চালু'
                          : 'এখন দোকান বন্ধ (২৪ ঘণ্টা ওয়েব ডাউনলোড চালু)'}
                      </span>
                    </div>
                    {siteSettings.shopStatusNote && (
                      <p className="mt-1.5 text-xs font-medium text-slate-700">
                        {siteSettings.shopStatusNote}
                      </p>
                    )}
                    <ul className="mt-2 space-y-1 text-xs text-slate-700">
                      <li>বাটন ও স্মার্টফোন ফ্ল্যাশিং, আনব্রিক ও IMEI সমাধান</li>
                      <li>হার্ডওয়্যার আইসি, চার্জিং, নেটওয়ার্ক ও ডিসপ্লে সার্ভিসিং</li>
                      <li>৩ মাসে দক্ষ টেকনিশিয়ান গড়ার প্র্যাকটিক্যাল প্রশিক্ষণ</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Request Any Model File Form */}
              <form
                onSubmit={handleWhatsAppRequest}
                className="card-3d mt-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    হোয়াটসঅ্যাপে যেকোনো মডেলের ফাইল রিকোয়েস্ট বা ট্রেনিং তথ্য নিন
                  </h3>
                  <span className="font-mono text-xs text-slate-500">
                    01738266366
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input
                    type="text"
                    placeholder="ব্র্যান্ড / বিষয় (যেমন: Oppo বা ট্রেনিং)"
                    value={reqBrand}
                    onChange={(e) => setReqBrand(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="মডেল বা নাম (যেমন: CPH2477)"
                    value={reqModel}
                    onChange={(e) => setReqModel(e.target.value)}
                    required
                    className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="সমস্যা বা ফাইলের বিবরণ"
                    value={reqNote}
                    onChange={(e) => setReqNote(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>হোয়াটসঅ্যাপে বার্তা পাঠান</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Shop Google Maps Location (Shown ONLY when toggled ON by Admin) */}
          {siteSettings.shopMapEnabled && (
            <div className="mt-8 card-3d rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-sky-600" />
                  <h3 className="font-display text-base font-bold text-slate-900">
                    আমাদের সার্ভিসিং ও ট্রেনিং সেন্টারের গুগল ম্যাপ লোকেশন
                  </h3>
                </div>
                <p className="text-xs font-medium text-slate-600">
                  {resolvedAddress}
                </p>
              </div>
              <ShopMapSection
                shopName={siteSettings.shopName}
                shopAddress={resolvedAddress}
                lat={siteSettings.shopLat}
                lng={siteSettings.shopLng}
                pinSet={siteSettings.shopPinSet}
              />
            </div>
          )}
        </div>
      </section>

      {/* Rich Editorial Bangla Guide & FAQ (SEO + Google AdSense Readiness) */}
      <ServicingGuideSection />

      {/* Optional AdSense Bottom Responsive Unit */}
      <AdSenseUnit
        enabled={siteSettings.adsenseEnabled}
        publisherId={siteSettings.adsensePublisherId}
        slotId={siteSettings.adsenseSlotBottom}
      />

      <FileDetailModal
        file={activeDetailFile}
        onClose={() => setDetailFile(null)}
      />

      <DownloadConfirmModal
        file={activeConfirmDownloadFile}
        onClose={() => setConfirmDownloadFile(null)}
        onDownloadStarted={handleDownloadStartedFeedback}
      />
    </div>
  );
};
