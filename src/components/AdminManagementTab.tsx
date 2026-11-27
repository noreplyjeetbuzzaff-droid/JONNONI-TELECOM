import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Edit3,
  KeyRound,
  Lock,
  Mail,
  MessageSquare,
  PlusCircle,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  BOOTSTRAPPED_ADMIN_EMAILS,
  checkTokenScopes,
} from '../lib/firebase';
import {
  deleteAdminAccount,
  isValidAdminEmailKey,
  normalizeEmailKey,
  saveAdminAccount,
  subscribeAdminAccounts,
  toggleAdminAccountActive,
} from '../lib/adminAccountsRepo';
import {
  buildAdministratorAlertEmail,
  buildNewAdminBanglaEmail,
  isValidEmailAddress,
  sendGmailMessage,
} from '../lib/gmailService';
import {
  ADMIN_PERMISSION_META,
  ADMIN_ROLE_META,
  AdminAccountRecord,
  AdminPermissions,
  AdminRole,
  DEFAULT_ALL_PERMISSIONS,
  DEFAULT_SECONDARY_PERMISSIONS,
  PERMISSION_KEYS,
  ROLE_PERMISSION_PRESETS,
} from '../types/adminAccess';
import { ConfirmDialog } from './ConfirmDialog';
import { GoogleSignInButton } from './GoogleSignInButton';
import { LoadingSpinner } from './LoadingSpinner';

interface AdminManagementTabProps {
  currentAdminUid: string;
  currentAdminEmail: string;
  shopName: string;
  accessToken: string | null;
  onConnectWorkspace: () => Promise<void>;
  onClearToken?: () => void;
}

interface DeliveryReportItem {
  recipient: string;
  roleLabel: string;
  ok: boolean;
  message: string;
}

interface DisplayAdminRow {
  email: string;
  displayName: string;
  role: AdminRole;
  active: boolean;
  permissions: AdminPermissions;
  note: string;
  isPrimary: boolean;
  isBootstrappedSecondary: boolean;
  hasCustomDoc: boolean;
}

export const AdminManagementTab: React.FC<AdminManagementTabProps> = ({
  currentAdminUid,
  currentAdminEmail,
  shopName,
  accessToken,
  onConnectWorkspace,
  onClearToken,
}) => {
  const siteUrl = useMemo(
    () =>
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://jonnoitelecom.com',
    []
  );

  // Dynamic Firestore Admin Accounts & Access Control
  const [managedAccounts, setManagedAccounts] = useState<AdminAccountRecord[]>(
    []
  );
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  // Create New Admin Form State
  const [createEmail, setCreateEmail] = useState('');
  const [createName, setCreateName] = useState('');
  const [createNote, setCreateNote] = useState('');
  const [createRole, setCreateRole] = useState<AdminRole>('moderator');
  const [createActive, setCreateActive] = useState(true);
  const [createPermissions, setCreatePermissions] = useState<AdminPermissions>(
    () => ({ ...ROLE_PERMISSION_PRESETS.moderator })
  );
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // Inline Edit Access Control State
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editRole, setEditRole] = useState<AdminRole>('admin');
  const [editActive, setEditActive] = useState(true);
  const [editPermissions, setEditPermissions] = useState<AdminPermissions>(
    () => ({ ...DEFAULT_SECONDARY_PERMISSIONS })
  );
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Suspend / Delete Action State
  const [togglingEmail, setTogglingEmail] = useState<string | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<DisplayAdminRow | null>(
    null
  );
  const [deletingBusy, setDeletingBusy] = useState(false);

  // Bangla Email Composer State
  const initialWelcome = useMemo(
    () =>
      buildNewAdminBanglaEmail({
        newAdminEmail: 'jononitelecom266366@gmail.com',
        shopName,
        siteUrl,
        administratorEmail: BOOTSTRAPPED_ADMIN_EMAIL,
      }),
    [shopName, siteUrl]
  );

  const initialAlert = useMemo(
    () =>
      buildAdministratorAlertEmail({
        newAdminEmail: 'jononitelecom266366@gmail.com',
        administratorEmail: BOOTSTRAPPED_ADMIN_EMAIL,
        actorEmail: currentAdminEmail || BOOTSTRAPPED_ADMIN_EMAIL,
        shopName,
        siteUrl,
      }),
    [shopName, siteUrl, currentAdminEmail]
  );

  const [newAdminEmail, setNewAdminEmail] = useState(
    'jononitelecom266366@gmail.com'
  );
  const [administratorEmail, setAdministratorEmail] = useState(
    BOOTSTRAPPED_ADMIN_EMAIL
  );
  const [welcomeSubject, setWelcomeSubject] = useState(initialWelcome.subject);
  const [welcomeBody, setWelcomeBody] = useState(initialWelcome.body);
  const [sendAlertCopy, setSendAlertCopy] = useState(true);
  const [alertSubject, setAlertSubject] = useState(initialAlert.subject);
  const [alertBody, setAlertBody] = useState(initialAlert.body);
  const [smsPhone, setSmsPhone] = useState('01738266366');

  const [hasGmailScope, setHasGmailScope] = useState(false);
  const [checkingScope, setCheckingScope] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [deliveryReport, setDeliveryReport] = useState<DeliveryReportItem[]>(
    []
  );

  useEffect(() => {
    setAccountsLoading(true);
    setAccountsError(null);
    const unsub = subscribeAdminAccounts(
      (list) => {
        setManagedAccounts(list);
        setAccountsLoading(false);
      },
      (err) => {
        setAccountsError(err.message);
        setAccountsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!accessToken) {
      setHasGmailScope(false);
      return;
    }
    setCheckingScope(true);
    checkTokenScopes(accessToken)
      .then((scopes) => {
        if (!cancelled) {
          setHasGmailScope(scopes.hasGmailSend);
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingScope(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  // Merge Primary + Bootstrapped Secondary + Administrator-created Firestore admins
  const combinedAdminRows = useMemo<DisplayAdminRow[]>(() => {
    const byEmail = new Map<string, AdminAccountRecord>();
    for (const acc of managedAccounts) {
      byEmail.set(normalizeEmailKey(acc.email), acc);
    }

    const rows: DisplayAdminRow[] = [
      {
        email: BOOTSTRAPPED_ADMIN_EMAIL,
        displayName: 'প্রধান অ্যাডমিনিস্ট্রেটর (সিস্টেম মালিক)',
        role: 'super_admin',
        active: true,
        permissions: { ...DEFAULT_ALL_PERMISSIONS },
        note: 'পূর্ণ ও অপরিবর্তনীয় সুপার-অ্যাডমিন ক্ষমতা',
        isPrimary: true,
        isBootstrappedSecondary: false,
        hasCustomDoc: false,
      },
    ];

    const seen = new Set<string>([
      BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase(),
    ]);

    for (const bootEmail of BOOTSTRAPPED_ADMIN_EMAILS) {
      const lower = bootEmail.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      const override = byEmail.get(lower);
      rows.push({
        email: bootEmail,
        displayName: override?.displayName || 'অনুমোদিত অ্যাডমিন',
        role: override?.role || 'admin',
        active: override ? override.active : true,
        permissions: override
          ? override.permissions
          : { ...DEFAULT_SECONDARY_PERMISSIONS },
        note: override?.note || 'বুটস্ট্র্যাপড সিস্টেম অ্যাডমিন',
        isPrimary: false,
        isBootstrappedSecondary: true,
        hasCustomDoc: Boolean(override),
      });
    }

    for (const acc of managedAccounts) {
      const lower = normalizeEmailKey(acc.email);
      if (seen.has(lower)) continue;
      seen.add(lower);
      rows.push({
        email: acc.email,
        displayName: acc.displayName,
        role: acc.role,
        active: acc.active,
        permissions: acc.permissions,
        note: acc.note,
        isPrimary: false,
        isBootstrappedSecondary: false,
        hasCustomDoc: true,
      });
    }

    return rows;
  }, [managedAccounts]);

  const handleSelectCreateRole = (role: AdminRole) => {
    setCreateRole(role);
    setCreatePermissions({ ...ROLE_PERMISSION_PRESETS[role] });
  };

  const handleToggleCreatePermission = (key: keyof AdminPermissions) => {
    setCreatePermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleCreateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    const normalizedEmail = normalizeEmailKey(createEmail);
    if (!isValidAdminEmailKey(normalizedEmail)) {
      setCreateError('সঠিক Gmail / ইমেইল ঠিকানা লিখুন (যেমন: staff@gmail.com)।');
      return;
    }
    if (normalizedEmail === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
      setCreateError('প্রধান অ্যাডমিনিস্ট্রেটর ইতিমধ্যেই পূর্ণ ক্ষমতাপ্রাপ্ত।');
      return;
    }
    const cleanName = createName.trim();
    if (!cleanName) {
      setCreateError('নতুন অ্যাডমিনের নাম বা পদবি লিখুন।');
      return;
    }

    setCreatingAdmin(true);
    try {
      await saveAdminAccount({
        email: normalizedEmail,
        displayName: cleanName,
        role: createRole,
        active: createActive,
        permissions: createPermissions,
        note: createNote.trim(),
        actorUid: currentAdminUid,
        actorEmail: currentAdminEmail,
      });

      setCreateSuccess(
        `${normalizedEmail} সফলভাবে অ্যাডমিন হিসেবে যুক্ত হয়েছে এবং নির্ধারিত অ্যাক্সেস কন্ট্রোল সক্রিয় হয়েছে।`
      );
      handleRegenerateTemplates(normalizedEmail);
      setNewAdminEmail(normalizedEmail);
      setCreateEmail('');
      setCreateName('');
      setCreateNote('');
    } catch (err) {
      setCreateError(
        err instanceof Error
          ? err.message
          : 'নতুন অ্যাডমিন তৈরি করতে সমস্যা হয়েছে।'
      );
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleStartEdit = (row: DisplayAdminRow) => {
    setEditingEmail(row.email);
    setEditName(row.displayName);
    setEditNote(row.note);
    setEditRole(row.role);
    setEditActive(row.active);
    setEditPermissions({ ...row.permissions });
    setEditError(null);
  };

  const handleSelectEditRole = (role: AdminRole) => {
    setEditRole(role);
    setEditPermissions({ ...ROLE_PERMISSION_PRESETS[role] });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmail) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      await saveAdminAccount({
        email: editingEmail,
        displayName: editName.trim() || editingEmail.split('@')[0],
        role: editRole,
        active: editActive,
        permissions: editPermissions,
        note: editNote.trim(),
        actorUid: currentAdminUid,
        actorEmail: currentAdminEmail,
        isEdit: true,
      });
      setEditingEmail(null);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'অনুমতি আপডেট করা যায়নি।'
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleQuickToggleActive = async (row: DisplayAdminRow) => {
    if (row.isPrimary) return;
    if (normalizeEmailKey(row.email) === normalizeEmailKey(currentAdminEmail)) {
      setAccountsError('আপনি নিজের সক্রিয় অ্যাকাউন্ট নিজে স্থগিত করতে পারবেন না।');
      return;
    }
    setTogglingEmail(row.email);
    setAccountsError(null);
    try {
      await toggleAdminAccountActive({
        email: row.email,
        displayName: row.displayName,
        role: row.role,
        permissions: row.permissions,
        note: row.note,
        nextActive: !row.active,
        actorUid: currentAdminUid,
        actorEmail: currentAdminEmail,
      });
    } catch (err) {
      setAccountsError(
        err instanceof Error ? err.message : 'স্ট্যাটাস পরিবর্তন করা যায়নি।'
      );
    } finally {
      setTogglingEmail(null);
    }
  };

  const handleConfirmDeleteAdmin = async () => {
    if (!deletingTarget) return;
    setDeletingBusy(true);
    setAccountsError(null);
    try {
      await deleteAdminAccount(deletingTarget.email);
      if (editingEmail === deletingTarget.email) {
        setEditingEmail(null);
      }
      setDeletingTarget(null);
    } catch (err) {
      setAccountsError(
        err instanceof Error ? err.message : 'অ্যাডমিন মুছে ফেলা যায়নি।'
      );
      setDeletingTarget(null);
    } finally {
      setDeletingBusy(false);
    }
  };

  const handleRegenerateTemplates = (targetEmail: string) => {
    const cleanTarget = targetEmail.trim() || 'jononitelecom266366@gmail.com';
    const nextWelcome = buildNewAdminBanglaEmail({
      newAdminEmail: cleanTarget,
      shopName,
      siteUrl,
      administratorEmail: BOOTSTRAPPED_ADMIN_EMAIL,
    });
    const nextAlert = buildAdministratorAlertEmail({
      newAdminEmail: cleanTarget,
      administratorEmail: BOOTSTRAPPED_ADMIN_EMAIL,
      actorEmail: currentAdminEmail || BOOTSTRAPPED_ADMIN_EMAIL,
      shopName,
      siteUrl,
    });
    setWelcomeSubject(nextWelcome.subject);
    setWelcomeBody(nextWelcome.body);
    setAlertSubject(nextAlert.subject);
    setAlertBody(nextAlert.body);
  };

  const handleConnectClick = async () => {
    setConnectingGoogle(true);
    setConnectError(null);
    try {
      await onConnectWorkspace();
    } catch (err) {
      setConnectError(
        err instanceof Error
          ? err.message
          : 'Gmail অনুমতি সংযুক্ত করতে সমস্যা হয়েছে।'
      );
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleOpenSendConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setSendError(null);
    setDeliveryReport([]);

    if (!accessToken || !hasGmailScope) {
      setSendError(
        'ইমেইল পাঠাতে প্রথমে নিচের "Sign in with Google (Gmail অনুমতি দিন)" বাটনে ক্লিক করে Gmail অনুমতি সংযুক্ত করুন।'
      );
      return;
    }
    if (!isValidEmailAddress(newAdminEmail)) {
      setSendError('নতুন অ্যাডমিনের সঠিক ইমেইল ঠিকানা লিখুন।');
      return;
    }
    if (sendAlertCopy && !isValidEmailAddress(administratorEmail)) {
      setSendError('অ্যাডমিনিস্ট্রেটরের সঠিক ইমেইল ঠিকানা লিখুন।');
      return;
    }
    if (!welcomeSubject.trim() || !welcomeBody.trim()) {
      setSendError('বাংলা ইমেইলের বিষয় ও বার্তা লিখুন।');
      return;
    }
    if (sendAlertCopy && (!alertSubject.trim() || !alertBody.trim())) {
      setSendError('অ্যাডমিনিস্ট্রেটর অ্যালার্টের বিষয় ও বার্তা লিখুন।');
      return;
    }

    setConfirmOpen(true);
  };

  const handleConfirmedSend = async () => {
    if (!accessToken) {
      setConfirmOpen(false);
      return;
    }
    setSending(true);
    setSendError(null);
    const reports: DeliveryReportItem[] = [];

    try {
      await sendGmailMessage({
        accessToken,
        to: newAdminEmail.trim(),
        subject: welcomeSubject.trim(),
        body: welcomeBody.trim(),
      });
      reports.push({
        recipient: newAdminEmail.trim(),
        roleLabel: 'নতুন অ্যাডমিন (বাংলা কনফার্মেশন মেইল)',
        ok: true,
        message: 'সফলভাবে Gmail-এর মাধ্যমে পাঠানো হয়েছে।',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ইমেইল পাঠানো ব্যর্থ হয়েছে।';
      if (msg.includes('401') || msg.includes('403')) {
        onClearToken?.();
        setHasGmailScope(false);
      }
      reports.push({
        recipient: newAdminEmail.trim(),
        roleLabel: 'নতুন অ্যাডমিন (বাংলা কনফার্মেশন মেইল)',
        ok: false,
        message: msg,
      });
    }

    if (sendAlertCopy) {
      try {
        await sendGmailMessage({
          accessToken,
          to: administratorEmail.trim(),
          subject: alertSubject.trim(),
          body: alertBody.trim(),
        });
        reports.push({
          recipient: administratorEmail.trim(),
          roleLabel: 'অ্যাডমিনিস্ট্রেটর নোটিফিকেশন অ্যালার্ট',
          ok: true,
          message: 'সফলভাবে অ্যাডমিনিস্ট্রেটর ইমেইলে পাঠানো হয়েছে।',
        });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'অ্যালার্ট পাঠানো ব্যর্থ হয়েছে।';
        if (msg.includes('401') || msg.includes('403')) {
          onClearToken?.();
          setHasGmailScope(false);
        }
        reports.push({
          recipient: administratorEmail.trim(),
          roleLabel: 'অ্যাডমিনিস্ট্রেটর নোটিফিকেশন অ্যালার্ট',
          ok: false,
          message: msg,
        });
      }
    }

    setDeliveryReport(reports);
    setSending(false);
    setConfirmOpen(false);
  };

  const smsMessageText = `জননী টেলিকম: ${newAdminEmail.trim()} এখন ওয়েবসাইটের অনুমোদিত অ্যাডমিন হিসেবে যুক্ত হয়েছে। (${siteUrl})`;
  const cleanPhone = smsPhone.replace(/[^\d+]/g, '');
  const smsHref = cleanPhone
    ? `sms:${cleanPhone}?body=${encodeURIComponent(smsMessageText)}`
    : undefined;

  const confirmRecipientsSummary = sendAlertCopy
    ? `${newAdminEmail.trim()} (বাংলা অ্যাডমিন মেইল) এবং ${administratorEmail.trim()} (অ্যাডমিনিস্ট্রেটর অ্যালার্ট)`
    : newAdminEmail.trim();

  return (
    <div className="mt-6 space-y-6">
      {/* SECTION 1: Administrator Create New Admin & Access Control */}
      <form
        onSubmit={handleCreateAdminSubmit}
        className="card-3d rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                অ্যাডমিনিস্ট্রেটর: নতুন অ্যাডমিন তৈরি ও অ্যাক্সেস কন্ট্রোল
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                যেকোনো Gmail অ্যাকাউন্টকে নতুন অ্যাডমিন হিসেবে যুক্ত করুন এবং সে
                ড্যাশবোর্ডের কোন কোন অংশ ব্যবহার করতে পারবে তা নির্ধারণ করুন।
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 self-start sm:self-auto">
            <KeyRound className="h-3.5 w-3.5" />
            <span>RBAC অ্যাক্সেস কন্ট্রোল</span>
          </span>
        </div>

        {createError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
            {createError}
          </div>
        )}
        {createSuccess && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
            {createSuccess}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              নতুন অ্যাডমিনের Gmail / ইমেইল *
            </label>
            <input
              type="email"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              placeholder="example@gmail.com"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              নাম বা পদবি *
            </label>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="যেমন: ফাহিম (ফ্লাশ টেকনিশিয়ান)"
              required
              maxLength={80}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              দায়িত্বের নোট (ঐচ্ছিক)
            </label>
            <input
              type="text"
              value={createNote}
              onChange={(e) => setCreateNote(e.target.value)}
              placeholder="যেমন: শুধু Samsung ও MTK ফাইল আপলোড"
              maxLength={200}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Role Presets */}
        <div>
          <label className="block text-xs font-semibold text-slate-700">
            রোল প্রিসেট (Role Access Level)
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['admin', 'moderator', 'viewer'] as AdminRole[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => handleSelectCreateRole(role)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  createRole === role
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {ADMIN_ROLE_META[role].label}
              </button>
            ))}
            <label className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={createActive}
                onChange={(e) => setCreateActive(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600"
              />
              <span>তৈরির সাথে সাথেই সক্রিয় (Active) রাখুন</span>
            </label>
          </div>
        </div>

        {/* Granular Access Control Toggles */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-xs font-bold text-slate-900">
            কাস্টম অ্যাক্সেস কন্ট্রোল অনুমতি (Access Control Permissions)
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {PERMISSION_KEYS.map((key) => {
              const meta = ADMIN_PERMISSION_META[key];
              const checked = createPermissions[key];
              return (
                <label
                  key={key}
                  className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs transition-colors cursor-pointer ${
                    checked
                      ? 'border-sky-300 bg-white'
                      : 'border-slate-200 bg-slate-100/70 text-slate-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleCreatePermission(key)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600"
                  />
                  <div>
                    <p className="font-semibold text-slate-900">{meta.label}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                      {meta.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="submit"
            disabled={creatingAdmin}
            className="btn-3d-primary inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-60"
          >
            {creatingAdmin ? (
              <LoadingSpinner size="xs" label="সংরক্ষণ হচ্ছে..." />
            ) : (
              <>
                <PlusCircle className="h-4 w-4" />
                <span>নতুন অ্যাডমিন তৈরি ও অ্যাক্সেস সেভ করুন</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* SECTION 2: Authorized Admins & Live Access Control Matrix */}
      <div className="card-3d rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                অনুমোদিত অ্যাডমিন তালিকা ও লাইভ অ্যাক্সেস কন্ট্রোল
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                যেকোনো অ্যাডমিনের অনুমতি রিয়েল-টাইমে পরিবর্তন, সাময়িক স্থগিত
                (Suspend) বা মুছে ফেলতে পারেন।
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 self-start sm:self-auto">
            <UserCheck className="h-3.5 w-3.5" />
            <span>
              মোট {combinedAdminRows.length} জন (
              {combinedAdminRows.filter((r) => r.active).length} সক্রিয়)
            </span>
          </span>
        </div>

        {accountsError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
            {accountsError}
          </div>
        )}

        {accountsLoading ? (
          <div className="py-8 flex justify-center">
            <LoadingSpinner size="md" label="অ্যাডমিন তালিকা লোড হচ্ছে..." />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {combinedAdminRows.map((row) => {
              const roleMeta = ADMIN_ROLE_META[row.role] || ADMIN_ROLE_META.admin;
              const isEditingThis = editingEmail === row.email;
              const isSelf =
                normalizeEmailKey(row.email) ===
                normalizeEmailKey(currentAdminEmail);

              return (
                <div
                  key={row.email}
                  className={`rounded-xl border p-4 transition-colors ${
                    !row.active
                      ? 'border-red-200 bg-red-50/40'
                      : row.isPrimary
                        ? 'border-indigo-200 bg-indigo-50/40'
                        : 'border-slate-200 bg-slate-50/60'
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {row.displayName}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold ${roleMeta.badgeClass}`}
                        >
                          {row.isPrimary && <Lock className="h-2.5 w-2.5" />}
                          <span>{roleMeta.label}</span>
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            row.active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {row.active ? 'সক্রিয়' : 'স্থগিত (Suspended)'}
                        </span>
                      </div>

                      <p className="font-mono text-xs font-semibold text-slate-800 break-all">
                        {row.email}
                      </p>

                      {row.note && (
                        <p className="text-[11px] text-slate-600">{row.note}</p>
                      )}

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {PERMISSION_KEYS.map((permKey) => {
                          const enabled = row.permissions[permKey];
                          return (
                            <span
                              key={permKey}
                              className={`rounded border px-2 py-0.5 text-[10px] font-medium ${
                                enabled
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                  : 'border-slate-200 bg-white text-slate-400 line-through'
                              }`}
                            >
                              {ADMIN_PERMISSION_META[permKey].label}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {!row.isPrimary && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              isEditingThis
                                ? setEditingEmail(null)
                                : handleStartEdit(row)
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
                          >
                            {isEditingThis ? (
                              <>
                                <X className="h-3.5 w-3.5" />
                                <span>বন্ধ</span>
                              </>
                            ) : (
                              <>
                                <Edit3 className="h-3.5 w-3.5" />
                                <span>অনুমতি এডিট</span>
                              </>
                            )}
                          </button>

                          {!isSelf && (
                            <button
                              type="button"
                              disabled={togglingEmail === row.email}
                              onClick={() => handleQuickToggleActive(row)}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-60 ${
                                row.active
                                  ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                                  : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              }`}
                            >
                              {row.active ? (
                                <>
                                  <Ban className="h-3.5 w-3.5" />
                                  <span>স্থগিত করুন</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>সক্রিয় করুন</span>
                                </>
                              )}
                            </button>
                          )}

                          {row.hasCustomDoc && !isSelf && (
                            <button
                              type="button"
                              onClick={() => setDeletingTarget(row)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>
                                {row.isBootstrappedSecondary
                                  ? 'রিসেট'
                                  : 'মুছুন'}
                              </span>
                            </button>
                          )}
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setNewAdminEmail(row.email);
                          handleRegenerateTemplates(row.email);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 cursor-pointer"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        <span>বাংলা মেইল</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Access Control Editor */}
                  {isEditingThis && (
                    <form
                      onSubmit={handleSaveEdit}
                      className="mt-4 border-t border-slate-200 pt-4 space-y-3"
                    >
                      {editError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                          {editError}
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">
                            নাম / পদবি
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            maxLength={80}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">
                            রোল
                          </label>
                          <select
                            value={editRole}
                            onChange={(e) =>
                              handleSelectEditRole(e.target.value as AdminRole)
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                          >
                            <option value="admin">
                              {ADMIN_ROLE_META.admin.label}
                            </option>
                            <option value="moderator">
                              {ADMIN_ROLE_META.moderator.label}
                            </option>
                            <option value="viewer">
                              {ADMIN_ROLE_META.viewer.label}
                            </option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700">
                            নোট
                          </label>
                          <input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            maxLength={200}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {PERMISSION_KEYS.map((permKey) => (
                          <label
                            key={permKey}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={editPermissions[permKey]}
                              onChange={() =>
                                setEditPermissions((prev) => ({
                                  ...prev,
                                  [permKey]: !prev[permKey],
                                }))
                              }
                              className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600"
                            />
                            <span className="font-medium text-slate-800">
                              {ADMIN_PERMISSION_META[permKey].label}
                            </span>
                          </label>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editActive}
                            onChange={(e) => setEditActive(e.target.checked)}
                            disabled={isSelf}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600"
                          />
                          <span>অ্যাক্সেস সক্রিয় (Active)</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingEmail(null)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            বাতিল
                          </button>
                          <button
                            type="submit"
                            disabled={savingEdit}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer disabled:opacity-60"
                          >
                            <Save className="h-3.5 w-3.5" />
                            <span>
                              {savingEdit ? 'সংরক্ষণ হচ্ছে...' : 'আপডেট সংরক্ষণ'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 3: Bangla Email & Administrator Notification Composer */}
      <form
        onSubmit={handleOpenSendConfirm}
        className="card-3d rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                বাংলায় অ্যাডমিন ইমেইল ও অ্যাডমিনিস্ট্রেটর অ্যালার্ট পাঠান (Gmail)
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                নতুন অ্যাডমিন ({newAdminEmail}) এবং অ্যাডমিনিস্ট্রেটর (
                {administratorEmail})-কে একসাথে Gmail-এর মাধ্যমে কনফার্মেশন
                বার্তা পাঠান।
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleRegenerateTemplates(newAdminEmail)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shrink-0"
          >
            টেমপ্লেট রিসেট করুন
          </button>
        </div>

        {/* Gmail OAuth Connection Status */}
        {checkingScope ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <LoadingSpinner
              size="xs"
              label="Gmail পাঠানোর অনুমতি যাচাই করা হচ্ছে..."
            />
          </div>
        ) : !hasGmailScope ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-xs leading-relaxed text-amber-950">
              <span className="font-semibold">Gmail অনুমতি প্রয়োজন:</span>{' '}
              আপনার গুগল অ্যাকাউন্ট থেকে সরাসরি বাংলা ইমেইল ও অ্যাডমিনিস্ট্রেটর
              অ্যালার্ট পাঠাতে নিচের বাটনে ক্লিক করে Gmail ও Drive অনুমতি দিন।
            </p>
            {connectError && (
              <p className="text-xs font-medium text-red-700">{connectError}</p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <GoogleSignInButton
                onClick={handleConnectClick}
                disabled={connectingGoogle}
                label={
                  connectingGoogle
                    ? 'Gmail সংযুক্ত হচ্ছে...'
                    : 'Sign in with Google (Gmail অনুমতি দিন)'
                }
              />
              {connectingGoogle && (
                <LoadingSpinner size="sm" className="text-sky-600" />
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              Gmail প্রেরণ অনুমতি সক্রিয় আছে ({currentAdminEmail} থেকে পাঠানো
              যাবে)।
            </span>
          </div>
        )}

        {sendError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
            {sendError}
          </div>
        )}

        {deliveryReport.length > 0 && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold text-slate-900">
              ইমেইল প্রেরণের ফলাফল:
            </p>
            {deliveryReport.map((item) => (
              <div
                key={`${item.recipient}-${item.roleLabel}`}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  item.ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                <p className="font-semibold">
                  {item.roleLabel} ({item.recipient})
                </p>
                <p className="mt-0.5">{item.message}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Left: New Admin Bangla Email */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900">
                ১. নতুন অ্যাডমিনের বাংলা ইমেইল
              </h3>
              <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                বাংলা বার্তা
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                প্রাপক ইমেইল (নতুন অ্যাডমিন)
              </label>
              <input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                ইমেইলের বিষয় (Subject)
              </label>
              <input
                type="text"
                value={welcomeSubject}
                onChange={(e) => setWelcomeSubject(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                বাংলা ইমেইল বার্তা
              </label>
              <textarea
                rows={10}
                value={welcomeBody}
                onChange={(e) => setWelcomeBody(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs leading-relaxed text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Right: Administrator Email Notification + Optional Phone SMS */}
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-900">
                  ২. অ্যাডমিনিস্ট্রেটর ইমেইল নোটিফিকেশন
                </h3>
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendAlertCopy}
                    onChange={(e) => setSendAlertCopy(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600"
                  />
                  <span>একসাথে পাঠান</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  অ্যাডমিনিস্ট্রেটর ইমেইল
                </label>
                <input
                  type="email"
                  value={administratorEmail}
                  onChange={(e) => setAdministratorEmail(e.target.value)}
                  disabled={!sendAlertCopy}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  অ্যালার্ট বিষয় (Subject)
                </label>
                <input
                  type="text"
                  value={alertSubject}
                  onChange={(e) => setAlertSubject(e.target.value)}
                  disabled={!sendAlertCopy}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-600 focus:outline-none disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  অ্যাডমিনিস্ট্রেটর নোটিফিকেশন বার্তা
                </label>
                <textarea
                  rows={6}
                  value={alertBody}
                  onChange={(e) => setAlertBody(e.target.value)}
                  disabled={!sendAlertCopy}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs leading-relaxed text-slate-900 focus:border-sky-600 focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>

            {/* Optional Phone SMS Launcher */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900">
                  মোবাইল SMS নোটিশ (ঐচ্ছিক)
                </h3>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600">
                সরাসরি ফোনে SMS পাঠাতে চাইলে নিচের নম্বর থেকে আপনার ডিভাইসের
                SMS অ্যাপ খুলতে পারেন (ব্রাউজার থেকে স্বয়ংক্রিয়ভাবে মোবাইল
                সিম SMS পাঠানো যায় না, তবে Gmail ইমেইল সরাসরি পাঠানো হয়):
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="tel"
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value)}
                  placeholder="01738266366"
                  className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                />
                {smsHref && (
                  <a
                    href={smsHref}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>মোবাইল SMS অ্যাপে পাঠান</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={sending || !hasGmailScope}
            className="btn-3d-primary inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            <span>
              {sendAlertCopy
                ? 'দুটি ইমেইলই পাঠান (Gmail)'
                : 'বাংলা ইমেইল পাঠান (Gmail)'}
            </span>
          </button>
        </div>
      </form>

      {/* Mandatory Confirmation Dialog before sending emails via Gmail API */}
      <ConfirmDialog
        open={confirmOpen}
        title="Gmail-এর মাধ্যমে ইমেইল পাঠাবেন?"
        description={`আপনি কি নিশ্চিত যে ${confirmRecipientsSummary} ঠিকানায় বাংলা অ্যাডমিন কনফার্মেশন ইমেইল পাঠাতে চান? প্রেরক অ্যাকাউন্ট: ${currentAdminEmail}`}
        confirmLabel="হ্যাঁ, ইমেইল পাঠান"
        variant="primary"
        busy={sending}
        onConfirm={handleConfirmedSend}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Delete / Reset Admin Account Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingTarget)}
        title={
          deletingTarget?.isBootstrappedSecondary
            ? 'কাস্টম অ্যাক্সেস রিসেট করবেন?'
            : 'অ্যাডমিন অ্যাকাউন্ট মুছে ফেলবেন?'
        }
        description={
          deletingTarget
            ? deletingTarget.isBootstrappedSecondary
              ? `আপনি কি নিশ্চিত যে ${deletingTarget.email}-এর কাস্টম অ্যাক্সেস সীমাবদ্ধতা মুছে ডিফল্ট অ্যাডমিন অবস্থায় ফিরিয়ে নিতে চান?`
              : `আপনি কি নিশ্চিত যে ${deletingTarget.email} (${deletingTarget.displayName})-কে অ্যাডমিন তালিকা থেকে স্থায়ীভাবে মুছে ফেলতে চান?`
            : ''
        }
        confirmLabel="হ্যাঁ, নিশ্চিত করুন"
        variant="danger"
        busy={deletingBusy}
        onConfirm={handleConfirmDeleteAdmin}
        onCancel={() => setDeletingTarget(null)}
      />
    </div>
  );
};
