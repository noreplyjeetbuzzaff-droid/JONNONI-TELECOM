import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Globe,
  History,
  Laptop,
  Printer,
  Search,
  Smartphone,
  Tablet,
  Trash2,
  Wifi,
} from 'lucide-react';
import {
  clearLoginHistory,
  ClientDeviceInfo,
  detectClientDeviceInfo,
  fetchClientIpAddress,
  LoginEventStatus,
  LoginEventType,
  LoginHistoryRecord,
  subscribeLoginHistory,
} from '../lib/loginHistoryRepo';
import { ConfirmDialog } from './ConfirmDialog';
import { LoadingSpinner } from './LoadingSpinner';

interface LoginHistoryTabProps {
  user: User;
  isBootstrapped: boolean;
  shopName: string;
  hasDriveConnected: boolean;
}

const EVENT_TYPE_LABELS: Record<LoginEventType, string> = {
  admin_login: 'অ্যাডমিন লগইন',
  drive_connect: 'Google Drive সংযুক্ত',
  gmail_connect: 'Gmail সংযুক্ত',
  drive_blocked: 'Drive সংযোগ ব্লক',
  logout: 'সাইন আউট',
};

const STATUS_META: Record<
  LoginEventStatus,
  { label: string; className: string }
> = {
  success: {
    label: 'সফল',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  blocked: {
    label: 'ব্লকড',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  failed: {
    label: 'ব্যর্থ',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
};

function formatBnDateTime(ts?: { toDate: () => Date } | null): string {
  if (!ts) return 'এইমাত্র';
  try {
    return ts.toDate().toLocaleString('bn-BD', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

function escapeCsvCell(val: string): string {
  const safe = val.replace(/"/g, '""');
  return `"${safe}"`;
}

export const LoginHistoryTab: React.FC<LoginHistoryTabProps> = ({
  user,
  isBootstrapped,
  shopName,
  hasDriveConnected,
}) => {
  const [entries, setEntries] = useState<LoginHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentDevice, setCurrentDevice] = useState<ClientDeviceInfo | null>(
    null
  );
  const [currentIp, setCurrentIp] = useState<string>('যাচাই হচ্ছে...');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LoginEventStatus>(
    'all'
  );
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    detectClientDeviceInfo().then((info) => {
      if (!cancelled) setCurrentDevice(info);
    });
    fetchClientIpAddress(user).then((ip) => {
      if (!cancelled) setCurrentIp(ip);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsub = subscribeLoginHistory(
      (list) => {
        setEntries(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.email.toLowerCase().includes(q) ||
        item.displayName.toLowerCase().includes(q) ||
        item.deviceName.toLowerCase().includes(q) ||
        item.ipAddress.toLowerCase().includes(q) ||
        item.os.toLowerCase().includes(q) ||
        item.browser.toLowerCase().includes(q)
      );
    });
  }, [entries, searchQuery, statusFilter]);

  const handlePrintPdf = () => {
    window.print();
  };

  const handleDownloadCsv = () => {
    const headers = [
      'সময়',
      'ইমেইল',
      'নাম',
      'ইভেন্ট',
      'স্ট্যাটাস',
      'ডিভাইস নাম',
      'ডিভাইস ধরন',
      'OS',
      'ব্রাউজার',
      'IP ঠিকানা',
      'নোট/ত্রুটি',
    ];
    const rows = filteredEntries.map((item) => [
      formatBnDateTime(item.createdAt),
      item.email,
      item.displayName,
      EVENT_TYPE_LABELS[item.eventType] || item.eventType,
      STATUS_META[item.status]?.label || item.status,
      item.deviceName,
      item.deviceType,
      item.os,
      item.browser,
      item.ipAddress,
      item.errorMessage || '',
    ]);
    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) => row.map((c) => escapeCsvCell(String(c))).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `login-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleConfirmClear = async () => {
    setClearing(true);
    try {
      await clearLoginHistory();
      setConfirmClear(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'হিস্ট্রি মুছে ফেলা যায়নি।'
      );
      setConfirmClear(false);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="mt-6 space-y-5">
      {/* Print-Only Report Title Header */}
      <div className="hidden print:block border-b border-slate-300 pb-3 mb-4">
        <h1 className="text-lg font-bold text-slate-900">
          {shopName} — অ্যাডমিন লগইন তথ্য ও হিস্ট্রি রিপোর্ট
        </h1>
        <p className="text-xs text-slate-600 mt-1">
          রিপোর্ট প্রিন্ট সময়:{' '}
          {new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' })} ·
          মোট রেকর্ড: {filteredEntries.length}টি
        </p>
      </div>

      {/* Current Session Info Summary Card */}
      <div className="card-3d rounded-xl border border-slate-200 bg-white p-5 print:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
              <Wifi className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                বর্তমান লগইন সেশন ও ডিভাইস তথ্য (Live Session Info)
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                আপনার বর্তমান ব্রাউজার, ফোন/ডিভাইস মডেল এবং IP ঠিকানার
                বিস্তারিত তথ্য।
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold self-start sm:self-auto ${
              hasDriveConnected
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            {hasDriveConnected ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Google Drive সংযুক্ত</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Google Drive সংযুক্ত নয়</span>
              </>
            )}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-medium text-slate-500">
              সাইন ইন ইমেইল
            </p>
            <p className="mt-1 font-mono text-xs font-semibold text-slate-900 break-all">
              {user.email}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 truncate">
              {user.displayName || 'অ্যাডমিন'}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-medium text-slate-500">
              ডিভাইস / ফোন মডেল
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-900 truncate">
              {currentDevice?.deviceName || 'শনাক্ত হচ্ছে...'}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {currentDevice?.deviceType === 'mobile'
                ? 'মোবাইল ফোন'
                : currentDevice?.deviceType === 'tablet'
                  ? 'ট্যাবলেট'
                  : 'ডেস্কটপ / ল্যাপটপ'}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-medium text-slate-500">
              অপারেটিং সিস্টেম ও ব্রাউজার
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-900">
              {currentDevice
                ? `${currentDevice.os} · ${currentDevice.browser}`
                : 'যাচাই হচ্ছে...'}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              ইমেইল যাচাইকৃত: {user.emailVerified ? 'হ্যাঁ' : 'না'}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-medium text-slate-500">
              নেটওয়ার্ক IP ঠিকানা
            </p>
            <p className="mt-1 font-mono text-xs font-semibold text-slate-900">
              {currentIp}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              UID: {user.uid.slice(0, 12)}...
            </p>
          </div>
        </div>
      </div>

      {/* Login History Table Card */}
      <div className="card-3d rounded-xl border border-slate-200 bg-white overflow-hidden print:border-0 print:shadow-none">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <History className="h-5 w-5 text-sky-600" />
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                অ্যাডমিন লগইন ও ড্রাইভ সংযোগ হিস্ট্রি ({filteredEntries.length})
              </h2>
              <p className="text-xs text-slate-500">
                সকল অ্যাডমিনের লগইন সময়, ফোন/ডিভাইসের নাম, IP ও ড্রাইভ ব্লক
                লগ।
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ইমেইল, ডিভাইস বা IP খুঁজুন..."
                className="w-48 rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-2.5 text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | LoginEventStatus)
              }
              aria-label="স্ট্যাটাস ফিল্টার"
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-sky-600 focus:outline-none"
            >
              <option value="all">সব স্ট্যাটাস</option>
              <option value="success">শুধু সফল</option>
              <option value="blocked">শুধু ব্লকড</option>
              <option value="failed">শুধু ব্যর্থ</option>
            </select>

            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={filteredEntries.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>প্রিন্ট / PDF</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={filteredEntries.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>CSV</span>
            </button>

            {isBootstrapped && entries.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>মুছুন</span>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 print:hidden">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center p-10">
            <LoadingSpinner
              size="md"
              label="লগইন হিস্ট্রি লোড হচ্ছে..."
              className="text-sky-600 text-xs font-medium"
            />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            এখনো কোনো লগইন বা ড্রাইভ সংযোগের হিস্ট্রি রেকর্ড পাওয়া যায়নি।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">সময়</th>
                  <th className="px-4 py-2.5 font-semibold">অ্যাডমিন ইমেইল</th>
                  <th className="px-4 py-2.5 font-semibold">কার্যক্রম</th>
                  <th className="px-4 py-2.5 font-semibold">ফোন / ডিভাইস নাম</th>
                  <th className="px-4 py-2.5 font-semibold">IP ঠিকানা</th>
                  <th className="px-4 py-2.5 font-semibold">বিবরণ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredEntries.map((item) => {
                  const statusMeta =
                    STATUS_META[item.status] || STATUS_META.success;
                  const DeviceIcon =
                    item.deviceType === 'mobile'
                      ? Smartphone
                      : item.deviceType === 'tablet'
                        ? Tablet
                        : Laptop;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {formatBnDateTime(item.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-[11px] font-semibold text-slate-900">
                          {item.email}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {item.displayName}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded border px-2 py-0.5 text-[10px] font-bold ${statusMeta.className}`}
                          >
                            {statusMeta.label}
                          </span>
                          <span className="font-medium text-slate-800">
                            {EVENT_TYPE_LABELS[item.eventType] ||
                              item.eventType}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-medium text-slate-900">
                          <DeviceIcon className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                          <span>{item.deviceName}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {item.os} · {item.browser}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Globe className="h-3 w-3 text-slate-400" />
                          <span>{item.ipAddress}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[240px] text-[11px] text-slate-600">
                        {item.errorMessage ? (
                          <span
                            className={`break-words ${
                              item.eventType === 'logout'
                                ? 'text-amber-700 font-medium'
                                : 'text-red-700'
                            }`}
                          >
                            {item.errorMessage}
                          </span>
                        ) : (
                          <span className="text-slate-400">স্বাভাবিক সেশন</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="লগইন হিস্ট্রি মুছে ফেলবেন?"
        description="আপনি কি নিশ্চিত যে সকল সংরক্ষিত অ্যাডমিন লগইন ও ডিভাইস হিস্ট্রি মুছে ফেলতে চান?"
        confirmLabel="হ্যাঁ, মুছে ফেলুন"
        variant="danger"
        busy={clearing}
        onConfirm={handleConfirmClear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
};
