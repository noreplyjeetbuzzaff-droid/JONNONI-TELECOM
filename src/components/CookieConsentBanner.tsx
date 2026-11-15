import React, { useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';

interface CookieConsentBannerProps {
  onOpenPrivacy: () => void;
}

const CONSENT_KEY = 'jt_cookie_consent_v1';

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({
  onOpenPrivacy,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONSENT_KEY);
      if (!saved) {
        setVisible(true);
      }
    } catch {
      setVisible(false);
    }
  }, []);

  const acceptCookies = () => {
    try {
      localStorage.setItem(CONSENT_KEY, 'accepted');
    } catch {
      // ignore storage errors
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="কুকি ও গোপনীয়তা সম্মতি"
      className="fixed bottom-3 left-3 right-3 z-40 mx-auto max-w-4xl rounded-xl border border-slate-700 bg-slate-900/95 px-4 py-3 text-white shadow-xl backdrop-blur-sm sm:bottom-4 sm:px-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-200">
          <Cookie className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
          <p>
            ওয়েবসাইটের সঠিক কার্যক্রম, ভিজিটর বিশ্লেষণ ও প্রাসঙ্গিক বিজ্ঞাপন
            প্রদর্শনের জন্য আমরা কুকি ব্যবহার করি।{' '}
            <button
              type="button"
              onClick={onOpenPrivacy}
              className="font-semibold text-sky-300 underline underline-offset-2 hover:text-sky-200 cursor-pointer"
            >
              গোপনীয়তা নীতি পড়ুন
            </button>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 justify-end">
          <button
            type="button"
            onClick={acceptCookies}
            className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 transition-colors cursor-pointer whitespace-nowrap"
          >
            সম্মতি দিন
          </button>
        </div>
      </div>
    </div>
  );
};
