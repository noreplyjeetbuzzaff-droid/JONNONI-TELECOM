import React from 'react';
import { BookOpen, CheckCircle2, HelpCircle } from 'lucide-react';

export const ServicingGuideSection: React.FC = () => {
  return (
    <section
      id="guide"
      className="border-t border-slate-200 bg-white py-12"
      aria-labelledby="guide-heading"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">
            টেকনিশিয়ান গাইড ও সচরাচর জিজ্ঞাসা
          </p>
          <h2
            id="guide-heading"
            className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900"
          >
            নিরাপদ মোবাইল ফ্ল্যাশিং নির্দেশিকা ও FAQ
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            সঠিক ফ্ল্যাশ ফাইল নির্বাচন এবং ডিভাইসকে ডেড রিস্ক থেকে সুরক্ষিত রাখতে
            জননী টেলিকম অ্যান্ড মোবাইল সার্ভিসিং ট্রেনিং সেন্টারের এই প্রয়োজনীয়
            নির্দেশনাগুলো অনুসরণ করুন।
          </p>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Editorial Checklist */}
          <article className="card-3d rounded-xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6 lg:col-span-6">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-sky-600" />
              <h3 className="font-display text-base font-bold text-slate-900">
                ফ্ল্যাশিং শুরু করার আগে ৫টি জরুরি ধাপ
              </h3>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>মডেল ও বাইনারি মিলিয়ে নিন:</strong> Samsung বা
                  Xiaomi ফোনের ক্ষেত্রে রিভিশন/বাইনারি (U1, U2, U3) এবং সঠিক
                  রিজিওন কোড যাচাই করুন।
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>সঠিক ইউএসবি ড্রাইভার:</strong> চিপসেট অনুযায়ী MTK VCOM,
                  Qualcomm HS-USB QDLoader 9008 অথবা SPD/Unisoc ড্রাইভার
                  ইনস্টল রাখুন।
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>ব্যাটারি চার্জ ও ভালো কেবল:</strong> ফ্ল্যাশের আগে
                  ফোনে ন্যূনতম ৫০% চার্জ নিশ্চিত করুন এবং অরিজিনাল ইউএসবি
                  ডেটা কেবল ব্যবহার করুন।
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>সিকিউরিটি ব্যাকআপ (NV/QCN):</strong> MTK বা Qualcomm
                  ডিভাইসে সম্পূর্ণ ফার্মওয়্যার ফ্ল্যাশের আগে NVData ও QCN
                  ব্যাকআপ রাখা নিরাপদ।
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>সরাসরি টেকনিক্যাল সহায়তা:</strong> কোনো এরর কোড বা
                  পাসওয়ার্ড সহায়তার জন্য কল করুন{' '}
                  <a
                    href="tel:01738266366"
                    className="font-mono font-semibold text-sky-700 underline"
                  >
                    01738266366
                  </a>
                  ।
                </span>
              </li>
            </ul>
          </article>

          {/* FAQ Accordion */}
          <div className="space-y-3 lg:col-span-6">
            <div className="flex items-center gap-2 pb-1">
              <HelpCircle className="h-5 w-5 text-sky-600" />
              <h3 className="font-display text-base font-bold text-slate-900">
                সচরাচর জিজ্ঞাসিত প্রশ্ন (FAQ)
              </h3>
            </div>

            <details
              open
              className="rounded-xl border border-slate-200 bg-white px-4 py-3.5"
            >
              <summary className="cursor-pointer font-display text-sm font-semibold text-slate-900">
                ওয়েবসাইট থেকে ফাইল কীভাবে সরাসরি ডাউনলোড করবো?
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                আপনার কাঙ্ক্ষিত মডেলের ফাইল খুঁজে নিয়ে{' '}
                <strong>সরাসরি ডাউনলোড</strong> বাটনে ক্লিক করুন। আপনাকে কোনো
                আলাদা গুগল ড্রাইভ পেজে যেতে হবে না—আমাদের ওয়েবসাইট থেকেই সরাসরি
                হাই-স্পিড ডাউনলোড শুরু হবে।
              </p>
            </details>

            <details className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
              <summary className="cursor-pointer font-display text-sm font-semibold text-slate-900">
                তালিকায় না থাকা কোনো মডেলের ফাইল কীভাবে পাবো?
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                সার্ভিসিং সেকশনের হোয়াটসঅ্যাপ রিকোয়েস্ট ফর্মে ব্র্যান্ড ও মডেল
                লিখে পাঠান অথবা <span className="font-mono">01738266366</span>{' '}
                নম্বরে সরাসরি যোগাযোগ করুন। আমাদের টিম ফাইলটি দ্রুত ক্যাটালগে
                আপলোড করে দেবে।
              </p>
            </details>

            <details className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
              <summary className="cursor-pointer font-display text-sm font-semibold text-slate-900">
                ফ্রি এবং পেইড ফাইলের পার্থক্য কী?
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                সকল ফ্ল্যাশ টুলস, ইউএসবি ড্রাইভার এবং অধিকাংশ স্টক ফার্মওয়্যার
                সম্পূর্ণ ফ্রি। কিছু স্পেশাল টেস্টেড ডাম্প, MDM বা এক্সক্লুসিভ
                প্যাকেজের পাশে মূল্য (<span className="font-mono">৳</span>)
                উল্লেখ থাকে।
              </p>
            </details>
          </div>
        </div>
      </div>
    </section>
  );
};
