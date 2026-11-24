import React, { useEffect, useState } from 'react';
import {
  Check,
  Download,
  FileCode2,
  HardDrive,
  Phone,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  CATEGORY_LABELS_BN,
  CHIPSET_LABELS_BN,
  FlashFileRecord,
  formatBytes,
  formatDownloadCount,
  formatPriceBn,
  formatTimestamp,
} from '../types/flashFile';
import { triggerDirectWebDownload } from '../lib/directDownload';
import { incrementFlashFileDownloadCount } from '../lib/flashFilesRepo';
import { IndeterminateProgressBar } from './IndeterminateProgressBar';
import { LoadingSpinner } from './LoadingSpinner';

interface DownloadConfirmModalProps {
  file: FlashFileRecord | null;
  onClose: () => void;
  onDownloadStarted?: (fileId: string) => void;
}

export const DownloadConfirmModal: React.FC<DownloadConfirmModalProps> = ({
  file,
  onClose,
  onDownloadStarted,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    setDownloading(false);
    setDownloadStarted(false);
    setDownloadError(null);
  }, [file?.id]);

  useEffect(() => {
    if (!file) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !downloading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [file, downloading, onClose]);

  if (!file) return null;

  const isPaid = Boolean(file.price && file.price > 0);
  const downloadCount = formatDownloadCount(file.downloadCount);

  const handleConfirmDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await triggerDirectWebDownload(file.driveFileId, file.fileName);
      void incrementFlashFileDownloadCount(file.id);
      setDownloadStarted(true);
      onDownloadStarted?.(file.id);
    } catch (err) {
      setDownloadError(
        err instanceof Error
          ? err.message
          : 'গুগল ড্রাইভ থেকে ডাউনলোড শুরু করতে সমস্যা হয়েছে।'
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-confirm-title"
      onClick={() => {
        if (!downloading) onClose();
      }}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 border-b-4 border-b-slate-300 bg-white p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 border border-sky-200">
              <FileCode2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-sky-700">
                ডাউনলোড নিশ্চিত করুন · {file.brand} ({file.model})
              </p>
              <h3
                id="download-confirm-title"
                className="mt-0.5 font-display text-base font-bold leading-snug text-slate-900 break-words sm:text-lg"
              >
                {file.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            disabled={downloading}
            onClick={onClose}
            aria-label="ডাউনলোড ডায়ালগ বন্ধ করুন"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Highlighted Download Count & Verification Strip */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50/70 px-3.5 py-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>শতভাগ পরীক্ষিত ফ্লাশ ফাইল</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-sky-900 tabular-nums">
            <Download className="h-3.5 w-3.5 text-sky-600 shrink-0" />
            <span>মোট ডাউনলোড: {downloadCount} বার</span>
          </div>
        </div>

        {/* Firmware File Details */}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-2 border-b border-slate-100 pb-2">
            <dt className="text-xs text-slate-500">ফাইলের নাম</dt>
            <dd className="mt-0.5 font-mono text-xs font-medium text-slate-900 break-all">
              {file.fileName}
            </dd>
          </div>
          <div className="border-b border-slate-100 pb-2">
            <dt className="text-xs text-slate-500">ক্যাটাগরি</dt>
            <dd className="mt-0.5 text-xs font-medium text-slate-900">
              {CATEGORY_LABELS_BN[file.category] || file.category}
            </dd>
          </div>
          <div className="border-b border-slate-100 pb-2">
            <dt className="text-xs text-slate-500">চিপসেট / সিপিইউ</dt>
            <dd className="mt-0.5 text-xs font-medium text-slate-900">
              {CHIPSET_LABELS_BN[file.chipset] || file.chipset}
            </dd>
          </div>
          <div className="border-b border-slate-100 pb-2">
            <dt className="text-xs text-slate-500">ফাইলের সাইজ</dt>
            <dd className="mt-0.5 font-mono text-xs font-semibold text-slate-900 tabular-nums">
              {formatBytes(file.fileSizeBytes)}
            </dd>
          </div>
          <div className="border-b border-slate-100 pb-2">
            <dt className="text-xs text-slate-500">ভার্সন / ওএস</dt>
            <dd className="mt-0.5 font-mono text-xs font-medium text-slate-900">
              {file.version}
            </dd>
          </div>
          <div className="border-b border-slate-100 pb-2">
            <dt className="text-xs text-slate-500">মূল্য</dt>
            <dd
              className={`mt-0.5 font-mono text-xs font-bold tabular-nums ${
                isPaid ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {formatPriceBn(file.price)}
            </dd>
          </div>
          <div className="border-b border-slate-100 pb-2">
            <dt className="text-xs text-slate-500">আপলোডের তারিখ</dt>
            <dd className="mt-0.5 text-xs text-slate-900 tabular-nums">
              {formatTimestamp(file.createdAt)}
            </dd>
          </div>
        </dl>

        {file.notes && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">
              ফ্ল্যাশিং নির্দেশনা ও নোট
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
              {file.notes}
            </p>
          </div>
        )}

        {downloadError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
            {downloadError}
          </div>
        )}

        <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
          <IndeterminateProgressBar
            active={downloading}
            label="Google Drive থেকে ফাইল যাচাই ও ডাউনলোড শুরু হচ্ছে..."
          />

          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <button
                type="button"
                disabled={downloading}
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                বাতিল
              </button>
              <a
                href="tel:01738266366"
                className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-600 hover:text-sky-700"
              >
                <Phone className="h-3.5 w-3.5 text-sky-600" />
                <span>01738266366</span>
              </a>
            </div>

            <button
              type="button"
              onClick={handleConfirmDownload}
              disabled={downloading}
              className="btn-3d-primary inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-75"
            >
              {downloading ? (
                <LoadingSpinner
                  size="sm"
                  label="Google Drive প্রস্তুত হচ্ছে..."
                />
              ) : downloadStarted ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Google Drive ডাউনলোড শুরু হয়েছে</span>
                </>
              ) : (
                <>
                  <HardDrive className="h-4 w-4" />
                  <span>
                    {isPaid
                      ? `Google Drive ডাউনলোড (${formatPriceBn(file.price)})`
                      : 'Google Drive ডাউনলোড শুরু করুন'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
