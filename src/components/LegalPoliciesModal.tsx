import React from 'react';
import { FileText, Info, Phone, ShieldCheck, X } from 'lucide-react';

export type PolicyTab = 'privacy' | 'terms' | 'disclaimer' | 'about';

interface LegalPoliciesModalProps {
  activeTab: PolicyTab | null;
  onSelectTab: (tab: PolicyTab) => void;
  onClose: () => void;
}

const TABS: Array<{ id: PolicyTab; label: string }> = [
  { id: 'privacy', label: 'গোপনীয়তা নীতি' },
  { id: 'terms', label: 'ব্যবহারের শর্তাবলী' },
  { id: 'disclaimer', label: 'ডিসক্লেইমার ও DMCA' },
  { id: 'about', label: 'আমাদের সম্পর্কে' },
];

export const LegalPoliciesModal: React.FC<LegalPoliciesModalProps> = ({
  activeTab,
  onSelectTab,
  onClose,
}) => {
  if (!activeTab) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-sky-600" />
            <h2
              id="legal-modal-title"
              className="font-display text-base font-bold text-slate-900 sm:text-lg"
            >
              ওয়েবসাইট নীতিমালা ও তথ্য — জননী টেলিকম ও ট্রেনিং সেন্টার
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-slate-200 bg-white px-5 py-2.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === t.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 text-sm leading-relaxed text-slate-700 space-y-4">
          {activeTab === 'privacy' && (
            <>
              <h3 className="font-display text-base font-bold text-slate-900">
                গোপনীয়তা নীতি (Privacy Policy)
              </h3>
              <p>
                <strong>জননী টেলিকম অ্যান্ড মোবাইল সার্ভিসিং ট্রেনিং সেন্টার</strong>{' '}
                (মানিকগঞ্জ, খানসামা, দিনাজপুর) আপনার গোপনীয়তাকে সর্বোচ্চ গুরুত্ব
                দেয়। এই ওয়েবসাইট ব্যবহারের সময় আমরা কোনো ব্যক্তিগত সংবেদনশীল
                তথ্য (যেমন ব্যাংক পিন বা পাসওয়ার্ড) সংগ্রহ করি না।
              </p>
              <h4 className="font-semibold text-slate-900">
                ১. কুকি ও ভিজিটর পরিসংখ্যান
              </h4>
              <p>
                ওয়েবসাইটের পারফরম্যান্স উন্নত করতে এবং কোন মডেলের ফাইল বেশি
                প্রয়োজন তা বুঝতে আমরা কেবল বেনামী ভিজিট কাউন্ট, ডিভাইসের ধরন
                (মোবাইল/ডেস্কটপ) ও ব্রাউজার তথ্য সংরক্ষণ করি।
              </p>
              <h4 className="font-semibold text-slate-900">
                ২. Google AdSense ও তৃতীয় পক্ষের বিজ্ঞাপন
              </h4>
              <p>
                ভবিষ্যতে ও বর্তমানে Google AdSense-এর মতো অনুমোদিত বিজ্ঞাপন
                নেটওয়ার্ক ব্যবহারের ক্ষেত্রে Google এবং তার পার্টনাররা কুকি ব্যবহার
                করে ব্যবহারকারীর আগ্রহ অনুযায়ী প্রাসঙ্গিক বিজ্ঞাপন দেখাতে পারে।
                ব্যবহারকারীরা চাইলে{' '}
                <a
                  href="https://adssettings.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 underline"
                >
                  Google Ad Settings
                </a>{' '}
                থেকে পার্সোনালাইজড বিজ্ঞাপন বন্ধ করতে পারেন।
              </p>
              <h4 className="font-semibold text-slate-900">
                ৩. Google Maps গোপনীয়তা
              </h4>
              <p>
                দোকানের অবস্থান দেখানোর জন্য ব্যবহৃত মানচিত্র সেবা{' '}
                <a
                  href="https://policies.google.com/privacy?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 underline"
                >
                  Google Privacy Policy
                </a>{' '}
                অনুযায়ী পরিচালিত হয়।
              </p>
            </>
          )}

          {activeTab === 'terms' && (
            <>
              <h3 className="font-display text-base font-bold text-slate-900">
                ব্যবহারের শর্তাবলী (Terms & Conditions)
              </h3>
              <p>
                এই ওয়েবসাইট থেকে মোবাইল ফ্ল্যাশ টুলস, স্টক ফার্মওয়্যার বা
                ড্রাইভার ডাউনলোড এবং ব্যবহারের মাধ্যমে আপনি নিচের শর্তাবলীতে সম্মতি
                প্রদান করছেন:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  যেকোনো ফ্ল্যাশ ফাইল ব্যবহার করার আগে ডিভাইসের সঠিক মডেল নম্বর,
                  চিপসেট এবং বাইনারি ভার্সন যাচাই করা ব্যবহারকারীর দায়িত্ব।
                </li>
                <li>
                  ভুল ফার্মওয়্যার ফ্ল্যাশের কারণে ডিভাইসের ডেটা মুছে যাওয়া বা
                  সফটওয়্যার সমস্যার জন্য আগে সম্পূর্ণ ব্যাকআপ নেওয়ার পরামর্শ দেওয়া
                  হচ্ছে।
                </li>
                <li>
                  অর্থের বিনিময়ে তালিকাভুক্ত ফাইল বা পাসওয়ার্ড সুরক্ষিত ফাইলের
                  ক্ষেত্রে ডাউনলোডের পর হেল্পলাইন নম্বরে (<span className="font-mono">01738266366</span>) যোগাযোগ
                  করতে পারবেন।
                </li>
                <li>
                  মানচিত্র ফিচার ব্যবহারের ক্ষেত্রে{' '}
                  <a
                    href="https://maps.google.com/help/terms_maps/?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-700 underline"
                  >
                    Google Maps/Google Earth Additional Terms of Service
                  </a>{' '}
                  প্রযোজ্য।
                </li>
              </ul>
            </>
          )}

          {activeTab === 'disclaimer' && (
            <>
              <h3 className="font-display text-base font-bold text-slate-900">
                ডিসক্লেইমার ও কপিরাইট নীতি (Disclaimer & DMCA)
              </h3>
              <p>
                ওয়েবসাইটে প্রকাশিত সকল স্টক ফার্মওয়্যার, ইউএসবি ড্রাইভার ও
                ফ্ল্যাশ টুলস শিক্ষামূলক ও মোবাইল টেকনিশিয়ানদের সার্ভিসিং কাজের
                সুবিধার্থে শেয়ার করা হয়েছে। সকল ব্র্যান্ডের নাম ও ট্রেডমার্ক
                সংশ্লিষ্ট নির্মাতা প্রতিষ্ঠানের সম্পত্তি।
              </p>
              <p>
                কোনো কপিরাইট স্বত্বাধিকারী যদি মনে করেন কোনো ফাইল সরানো প্রয়োজন,
                তবে অনুগ্রহ করে আমাদের সরাসরি যোগাযোগ নম্বর{' '}
                <a
                  href="tel:01738266366"
                  className="font-mono font-semibold text-sky-700 underline"
                >
                  01738266366
                </a>{' '}
                -এ কল বা হোয়াটসঅ্যাপ করে জানালে ৪৮ ঘণ্টার মধ্যে তা যাচাই করে
                অপসারণ করা হবে।
              </p>
            </>
          )}

          {activeTab === 'about' && (
            <>
              <h3 className="font-display text-base font-bold text-slate-900">
                আমাদের সম্পর্কে (About Us)
              </h3>
              <p>
                <strong>জননী টেলিকম অ্যান্ড মোবাইল সার্ভিসিং ট্রেনিং সেন্টার</strong>{' '}
                (মানিকগঞ্জ, খানসামা, দিনাজপুর) মোবাইল টেকনিশিয়ান ও শিক্ষার্থীদের
                জন্য একটি নির্ভরযোগ্য ফ্ল্যাশ ফাইল হাব, হার্ডওয়্যার-সফটওয়্যার
                সলিউশন ও প্র্যাকটিক্যাল প্রশিক্ষণ কেন্দ্র।
              </p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                <p className="flex items-center gap-2 font-semibold text-slate-900">
                  <Info className="h-4 w-4 text-sky-600" />
                  <span>আমাদের মূল কার্যক্রম</span>
                </p>
                <ul className="list-disc pl-5 text-xs space-y-1">
                  <li>সকল ধরনের বাটন ও স্মার্টফোনের শতভাগ পরীক্ষিত ফ্ল্যাশ ফাইল (গুগল ড্রাইভে সহজ ডাউনলোড)</li>
                  <li>মোবাইল হার্ডওয়্যার ও সফটওয়্যার সমস্যা সমাধান, আইসি রিপেয়ার ও আনলক সাপোর্ট</li>
                  <li>দক্ষ টেকনিশিয়ান দ্বারা ৩ মাসে প্র্যাকটিক্যাল মোবাইল সার্ভিসিং ট্রেনিং</li>
                </ul>
                <p className="pt-2 flex items-center gap-2 text-xs font-semibold text-slate-900">
                  <Phone className="h-3.5 w-3.5 text-sky-600" />
                  <span>ঠিকানা: মানিকগঞ্জ, খানসামা, দিনাজপুর · কল: 01738266366</span>
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            <span>জননী টেলিকম অ্যান্ড মোবাইল সার্ভিসিং ট্রেনিং সেন্টার</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-1.5 font-semibold text-white hover:bg-slate-800 cursor-pointer"
          >
            ঠিক আছে
          </button>
        </div>
      </div>
    </div>
  );
};
