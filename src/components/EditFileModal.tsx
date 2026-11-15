import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  CATEGORY_LABELS_BN,
  CHIPSET_LABELS_BN,
  CHIPSET_PLATFORMS,
  ChipsetPlatform,
  COMMON_BRANDS,
  FILE_CATEGORIES,
  FileCategory,
  FlashFileRecord,
  UpdateFlashFileInput,
} from '../types/flashFile';
import { ConfirmDialog } from './ConfirmDialog';

interface EditFileModalProps {
  file: FlashFileRecord | null;
  onClose: () => void;
  onSave: (file: FlashFileRecord, updates: UpdateFlashFileInput) => Promise<void>;
}

export const EditFileModal: React.FC<EditFileModalProps> = ({
  file,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState(file?.title || '');
  const [brand, setBrand] = useState(file?.brand || '');
  const [model, setModel] = useState(file?.model || '');
  const [category, setCategory] = useState<FileCategory>(
    file?.category || 'Stock Firmware'
  );
  const [chipset, setChipset] = useState<ChipsetPlatform>(
    file?.chipset || 'MediaTek (MTK)'
  );
  const [version, setVersion] = useState(file?.version || '');
  const [price, setPrice] = useState<string>(
    String(file?.price !== undefined ? file.price : 0)
  );
  const [notes, setNotes] = useState(file?.notes || '');
  const [isPublicDrive, setIsPublicDrive] = useState(
    file?.isPublicDrive ?? true
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!file) return null;

  const parsedPrice = Math.max(0, Number(price) || 0);

  const handleRequestSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (title.trim().length < 2) {
      setError('শিরোনাম কমপক্ষে ২ অক্ষরের হতে হবে।');
      return;
    }
    if (!brand.trim() || !model.trim() || !version.trim()) {
      setError('ব্র্যান্ড, মডেল এবং ভার্সন অবশ্যই পূরণ করতে হবে।');
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmedSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(file, {
        title: title.trim(),
        brand: brand.trim(),
        model: model.trim(),
        category,
        chipset,
        version: version.trim(),
        notes: notes.trim(),
        price: parsedPrice,
        isPublicDrive,
      });
      setShowConfirm(false);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'ফাইলের তথ্য আপডেট করা যায়নি।'
      );
      setShowConfirm(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-file-title"
      >
        <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h3
              id="edit-file-title"
              className="font-display text-lg font-semibold text-slate-900"
            >
              ফাইলের তথ্য সম্পাদনা করুন
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="সম্পাদনা বন্ধ করুন"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleRequestSave} className="mt-5 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700">
                ফাইলের শিরোনাম
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  ব্র্যান্ড
                </label>
                <input
                  type="text"
                  list="edit-brand-suggestions"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  maxLength={50}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                />
                <datalist id="edit-brand-suggestions">
                  {COMMON_BRANDS.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  মডেল নাম / কোড
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  maxLength={80}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  ক্যাটাগরি
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FileCategory)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                >
                  {FILE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS_BN[c]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  চিপসেট
                </label>
                <select
                  value={chipset}
                  onChange={(e) =>
                    setChipset(e.target.value as ChipsetPlatform)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                >
                  {CHIPSET_PLATFORMS.map((chip) => (
                    <option key={chip} value={chip}>
                      {CHIPSET_LABELS_BN[chip]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  ভার্সন / ওএস
                </label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  maxLength={60}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  অ্যাপ / ফাইল মূল্য (৳ টাকা — ০ দিলে ফ্রি)
                </label>
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  step={1}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                ফ্ল্যাশিং নোট / পাসওয়ার্ড
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              />
            </div>

            <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublicDrive}
                onChange={(e) => setIsPublicDrive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
              />
              <span>ওয়েবসাইটে সবার ডাউনলোডের জন্য উন্মুক্ত রাখুন</span>
            </label>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 cursor-pointer"
              >
                পরিবর্তন সংরক্ষণ করুন
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="ফাইল আপডেট নিশ্চিত করুন"
        description={`"${title}" (${brand} ${model}) ফাইলের তথ্য ও ড্রাইভ পারমিশন আপডেট করতে চান?`}
        confirmLabel="আপডেট করুন"
        variant="primary"
        busy={saving}
        onConfirm={handleConfirmedSave}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
};
