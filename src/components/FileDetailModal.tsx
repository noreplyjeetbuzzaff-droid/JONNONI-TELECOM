import React, { useState } from 'react';
import { Check, Download, Phone, X } from 'lucide-react';
import {
  CATEGORY_LABELS_BN,
  CHIPSET_LABELS_BN,
  FlashFileRecord,
  formatBytes,
  formatPriceBn,
  formatTimestamp,
} from '../types/flashFile';
import { triggerDirectWebDownload } from '../lib/directDownload';
import { LoadingSpinner } from './LoadingSpinner';

interface FileDetailModalProps {
  file: FlashFileRecord | null;
  onClose: () => void;
}

export const FileDetailModal: React.FC<FileDetailModalProps> = ({
  file,
  onClose,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (!file) return null;

  const handleDirectDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await triggerDirectWebDownload(file.driveFileId, file.fileName);
      setDownloadStarted(true);
      setTimeout(() => setDownloadStarted(false), 3000);
    } catch (err) {
      setDownloadError(
        err instanceof Error
          ? err.message
          : 'ডাউনলোড শুরু করতে সমস্যা হয়েছে।'
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-detail-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-slate-200 border-b-4 border-b-slate-300 bg-white p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">
              {file.brand} · {file.model} ·{' '}
              {CATEGORY_LABELS_BN[file.category] || file.category}
            </p>
            <h3
              id="file-detail-title"
              className="mt-1 font-display text-lg font-bold text-slate-900 break-words"
            >
              {file.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="বিস্তারিত বন্ধ করুন"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="border-b border-slate-100 pb-2">
            <dt className="text-xs text-slate-500">অ্যাপ / ফাইল মূল্য</dt>
            <dd
              className={`mt-0.5 font-mono text-sm font-bold tabular-nums ${
                file.price && file.price > 0
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}
            >
              {formatPriceBn(file.price)}
            </dd>
          </div>
          <div className="border-b border-slate-100 pb-2">
            <dt className="text-xs text-slate-500">ফাইলের সাইজ</dt>
            <dd className="mt-0.5 font-mono text-sm font-medium text-slate-900 tabular-nums">
              {formatBytes(file.fileSizeBytes)}
            </dd>
          </div>
          <div className="col-span-2 border-b border-slate-100 pb-2">
            <dt className="text-xs text-slate-500">ফাইলের নাম</dt>
            <dd className="mt-0.5 font-mono text-xs text-slate-900 break-all">
              {file.fileName}
            </dd>
          </div>
          <div className="border-b border-slate-100 pb-2">
            <dt className="text-xs text-slate-500">চিপসেট / সিপিইউ</dt>
            <dd className="mt-0.5 text-xs font-medium text-slate-900">
              {CHIPSET_LABELS_BN[file.chipset] || file.chipset}
            </dd>
          </div>
          <div className="border-b border-slate-100 pb-2">
            <dt className="text-xs text-slate-500">ভার্সন / ওএস</dt>
            <dd className="mt-0.5 font-mono text-xs text-slate-900">
              {file.version}
            </dd>
          </div>
          <div className="col-span-2 border-b border-slate-100 pb-2">
            <dt className="text-xs text-slate-500">আপলোডের তারিখ</dt>
            <dd className="mt-0.5 text-xs text-slate-900 tabular-nums">
              {formatTimestamp(file.createdAt)} · {file.uploadedByName}
            </dd>
          </div>
        </dl>

        {file.notes && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <p className="text-xs font-medium text-slate-600">
              ফ্ল্যাশিং নির্দেশনা ও পাসওয়ার্ড নোট
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {file.notes}
            </p>
          </div>
        )}

        {downloadError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
            {downloadError}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Phone className="h-3.5 w-3.5 text-slate-500" />
            <span>সহায়তার জন্য কল: </span>
            <a
              href="tel:01738266366"
              className="font-mono font-semibold text-slate-900 hover:text-sky-700 underline underline-offset-2"
            >
              01738266366
            </a>
          </div>

          <button
            type="button"
            onClick={handleDirectDownload}
            disabled={downloading}
            className="btn-3d-primary inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-70"
          >
            {downloading ? (
              <LoadingSpinner size="sm" label="ডাউনলোড প্রস্তুত হচ্ছে..." />
            ) : downloadStarted ? (
              <>
                <Check className="h-4 w-4" />
                <span>ডাউনলোড শুরু হয়েছে</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>সরাসরি ডাউনলোড করুন</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
