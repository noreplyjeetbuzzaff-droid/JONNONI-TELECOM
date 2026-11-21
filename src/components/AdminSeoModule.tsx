import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Globe,
  Plus,
  RotateCcw,
  Save,
  Search,
  Tags,
} from 'lucide-react';
import { DEFAULT_SITE_SETTINGS, SiteSettings } from '../types/siteSettings';
import { saveSiteSettings } from '../lib/siteSettingsRepo';
import { LoadingSpinner } from './LoadingSpinner';

interface AdminSeoModuleProps {
  uid: string;
  getIdToken: () => Promise<string>;
  siteSettings: SiteSettings;
}

const SUGGESTED_KEYWORDS = [
  'Stock Firmware Download',
  'Samsung Flash File',
  'Xiaomi Fastboot ROM',
  'FRP Unlock File',
  'MTK Flash Tool',
  'Qualcomm EDL Firmware',
  'USB Driver',
  'Realme Oppo OFP',
  'Mobile Servicing Bangladesh',
  'Jonnoi Telecom',
];

export const AdminSeoModule: React.FC<AdminSeoModuleProps> = ({
  uid,
  getIdToken,
  siteSettings,
}) => {
  const [description, setDescription] = useState(siteSettings.seoDescription);
  const [keywords, setKeywords] = useState(siteSettings.seoKeywords);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setDescription(siteSettings.seoDescription);
    setKeywords(siteSettings.seoKeywords);
  }, [siteSettings.seoDescription, siteSettings.seoKeywords]);

  const parsedKeywords = useMemo(() => {
    return keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
  }, [keywords]);

  const descLength = description.trim().length;
  const isIdealDescLength = descLength >= 100 && descLength <= 160;

  const handleAddKeyword = (term: string) => {
    const exists = parsedKeywords.some(
      (k) => k.toLowerCase() === term.toLowerCase()
    );
    if (exists) return;
    const next =
      parsedKeywords.length > 0 ? [...parsedKeywords, term].join(', ') : term;
    if (next.length <= 500) {
      setKeywords(next);
      setSuccess(null);
      setError(null);
    }
  };

  const handleResetDefaults = () => {
    setDescription(DEFAULT_SITE_SETTINGS.seoDescription);
    setKeywords(DEFAULT_SITE_SETTINGS.seoKeywords);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDesc = description.trim();
    const cleanKw = keywords.trim();

    if (cleanDesc.length < 20) {
      setError('Meta Description কমপক্ষে ২০ অক্ষরের হতে হবে।');
      return;
    }
    if (cleanDesc.length > 320) {
      setError('Meta Description সর্বোচ্চ ৩২০ অক্ষরের মধ্যে হতে হবে।');
      return;
    }
    if (cleanKw.length > 500) {
      setError('Meta Keywords সর্বোচ্চ ৫০০ অক্ষরের মধ্যে হতে হবে।');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const idToken = await getIdToken();
      await saveSiteSettings(
        uid,
        {
          ...siteSettings,
          seoDescription: cleanDesc,
          seoKeywords: cleanKw,
        },
        idToken
      );
      setSuccess(
        'SEO Meta Description ও Keywords ডাটাবেসে সংরক্ষিত হয়েছে এবং পেজের <head> ট্যাগে সক্রিয় হয়েছে।'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'SEO সেটিংস সংরক্ষণ করা যায়নি।'
      );
    } finally {
      setSaving(false);
    }
  };

  const previewUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://jononi-telecom.vercel.app';

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Editor Panel */}
        <div className="card-3d rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-7 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-sky-600" />
                <h2 className="font-display text-base font-bold text-slate-900">
                  ডায়নামিক SEO মেটা ডেসক্রিপশন ও কীওয়ার্ড
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Google সার্চ র‍্যাংকিং উন্নত করতে সাইটের Meta Description ও
                Keywords সরাসরি ডাটাবেস থেকে পরিবর্তন করুন। পেজ লোড হলেই{' '}
                <code className="font-mono text-slate-700">&lt;head&gt;</code>{' '}
                ট্যাগ আপডেট হয়ে যায়।
              </p>
            </div>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>ডিফল্ট বসান</span>
            </button>
          </div>

          {/* Meta Description Input */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="seo-meta-description"
                className="block text-xs font-semibold text-slate-800"
              >
                Meta Description (সার্চ বিবরণ)
              </label>
              <span
                className={`font-mono text-[11px] font-semibold tabular-nums ${
                  isIdealDescLength
                    ? 'text-emerald-700'
                    : descLength > 160
                      ? 'text-amber-700'
                      : 'text-slate-500'
                }`}
              >
                {descLength} / 320 অক্ষর (আদর্শ: ১২০–১৬০)
              </span>
            </div>
            <textarea
              id="seo-meta-description"
              rows={3}
              maxLength={320}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="আপনার মোবাইল ফ্ল্যাশ ফাইল, স্টক ফার্মওয়্যার ও সার্ভিসিং সেন্টারের সংক্ষিপ্ত বিবরণ লিখুন..."
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm leading-relaxed text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              এটি{' '}
              <code className="font-mono text-slate-700">
                meta[name=&quot;description&quot;]
              </code>
              , <code className="font-mono text-slate-700">og:description</code>{' '}
              এবং{' '}
              <code className="font-mono text-slate-700">
                twitter:description
              </code>{' '}
              ট্যাগগুলো স্বয়ংক্রিয়ভাবে আপডেট করে।
            </p>
          </div>

          {/* Meta Keywords Input */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="seo-meta-keywords"
                className="block text-xs font-semibold text-slate-800"
              >
                Meta Keywords (কমা দিয়ে আলাদা করুন)
              </label>
              <span className="font-mono text-[11px] font-semibold text-slate-500 tabular-nums">
                {parsedKeywords.length}টি কীওয়ার্ড · {keywords.length}/500
              </span>
            </div>
            <textarea
              id="seo-meta-keywords"
              rows={3}
              maxLength={500}
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="Samsung Flash File, Xiaomi Fastboot ROM, FRP Unlock File, Mobile Servicing..."
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
            />

            {/* Quick Suggestion Chips to Append */}
            <div className="mt-2.5">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                <Tags className="h-3.5 w-3.5 text-sky-600" />
                <span>ক্লিক করে জনপ্রিয় কীওয়ার্ড যোগ করুন:</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_KEYWORDS.map((term) => {
                  const added = parsedKeywords.some(
                    (k) => k.toLowerCase() === term.toLowerCase()
                  );
                  return (
                    <button
                      key={term}
                      type="button"
                      disabled={added}
                      onClick={() => handleAddKeyword(term)}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                        added
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800'
                      }`}
                    >
                      {!added && <Plus className="h-3 w-3" />}
                      <span>{term}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn-3d-primary inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition-colors cursor-pointer disabled:opacity-60"
            >
              {saving ? (
                <LoadingSpinner size="sm" label="সংরক্ষণ হচ্ছে..." />
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>SEO মেটা ডাটাবেসে সংরক্ষণ করুন</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Live Google Search Snippet Preview */}
        <div className="space-y-5 lg:col-span-5">
          <div className="card-3d rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Globe className="h-4 w-4 text-sky-600" />
              <h3 className="font-display text-sm font-bold text-slate-900">
                Google সার্চ রেজাল্ট প্রিভিউ
              </h3>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="truncate font-mono text-[11px] text-slate-600">
                {previewUrl}
              </p>
              <p className="mt-1 font-display text-base font-semibold leading-snug text-blue-700">
                জননী টেলিকম অ্যান্ড মোবাইল সার্ভিসিং ট্রেনিং সেন্টার — মোবাইল ফ্লাশ ফাইল ও হার্ডওয়্যার সলিউশন
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
                {description.trim() || DEFAULT_SITE_SETTINGS.seoDescription}
              </p>
            </div>

            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3.5 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">
                সক্রিয় কীওয়ার্ড তালিকা ({parsedKeywords.length}):
              </p>
              {parsedKeywords.length === 0 ? (
                <p className="text-slate-400">কোনো কীওয়ার্ড যুক্ত করা হয়নি।</p>
              ) : (
                <p className="font-mono text-[11px] leading-relaxed text-slate-700">
                  {parsedKeywords.join(' · ')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
