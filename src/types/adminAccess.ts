import { Timestamp } from 'firebase/firestore';

export type AdminRole = 'super_admin' | 'admin' | 'moderator' | 'viewer';

export interface AdminPermissions {
  manageFiles: boolean;
  viewVisitors: boolean;
  manageSeo: boolean;
  manageSettings: boolean;
  viewLoginHistory: boolean;
  manageAdmins: boolean;
}

export interface AdminAccountRecord {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  active: boolean;
  permissions: AdminPermissions;
  note: string;
  createdByUid: string;
  createdByEmail: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface AdminAccessState {
  isAdmin: boolean;
  isPrimary: boolean;
  active: boolean;
  isSuspended: boolean;
  role: AdminRole;
  permissions: AdminPermissions;
}

export const PERMISSION_KEYS: (keyof AdminPermissions)[] = [
  'manageFiles',
  'viewVisitors',
  'manageSeo',
  'manageSettings',
  'viewLoginHistory',
  'manageAdmins',
];

export const ADMIN_PERMISSION_META: Record<
  keyof AdminPermissions,
  { label: string; description: string }
> = {
  manageFiles: {
    label: 'ফাইল আপলোড, এডিট ও ড্রাইভ',
    description: 'ফ্লাশ ফাইল আপলোড, এডিট, ডিলিট ও গুগল ড্রাইভ পরিচালনা',
  },
  viewVisitors: {
    label: 'রিয়েল-টাইম ভিজিটর ও বিশ্লেষণ',
    description: 'লাইভ ভিজিটর, ডিভাইস, IP, সার্চ কীওয়ার্ড ও প্রিন্ট/PDF দেখা',
  },
  manageSeo: {
    label: 'SEO ও মেটা ট্যাগ',
    description: 'Google সার্চের জন্য Meta Description ও Keywords সম্পাদনা',
  },
  manageSettings: {
    label: 'শপ ২৪ ঘণ্টা, ম্যাপ, হেডার ও AdSense',
    description: 'দোকান খোলা/বন্ধ স্ট্যাটাস, ম্যাপ পিন, কালার ও বিজ্ঞাপন সেটিংস',
  },
  viewLoginHistory: {
    label: 'লগইন হিস্ট্রি ও ডিভাইস/IP লগ',
    description: 'অ্যাডমিন লগইন ও ড্রাইভ অডিট হিস্ট্রি এবং প্রিন্ট/PDF দেখা',
  },
  manageAdmins: {
    label: 'অ্যাডমিন তৈরি ও অ্যাক্সেস কন্ট্রোল',
    description: 'নতুন অ্যাডমিন যুক্ত করা, অনুমতি পরিবর্তন ও অ্যাকাউন্ট স্থগিত করা',
  },
};

export const ADMIN_ROLE_META: Record<
  AdminRole,
  { label: string; badgeClass: string }
> = {
  super_admin: {
    label: 'প্রধান অ্যাডমিনিস্ট্রেটর',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  admin: {
    label: 'পূর্ণ অ্যাডমিন',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  moderator: {
    label: 'ফাইল মডারেটর',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  viewer: {
    label: 'পরিসংখ্যান পরিদর্শক',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
  },
};

export const NO_PERMISSIONS: AdminPermissions = {
  manageFiles: false,
  viewVisitors: false,
  manageSeo: false,
  manageSettings: false,
  viewLoginHistory: false,
  manageAdmins: false,
};

export const DEFAULT_ALL_PERMISSIONS: AdminPermissions = {
  manageFiles: true,
  viewVisitors: true,
  manageSeo: true,
  manageSettings: true,
  viewLoginHistory: true,
  manageAdmins: true,
};

export const DEFAULT_SECONDARY_PERMISSIONS: AdminPermissions = {
  manageFiles: true,
  viewVisitors: true,
  manageSeo: true,
  manageSettings: true,
  viewLoginHistory: true,
  manageAdmins: false,
};

export const ROLE_PERMISSION_PRESETS: Record<AdminRole, AdminPermissions> = {
  super_admin: { ...DEFAULT_ALL_PERMISSIONS },
  admin: { ...DEFAULT_SECONDARY_PERMISSIONS },
  moderator: {
    manageFiles: true,
    viewVisitors: false,
    manageSeo: false,
    manageSettings: false,
    viewLoginHistory: false,
    manageAdmins: false,
  },
  viewer: {
    manageFiles: false,
    viewVisitors: true,
    manageSeo: false,
    manageSettings: false,
    viewLoginHistory: true,
    manageAdmins: false,
  },
};

export function normalizeAdminPermissions(
  raw: Partial<AdminPermissions> | Record<string, unknown> | undefined | null
): AdminPermissions {
  if (!raw || typeof raw !== 'object') {
    return { ...NO_PERMISSIONS };
  }
  const obj = raw as Record<string, unknown>;
  return {
    manageFiles: obj.manageFiles === true,
    viewVisitors: obj.viewVisitors === true,
    manageSeo: obj.manageSeo === true,
    manageSettings: obj.manageSettings === true,
    viewLoginHistory: obj.viewLoginHistory === true,
    manageAdmins: obj.manageAdmins === true,
  };
}

export function createDeniedAdminAccess(): AdminAccessState {
  return {
    isAdmin: false,
    isPrimary: false,
    active: false,
    isSuspended: false,
    role: 'viewer',
    permissions: { ...NO_PERMISSIONS },
  };
}
