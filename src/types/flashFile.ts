import { Timestamp } from 'firebase/firestore';

export const FILE_CATEGORIES = [
  'Flash Tools',
  'Stock Firmware',
  'USB Drivers',
  'FRP & Unlock',
  'QCN & Security',
  'Repair Guides',
] as const;

export type FileCategory = (typeof FILE_CATEGORIES)[number];

export const CATEGORY_LABELS_BN: Record<FileCategory, string> = {
  'Flash Tools': 'ফ্ল্যাশ টুলস',
  'Stock Firmware': 'স্টক ফার্মওয়্যার',
  'USB Drivers': 'ইউএসবি ড্রাইভার',
  'FRP & Unlock': 'এফআরপি ও আনলক',
  'QCN & Security': 'কিউসিএন ও সিকিউরিটি',
  'Repair Guides': 'রিপেয়ার গাইড',
};

export const CHIPSET_PLATFORMS = [
  'MediaTek (MTK)',
  'Qualcomm Snapdragon',
  'Unisoc (SPD)',
  'Exynos',
  'Kirin',
  'Apple Silicon',
  'Universal',
] as const;

export type ChipsetPlatform = (typeof CHIPSET_PLATFORMS)[number];

export const CHIPSET_LABELS_BN: Record<ChipsetPlatform, string> = {
  'MediaTek (MTK)': 'মিডিয়াটেক (MTK)',
  'Qualcomm Snapdragon': 'কোয়ালকম স্ন্যাপড্রাগন',
  'Unisoc (SPD)': 'ইউনিসক (SPD)',
  Exynos: 'এক্সিনস (Exynos)',
  Kirin: 'কিরিন (Kirin)',
  'Apple Silicon': 'অ্যাপল সিলিকন',
  Universal: 'ইউনিভার্সাল (সকল)',
};

export const COMMON_BRANDS = [
  'Samsung',
  'Xiaomi',
  'Realme',
  'Oppo',
  'Vivo',
  'iPhone',
  'Infinix',
  'Tecno',
  'Itel',
  'OnePlus',
  'Motorola',
  'Nokia',
  'Symphony',
  'Walton',
  'Universal',
] as const;

export interface FlashFileRecord {
  id: string;
  title: string;
  brand: string;
  model: string;
  category: FileCategory;
  chipset: ChipsetPlatform;
  version: string;
  fileName: string;
  fileSizeBytes: number;
  driveFileId: string;
  downloadUrl: string;
  viewUrl: string;
  notes: string;
  price?: number;
  downloadCount?: number;
  isPublicDrive: boolean;
  uploadedByUid: string;
  uploadedByName: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface CreateFlashFileInput {
  title: string;
  brand: string;
  model: string;
  category: FileCategory;
  chipset: ChipsetPlatform;
  version: string;
  fileName: string;
  fileSizeBytes: number;
  driveFileId: string;
  downloadUrl: string;
  viewUrl: string;
  notes: string;
  price: number;
  isPublicDrive: boolean;
  uploadedByUid: string;
  uploadedByName: string;
}

export interface UpdateFlashFileInput {
  title: string;
  brand: string;
  model: string;
  category: FileCategory;
  chipset: ChipsetPlatform;
  version: string;
  notes: string;
  price: number;
  isPublicDrive: boolean;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  const val = bytes / Math.pow(1024, idx);
  return `${val >= 100 || idx === 0 ? val.toFixed(0) : val.toFixed(1)} ${units[idx]}`;
}

export function formatPriceBn(price: number | undefined): string {
  if (!price || price <= 0) return 'ফ্রি';
  return `৳ ${new Intl.NumberFormat('en-US').format(Math.round(price))}`;
}

export function formatDownloadCount(count: number | undefined): number {
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) {
    return 0;
  }
  return Math.floor(count);
}

export function formatTimestamp(ts: Timestamp | null | undefined): string {
  if (!ts) return 'এইমাত্র';
  try {
    const date = ts.toDate();
    return new Intl.DateTimeFormat('bn-BD', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return 'সাম্প্রতিক';
  }
}
